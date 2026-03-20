"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Lead {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  zip_code: string;
  city: string | null;
  state: string | null;
  monthly_bill: number;
  score: number;
  tier: "hot" | "medium" | "cold";
  status: string;
  preferred_financing: string | null;
  estimated_monthly_savings: number | null;
  contact_preference: string;
  created_at: string;
  sold_price: number | null;
  commission_earned: number | null;
}

interface Stats {
  total_leads: number;
  hot_leads: number;
  medium_leads: number;
  cold_leads: number;
  converted: number;
  total_commission: number;
  total_sold_value: number;
  avg_score: number;
  today_leads: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const TIER_COLORS = {
  hot: { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" },
  medium: { bg: "#DBEAFE", text: "#2563EB", border: "#BFDBFE" },
  cold: { bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: "#DCFCE7", text: "#16A34A" },
  contacted: { bg: "#DBEAFE", text: "#2563EB" },
  appointment_set: { bg: "#FEF3C7", text: "#D97706" },
  quoted: { bg: "#F3E8FF", text: "#9333EA" },
  converted: { bg: "#DCFCE7", text: "#15803D" },
  sold: { bg: "#FFF7ED", text: "#EA580C" },
  lost: { bg: "#FEE2E2", text: "#DC2626" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function TierBadge({ tier }: { tier: keyof typeof TIER_COLORS }) {
  const c = TIER_COLORS[tier];
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: "999px", padding: "3px 10px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {tier === "hot" ? "🔥 " : tier === "medium" ? "⚡ " : "❄️ "}{tier}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || { bg: "#F3F4F6", text: "#6B7280" };
  return (
    <span style={{ background: c.bg, color: c.text, borderRadius: "999px", padding: "3px 10px", fontSize: "0.72rem", fontWeight: 700 }}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterTier, setFilterTier] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(filterTier && { tier: filterTier }),
        ...(filterStatus && { status: filterStatus }),
        ...(search && { search }),
      });
      const res = await fetch(`/api/admin/leads?${params}`);
      if (res.status === 401) { router.push("/admin"); return; }
      const data = await res.json();
      setLeads(data.leads || []);
      setStats(data.stats || null);
      setPagination(data.pagination || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filterTier, filterStatus, search, router]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const updateLeadStatus = async (id: number, status: string) => {
    setUpdating(true);
    try {
      await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      fetchLeads();
      if (selectedLead?.id === id) setSelectedLead(prev => prev ? { ...prev, status } : null);
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin");
  };

  const totalRevenue = stats ? ((stats.total_commission || 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" }) : "$0";

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F0F", fontFamily: "var(--font-body)", color: "white" }}>
      {/* Header */}
      <div style={{ background: "#1A1A1A", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>☀</span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "1.1rem", color: "white" }}>SolarAdvisor</span>
          <span style={{ background: "rgba(255,140,0,0.2)", color: "var(--sun-flare)", borderRadius: 6, padding: "2px 8px", fontSize: "0.7rem", fontWeight: 700 }}>ADMIN</span>
        </div>
        <button onClick={handleLogout} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", borderRadius: "999px", padding: "6px 16px", fontSize: "0.8rem", cursor: "pointer" }}>
          Sign Out
        </button>
      </div>

      <div style={{ padding: "24px" }}>
        {/* Stats row */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Total Leads", val: stats.total_leads?.toLocaleString() || "0", color: "var(--sun-glow)", icon: "👥" },
              { label: "Hot Leads", val: stats.hot_leads?.toString() || "0", color: "#EF4444", icon: "🔥" },
              { label: "Today", val: stats.today_leads?.toString() || "0", color: "#22C55E", icon: "📅" },
              { label: "Converted", val: stats.converted?.toString() || "0", color: "#A78BFA", icon: "✅" },
              { label: "Avg Score", val: `${Math.round(stats.avg_score || 0)}/100`, color: "var(--sun-flare)", icon: "📊" },
              { label: "Revenue", val: totalRevenue, color: "#22C55E", icon: "💰" },
            ].map(s => (
              <div key={s.label} style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px" }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem", color: s.color }}>{s.val}</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tier breakdown */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { tier: "hot", count: stats.hot_leads, label: "🔥 Hot Leads", color: "#F59E0B", desc: "Score 75-100" },
              { tier: "medium", count: stats.medium_leads, label: "⚡ Medium Leads", color: "#3B82F6", desc: "Score 45-74" },
              { tier: "cold", count: stats.cold_leads, label: "❄️ Cold Leads", color: "#6B7280", desc: "Score 0-44" },
            ].map(t => {
              const pct = stats.total_leads ? Math.round((t.count / stats.total_leads) * 100) : 0;
              return (
                <div key={t.tier}
                  onClick={() => setFilterTier(filterTier === t.tier ? "" : t.tier)}
                  style={{
                    background: filterTier === t.tier ? "rgba(255,140,0,0.1)" : "#1A1A1A",
                    border: filterTier === t.tier ? "1px solid var(--sun-flare)" : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14, padding: "16px", cursor: "pointer", transition: "all 0.2s",
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{t.label}</span>
                    <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>{t.desc}</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.8rem", color: t.color, marginBottom: 8 }}>{t.count || 0}</div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: "999px" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: t.color, borderRadius: "999px", transition: "width 0.5s ease" }} />
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{pct}% of all leads</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              placeholder="Search name, email, phone, ZIP..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setSearch(searchInput), setPage(1))}
              style={{
                width: "100%", padding: "9px 14px", background: "#1A1A1A",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
                color: "white", fontSize: "0.875rem", outline: "none", fontFamily: "var(--font-body)",
              }}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            style={{ padding: "9px 14px", background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "white", fontSize: "0.875rem", outline: "none" }}
          >
            <option value="">All Status</option>
            {["new", "contacted", "appointment_set", "quoted", "converted", "sold", "lost"].map(s => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
          {(filterTier || filterStatus || search) && (
            <button
              onClick={() => { setFilterTier(""); setFilterStatus(""); setSearch(""); setSearchInput(""); setPage(1); }}
              style={{ padding: "9px 16px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "#FCA5A5", fontSize: "0.85rem", cursor: "pointer" }}
            >
              ✕ Clear
            </button>
          )}
          <button
            onClick={fetchLeads}
            style={{ padding: "9px 16px", background: "rgba(255,140,0,0.15)", border: "1px solid rgba(255,140,0,0.3)", borderRadius: 10, color: "var(--sun-flare)", fontSize: "0.85rem", cursor: "pointer" }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* Table */}
        <div style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Lead", "Location", "Bill", "Score", "Tier", "Status", "Financing", "Savings Est.", "Date", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
                      <span style={{ fontSize: 24, display: "block", animation: "spin 0.8s linear infinite" }}>☀</span>
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.9rem" }}>
                      No leads found
                    </td>
                  </tr>
                ) : leads.map((lead, i) => (
                  <tr key={lead.id}
                    onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: selectedLead?.id === lead.id ? "rgba(255,140,0,0.06)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                      cursor: "pointer", transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => { if (selectedLead?.id !== lead.id) (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={(e) => { if (selectedLead?.id !== lead.id) (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"; }}
                  >
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ fontWeight: 600, color: "white" }}>{lead.first_name} {lead.last_name}</div>
                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>{lead.email}</div>
                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>{lead.phone}</div>
                    </td>
                    <td style={{ padding: "12px 14px", color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" }}>
                      {lead.zip_code}{lead.state ? ` · ${lead.state}` : ""}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--sun-glow)" }}>${lead.monthly_bill}/mo</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `conic-gradient(var(--sun-core) ${lead.score * 3.6}deg, rgba(255,255,255,0.1) 0deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1A1A1A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 700, color: "var(--sun-glow)" }}>
                            {lead.score}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}><TierBadge tier={lead.tier} /></td>
                    <td style={{ padding: "12px 14px" }}><StatusBadge status={lead.status} /></td>
                    <td style={{ padding: "12px 14px", color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", textTransform: "capitalize" }}>{lead.preferred_financing || "—"}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "#22C55E" }}>
                      {lead.estimated_monthly_savings ? `$${lead.estimated_monthly_savings}/mo` : "—"}
                    </td>
                    <td style={{ padding: "12px 14px", color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>{formatDate(lead.created_at)}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <select
                        value={lead.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { e.stopPropagation(); updateLeadStatus(lead.id, e.target.value); }}
                        disabled={updating}
                        style={{
                          padding: "5px 8px", background: "#2A2A2A",
                          border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
                          color: "white", fontSize: "0.78rem", cursor: "pointer", outline: "none",
                        }}
                      >
                        {["new", "contacted", "appointment_set", "quoted", "converted", "sold", "lost"].map(s => (
                          <option key={s} value={s}>{s.replace("_", " ")}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>
                Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total.toLocaleString()} leads
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ padding: "6px 12px", background: page <= 1 ? "rgba(255,255,255,0.05)" : "rgba(255,140,0,0.15)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: page <= 1 ? "rgba(255,255,255,0.2)" : "var(--sun-flare)", cursor: page <= 1 ? "not-allowed" : "pointer", fontSize: "0.82rem" }}
                >← Prev</button>
                <span style={{ padding: "6px 12px", fontSize: "0.82rem", color: "rgba(255,255,255,0.5)" }}>{page} / {pagination.pages}</span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={page >= pagination.pages}
                  style={{ padding: "6px 12px", background: page >= pagination.pages ? "rgba(255,255,255,0.05)" : "rgba(255,140,0,0.15)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: page >= pagination.pages ? "rgba(255,255,255,0.2)" : "var(--sun-flare)", cursor: page >= pagination.pages ? "not-allowed" : "pointer", fontSize: "0.82rem" }}
                >Next →</button>
              </div>
            </div>
          )}
        </div>

        {/* Lead detail panel */}
        {selectedLead && (
          <div style={{ marginTop: 20, background: "#1A1A1A", border: "1px solid rgba(255,140,0,0.3)", borderRadius: 16, padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.2rem", color: "white" }}>
                {selectedLead.first_name} {selectedLead.last_name} — Lead #{selectedLead.id}
              </h3>
              <button onClick={() => setSelectedLead(null)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {[
                { label: "Email", val: selectedLead.email },
                { label: "Phone", val: selectedLead.phone },
                { label: "Location", val: `${selectedLead.zip_code}${selectedLead.city ? `, ${selectedLead.city}` : ""}${selectedLead.state ? ` ${selectedLead.state}` : ""}` },
                { label: "Monthly Bill", val: `$${selectedLead.monthly_bill}/mo` },
                { label: "Lead Score", val: `${selectedLead.score}/100` },
                { label: "Est. Monthly Savings", val: selectedLead.estimated_monthly_savings ? `$${selectedLead.estimated_monthly_savings}/mo` : "N/A" },
                { label: "Preferred Financing", val: selectedLead.preferred_financing || "N/A" },
                { label: "Contact Preference", val: selectedLead.contact_preference },
                { label: "Submitted", val: formatDate(selectedLead.created_at) },
              ].map(f => (
                <div key={f.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{f.label}</div>
                  <div style={{ color: "white", fontWeight: 500, fontSize: "0.9rem" }}>{f.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
