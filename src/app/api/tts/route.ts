import { NextResponse } from "next/server";
import OpenAI from "openai";

// POST /api/tts  { text }
// Uses OpenAI TTS API. Falls back to a 503 if no key is configured.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { text } = body as { text?: string };
  if (!text || !text.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  const input = text.slice(0, 1000);

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("[tts] failed:", e);
    return NextResponse.json({ error: "tts failed" }, { status: 500 });
  }
}
