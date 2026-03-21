"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  "What's my monthly savings?",
  "How does $0-down work?",
  "What's the 30% tax credit?",
  "How long does install take?",
];

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content: "Hi! I'm Alex ☀ your SolarAdvisor specialist. Tell me your monthly electric bill and I'll calculate your savings instantly — no forms needed!",
  timestamp: new Date(),
};

export default function LiveChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showBubble, setShowBubble] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Show bubble message after 8 seconds
  useEffect(() => {
    const t = setTimeout(() => setShowBubble(true), 8000);
    return () => clearTimeout(t);
  }, []);

  // Abort any in-flight stream on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (open && !minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, minimized]);

  // Focus input when opened
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if (!content || streaming) return;

    setInput("");
    setShowBubble(false);

    const userMsg: Message = { role: "user", content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    // Add empty assistant message to stream into
    const assistantMsg: Message = { role: "assistant", content: "", timestamp: new Date() };
    setMessages((prev) => [...prev, assistantMsg]);

    abortRef.current = new AbortController();

    try {
      const history = messages.slice(1).map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1].content = "Sorry, I'm having trouble connecting. Please try again or [get your free estimate](/funnel)!";
          return copy;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            content: copy[copy.length - 1].content + chunk,
          };
          return copy;
        });
      }

      // Increment unread if chat is closed
      if (!open || minimized) setUnread((n) => n + 1);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1].content = "Connection error. [Get your free estimate here →](/funnel)";
          return copy;
        });
      }
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, messages, open, minimized]);

  const handleOpen = () => {
    setOpen(true);
    setMinimized(false);
    setUnread(0);
    setShowBubble(false);
  };

  // Parse markdown-like links in messages
  function renderContent(content: string) {
    if (!content) return <span style={{ opacity: 0.4 }}>●●●</span>;

    // Replace [text](url) with links
    const parts = content.split(/(\[.*?\]\(.*?\)|\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      const linkMatch = part.match(/\[(.+?)\]\((.+?)\)/);
      if (linkMatch) {
        return (
          <Link key={i} href={linkMatch[2]} style={{ color: "#FFD700", fontWeight: 700, textDecoration: "underline" }}>
            {linkMatch[1]}
          </Link>
        );
      }
      const boldMatch = part.match(/\*\*(.+?)\*\*/);
      if (boldMatch) {
        return <strong key={i} style={{ color: "#FFD700" }}>{boldMatch[1]}</strong>;
      }
      // Handle newlines
      return <span key={i}>{part.split("\n").map((line, j, arr) => (
        <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
      ))}</span>;
    });
  }

  return (
    <>
      {/* Floating button */}
      <div style={{
        position: "fixed", bottom: 28, right: 28, zIndex: 9999,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10,
      }}>
        {/* Proactive bubble */}
        {showBubble && !open && (
          <div
            onClick={handleOpen}
            style={{
              background: "var(--earth-dark)", color: "white",
              borderRadius: "16px 16px 4px 16px",
              padding: "12px 16px", maxWidth: 220,
              fontSize: "0.85rem", lineHeight: 1.5, cursor: "pointer",
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,215,0,0.3)",
              fontFamily: "var(--font-body)",
              animation: "fadeUp 0.4s ease forwards",
            }}
          >
            <strong style={{ color: "var(--sun-glow)" }}>Alex</strong> — SolarAdvisor<br />
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8rem" }}>
              Tell me your bill, I&apos;ll calculate your savings instantly ⚡
            </span>
          </div>
        )}

        {/* Chat toggle button */}
        <button
          onClick={() => open ? setMinimized(!minimized) : handleOpen()}
          style={{
            width: 60, height: 60, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--sun-core), var(--sun-glow))",
            border: "none", cursor: "pointer",
            boxShadow: "0 6px 24px rgba(255,140,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, transition: "transform 0.2s ease",
            position: "relative",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
        >
          {open && !minimized ? "✕" : "💬"}

          {/* Unread badge */}
          {unread > 0 && (
            <div style={{
              position: "absolute", top: -4, right: -4,
              width: 20, height: 20, borderRadius: "50%",
              background: "#EF4444", color: "white",
              fontSize: "0.7rem", fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid white",
            }}>
              {unread}
            </div>
          )}
        </button>
      </div>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed",
          bottom: 102,
          right: 28,
          width: 360,
          height: minimized ? 60 : 520,
          zIndex: 9998,
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.4), 0 4px 24px rgba(255,140,0,0.15)",
          border: "1px solid rgba(255,215,0,0.2)",
          display: "flex", flexDirection: "column",
          transition: "height 0.3s cubic-bezier(0.34,1.56,0.64,1)",
          fontFamily: "var(--font-body)",
        }}>
          {/* Header */}
          <div
            onClick={() => setMinimized(!minimized)}
            style={{
              background: "linear-gradient(135deg, var(--earth-dark), #2D1F0A)",
              padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", flexShrink: 0,
              borderBottom: "1px solid rgba(255,215,0,0.15)",
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--sun-core), var(--sun-glow))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>☀</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: "white", fontSize: "0.9rem" }}>Alex — Solar Advisor</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E" }} />
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem" }}>Online · Instant responses</span>
              </div>
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem" }}>
              {minimized ? "▲" : "▼"}
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div style={{
                flex: 1, overflowY: "auto", padding: "14px 14px 8px",
                background: "#0F0F0F",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    animation: "fadeUp 0.3s ease forwards",
                  }}>
                    {msg.role === "assistant" && (
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: "linear-gradient(135deg, var(--sun-core), var(--sun-glow))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, marginRight: 7, alignSelf: "flex-end",
                      }}>☀</div>
                    )}
                    <div style={{
                      maxWidth: "75%",
                      background: msg.role === "user"
                        ? "linear-gradient(135deg, var(--sun-core), var(--sun-glow))"
                        : "rgba(255,255,255,0.07)",
                      color: "white",
                      borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      padding: "10px 13px",
                      fontSize: "0.875rem",
                      lineHeight: 1.55,
                      border: msg.role === "assistant" ? "1px solid rgba(255,215,0,0.1)" : "none",
                    }}>
                      {renderContent(msg.content)}
                    </div>
                  </div>
                ))}

                {/* Streaming indicator */}
                {streaming && messages[messages.length - 1]?.content === "" && (
                  <div style={{ display: "flex", gap: 4, padding: "8px 14px" }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: "var(--sun-glow)",
                        animation: `bounce 1s ease-in-out ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick questions */}
              {messages.length <= 2 && (
                <div style={{
                  padding: "6px 10px 4px",
                  background: "#0F0F0F",
                  display: "flex", flexWrap: "wrap", gap: 5,
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                }}>
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      disabled={streaming}
                      style={{
                        background: "rgba(255,215,0,0.08)",
                        border: "1px solid rgba(255,215,0,0.2)",
                        borderRadius: "999px", padding: "5px 11px",
                        color: "rgba(255,255,255,0.7)", fontSize: "0.72rem",
                        cursor: "pointer", whiteSpace: "nowrap",
                        transition: "all 0.15s ease",
                        fontFamily: "var(--font-body)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,215,0,0.15)";
                        (e.currentTarget as HTMLButtonElement).style.color = "white";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,215,0,0.08)";
                        (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)";
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div style={{
                padding: "10px 12px",
                background: "#1A1A1A",
                borderTop: "1px solid rgba(255,255,255,0.07)",
                display: "flex", gap: 8, alignItems: "center",
              }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Type your bill amount or ask anything..."
                  disabled={streaming}
                  style={{
                    flex: 1, padding: "10px 14px",
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "999px", color: "white",
                    fontSize: "0.875rem", outline: "none",
                    fontFamily: "var(--font-body)",
                  }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || streaming}
                  style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: input.trim() && !streaming
                      ? "linear-gradient(135deg, var(--sun-core), var(--sun-glow))"
                      : "rgba(255,255,255,0.1)",
                    border: "none", cursor: input.trim() && !streaming ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, transition: "all 0.2s ease", flexShrink: 0,
                    color: "white",
                  }}
                >
                  {streaming ? (
                    <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                  ) : "→"}
                </button>
              </div>

              {/* Bottom disclaimer */}
              <div style={{
                padding: "6px 14px",
                background: "#1A1A1A",
                textAlign: "center",
                fontSize: "0.65rem", color: "rgba(255,255,255,0.25)",
                fontFamily: "var(--font-body)",
              }}>
                Estimates only · Free · No obligation
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </>
  );
}
