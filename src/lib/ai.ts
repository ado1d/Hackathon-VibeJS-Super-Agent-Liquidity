import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import OpenAI from "openai";
import type { AiExplanation, AlertSeverity } from "@/lib/types";

// AI explanation service — uses OpenAI if OPENAI_API_KEY is set, otherwise
// falls back to a safe hand-authored template.

const SAFETY_PREAMBLE = `You are an operations assistant for a multi-provider mobile financial service "super agent" prototype in Bangladesh (providers: bKash, Nagad, Rocket — all SYNTHETIC data).

ABSOLUTE RULES (never break):
- Never use the word "fraud", "illegal", "scam", or "criminal".
- Never recommend blocking a user, freezing funds, or accusing anyone.
- Use careful language: "unusual", "requires review", "needs context".
- Preserve provider boundaries: never suggest moving/convert/cross-provider transfer of balances.
- Always include: situation, evidence, uncertainty, and a SAFE next step.
- Keep each field to 1-2 short sentences. Plain words an agent can act on.`;

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export async function explainAlert(opts: {
  type: "liquidity" | "anomaly" | "data_quality";
  severity: AlertSeverity;
  agentName: string;
  agentArea: string;
  providerName: string | null;
  evidenceSummary: string;
  facts: { label: string; value: string }[];
  language: "bn" | "en";
}): Promise<AiExplanation> {
  const factsBlock = opts.facts.map((f) => `- ${f.label}: ${f.value}`).join("\n");
  const providerTxt = opts.providerName ?? "shared physical cash";

  const userPrompt = `Write a careful ${opts.language === "bn" ? "Bengali (Bangla)" : "English"} advisory message for this alert.

Type: ${opts.type}
Severity: ${opts.severity}
Agent: ${opts.agentName} (${opts.agentArea})
Scope: ${providerTxt}
Evidence summary: ${opts.evidenceSummary}
Facts:
${factsBlock}

Respond as STRICT JSON with exactly these keys:
situation, evidence, uncertainty, safeNextStep
Each value is a short string in ${opts.language === "bn" ? "Bengali" : "English"}.`;

  // Try OpenAI
  const openai = getOpenAI();
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SAFETY_PREAMBLE },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 400,
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw);
      if (parsed && parsed.situation && parsed.safeNextStep) {
        return {
          situation: String(parsed.situation).slice(0, 400),
          evidence: String(parsed.evidence ?? "").slice(0, 400),
          uncertainty: String(parsed.uncertainty ?? "").slice(0, 400),
          safeNextStep: String(parsed.safeNextStep).slice(0, 400),
          language: opts.language,
        };
      }
    } catch (e) {
      console.error("[ai] OpenAI explainAlert failed, using fallback:", e);
    }
  }
  return fallbackExplanation(opts);
}

function safeParseJson(raw: string): Record<string, unknown> | null {
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { return null; } }
    return null;
  }
}

function fallbackExplanation(opts: {
  type: "liquidity" | "anomaly" | "data_quality";
  severity: AlertSeverity;
  agentName: string;
  providerName: string | null;
  evidenceSummary: string;
  language: "bn" | "en";
}): AiExplanation {
  const scope = opts.providerName ?? "shared physical cash";
  if (opts.language === "bn") {
    if (opts.type === "liquidity") {
      return { language: "bn", situation: `সতর্কতা: ${opts.agentName} এর ${scope} ব্যালেন্স দ্রুত কমছে।`, evidence: `${opts.evidenceSummary} এটি প্রক্রিয়াগত চাহিদা হতে পারে।`, uncertainty: "অনুমানের নির্ভুলতা মাঝারি। এটি চূড়ান্ত সিদ্ধান্ত নয়।", safeNextStep: "অনুগ্রহ করে প্রভাইডার অনুমোদিত চ্যানেলে যোগাযোগ করুন। কোনো স্বয়ংক্রিয় আর্থিক কাজ করবেন না।" };
    }
    if (opts.type === "anomaly") {
      return { language: "bn", situation: `${opts.agentName} এ ${scope} এ কিছু অস্বাভাবিক লেনদেন দেখা যাচ্ছে।`, evidence: `${opts.evidenceSummary} এটি স্বাভাবিক চাহিদাও হতে পারে।`, uncertainty: "এটি জালিয়াতির প্রমাণ নয়। মানুষের পর্যালোচনা প্রয়োজন।", safeNextStep: "ফিল্ড অফিসার আউটলেটের প্রেক্ষাপট যাচাই করুন। কাউকে ব্লক বা অভিযুক্ত করবেন না।" };
    }
    return { language: "bn", situation: `${opts.agentName} এর ${scope} ফিড বিলম্বিত বা অসঙ্গতিপূর্ণ হতে পারে।`, evidence: `${opts.evidenceSummary}`, uncertainty: "আস্থা কমানো হয়েছে।", safeNextStep: "তাজা ডেটা না আসা পর্যন্ত অপেক্ষা করুন।" };
  }
  if (opts.type === "liquidity") {
    return { language: "en", situation: `Heads-up: the ${scope} balance at ${opts.agentName} is draining fast.`, evidence: `${opts.evidenceSummary} This may be normal operational demand.`, uncertainty: "Estimate confidence is medium. This is not a final decision.", safeNextStep: "Contact the provider through authorised channels. Do not perform any automatic financial action." };
  }
  if (opts.type === "anomaly") {
    return { language: "en", situation: `Some unusual activity at ${opts.agentName} on ${scope} requires review.`, evidence: `${opts.evidenceSummary} This could be normal demand, or it may need review.`, uncertainty: "This is NOT proof of fraud. No decision should be taken without human review.", safeNextStep: "Field officer should verify the outlet context. Do not block or accuse anyone." };
  }
  return { language: "en", situation: `The ${scope} feed for ${opts.agentName} may be delayed or inconsistent.`, evidence: `${opts.evidenceSummary}`, uncertainty: "Confidence is reduced.", safeNextStep: "Wait for a fresh re-sync or cross-check with the agent." };
}

// POST /api/ai/explain  { alertId, language }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { alertId, language } = body as { alertId: string; language: "bn" | "en" };
  if (!alertId) return NextResponse.json({ error: "alertId required" }, { status: 400 });

  const alert = await db.alert.findUnique({ where: { id: alertId }, include: { agent: true, provider: true } });
  if (!alert) return NextResponse.json({ error: "alert not found" }, { status: 404 });

  let evidenceSummary = alert.message;
  let facts: { label: string; value: string }[] = [];
  try {
    const ev = JSON.parse(alert.evidence);
    if (ev.facts) facts = ev.facts;
    if (ev.summary) evidenceSummary = ev.summary;
  } catch { /* ignore */ }

  const explanation = await explainAlert({
    type: alert.type as "liquidity" | "anomaly" | "data_quality",
    severity: alert.severity as never,
    agentName: alert.agent.name,
    agentArea: alert.agent.area,
    providerName: alert.provider?.name ?? null,
    evidenceSummary,
    facts,
    language: language === "bn" ? "bn" : "en",
  });

  return NextResponse.json({ ok: true, explanation, source: "ai+fallback" });
}

export { safeParseJson };
