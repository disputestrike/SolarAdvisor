import { NextRequest, NextResponse } from "next/server";

// ─── Prompt library for solar contexts ───────────────────────────────────────
const PROMPTS: Record<string, string> = {
  hero_family:
    "Photo-realistic image of a happy American family of four standing in front of their suburban home with solar panels on the roof, bright sunny day, blue sky, green lawn, warm golden sunlight, professional real estate photography style, 8K resolution, no text",

  hero_home_panels:
    "Photo-realistic aerial view of a beautiful suburban home with black solar panels installed on a south-facing roof, sunny day, perfect blue sky with a few white clouds, green trees in yard, high-end real estate photography, ultra-detailed, 8K",

  roof_overlay:
    "Photo-realistic top-down aerial view of a residential suburban home roof with modern black monocrystalline solar panels installed in perfect rows, clean professional installation, bright sunlight, high-resolution drone photography, no text or labels",

  savings_couple:
    "Photo-realistic image of a smiling couple reviewing their energy bill at a kitchen table, looking happy and relieved, modern American home interior, warm natural lighting, laptop open showing charts, professional lifestyle photography, 8K",

  installer_working:
    "Photo-realistic image of a professional solar panel installer in safety gear installing black solar panels on a residential roof, bright sunny day, blue sky, safety equipment visible, professional construction photography, ultra-realistic, 8K",

  neighborhood_solar:
    "Photo-realistic aerial photograph of an American suburban neighborhood with multiple homes having solar panels on their roofs, bright sunny day, green trees, perfect blue sky, drone photography style, ultra-detailed, 8K",

  testimonial_home:
    "Photo-realistic image of a beautiful modern American single-family home with solar panels on the roof, manicured green lawn, bright sunny day, blue sky, suburban neighborhood, professional real estate photography, warm golden hour lighting, 8K",
};

// ─── Google Vertex AI Imagen ──────────────────────────────────────────────────
async function generateWithVertexAI(prompt: string): Promise<string | null> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  const token = process.env.GOOGLE_CLOUD_ACCESS_TOKEN;

  if (!projectId || !token) return null;

  try {
    const res = await fetch(
      `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagegeneration@006:predict`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "16:9",
            safetyFilterLevel: "block_some",
            personGeneration: "allow_adult",
          },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) return null;
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}

// ─── Stable Diffusion fallback (Hugging Face Inference API) ──────────────────
async function generateWithHuggingFace(prompt: string): Promise<string | null> {
  const token = process.env.HUGGING_FACE_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            negative_prompt:
              "cartoon, illustration, painting, drawing, art, sketch, animated, text, watermark, logo, blurry, low quality, distorted",
            num_inference_steps: 30,
            guidance_scale: 7.5,
          },
        }),
        signal: AbortSignal.timeout(60000),
      }
    );

    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return null;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "hero_home_panels";
  const customPrompt = req.nextUrl.searchParams.get("prompt");

  const prompt = customPrompt || PROMPTS[type] || PROMPTS.hero_home_panels;

  // Try Vertex AI first, then Hugging Face
  let imageData = await generateWithVertexAI(prompt);
  if (!imageData) {
    imageData = await generateWithHuggingFace(prompt);
  }

  if (!imageData) {
    // Return SVG placeholder that looks real enough for layout
    return NextResponse.json(
      {
        success: false,
        fallback: true,
        message: "Configure GOOGLE_CLOUD_PROJECT_ID + GOOGLE_CLOUD_ACCESS_TOKEN or HUGGING_FACE_TOKEN",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ success: true, image: imageData, type, prompt });
}

export async function POST(req: NextRequest) {
  const { prompt, type } = await req.json();
  const finalPrompt = prompt || PROMPTS[type] || PROMPTS.hero_home_panels;

  let imageData = await generateWithVertexAI(finalPrompt);
  if (!imageData) imageData = await generateWithHuggingFace(finalPrompt);

  if (!imageData) {
    return NextResponse.json({ success: false, fallback: true }, { status: 503 });
  }

  return NextResponse.json({ success: true, image: imageData });
}
