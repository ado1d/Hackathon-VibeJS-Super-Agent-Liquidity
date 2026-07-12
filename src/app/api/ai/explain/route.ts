import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { explainAlert } from "@/lib/ai";

// POST /api/ai/explain  { alertId, language: 'bn' | 'en' }
// Generates a careful, explainable advisory message (situation / evidence /
// uncertainty / safe next step) in Bengali or English. Falls back to a safe
// hand-authored template if the LLM is unavailable.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { alertId, language } = body as { alertId: string; language: "bn" | "en" };
  if (!alertId) return NextResponse.json({ error: "alertId required" }, { status: 400 });

  const alert = await db.alert.findUnique({
    where: { id: alertId },
    include: { agent: true, provider: true },
  });
  if (!alert) return NextResponse.json({ error: "alert not found" }, { status: 404 });

  let evidenceSummary = alert.message;
  let facts: { label: string; value: string }[] = [];
  try {
    const ev = JSON.parse(alert.evidence);
    if (ev.facts) facts = ev.facts;
    if (ev.summary) evidenceSummary = ev.summary;
  } catch {
    /* ignore */
  }

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
