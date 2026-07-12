import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import OpenAI from "openai";

// POST /api/assistant  { question, role, history }
// Uses OpenAI API for the AI Assistant. Falls back to a safe template if
// the API is unavailable or no key is configured.

const SYSTEM_PREAMBLE = `You are SALI Assistant, an operations helper for a multi-provider mobile financial service "super agent" platform in Bangladesh (providers: bKash, Nagad, Rocket — all SYNTHETIC data).

ABSOLUTE RULES:
- Never use "fraud", "illegal", "scam", or "criminal".
- Never recommend blocking, freezing, accusing, or moving funds.
- Use careful language: "unusual", "requires review", "needs context".
- Preserve provider boundaries: never suggest cross-provider conversion/transfer.
- Always note that human review is required before any action.
- Be concise (3-6 sentences). Use plain words an agent or officer can act on.
- If the question is outside scope, politely decline and explain this is a synthetic decision-support prototype.`;

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

interface ContextSnapshot {
  kpis: Record<string, unknown>;
  topAlerts: { title: string; severity: string; status: string; agent: string; provider: string | null; scenarioTag: string | null }[];
  providerSummary: { code: string; name: string; totalBalance: number; totalCapacity: number; staleCount: number }[];
  agentPressure: { code: string; area: string; cashPct: number; status: string; alertCount: number }[];
  openCases: number;
  resolvedToday: number;
}

async function gatherContext(): Promise<ContextSnapshot> {
  const [agents, alerts, cases, balances, providers] = await Promise.all([
    db.agent.findMany({ include: { providerBalances: { include: { provider: true } } } }),
    db.alert.findMany({ where: { status: { not: "resolved" } }, include: { agent: true, provider: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.case.findMany(),
    db.agentProviderBalance.findMany({ include: { provider: true } }),
    db.provider.findMany(),
  ]);

  const activeAgents = agents.filter((a) => a.status === "active").length;
  const degradedAgents = agents.filter((a) => a.status !== "active").length;
  const openAlerts = alerts.length;
  const criticalAlerts = alerts.filter((a) => a.severity === "critical" || a.severity === "high").length;
  const totalCash = agents.reduce((s, a) => s + a.cashBalance, 0);
  const totalEmoney = balances.reduce((s, b) => s + b.balance, 0);
  const avgConfidence = balances.length > 0 ? balances.reduce((s, b) => s + b.confidence, 0) / balances.length : 0;
  const openCases = cases.filter((c) => c.status !== "resolved").length;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const resolvedToday = cases.filter((c) => c.status === "resolved" && c.resolvedAt && c.resolvedAt >= startOfDay).length;

  const providerSummary = providers.map((p) => {
    const pBalances = balances.filter((b) => b.providerId === p.id);
    return { code: p.code, name: p.name, totalBalance: Math.round(pBalances.reduce((s, b) => s + b.balance, 0)), totalCapacity: pBalances.reduce((s, b) => s + b.capacity, 0), staleCount: pBalances.filter((b) => b.isStale).length };
  });

  const agentPressure = agents.map((a) => ({ code: a.code, area: a.area, cashPct: Number((a.cashBalance / a.cashCapacity).toFixed(2)), status: a.status, alertCount: alerts.filter((al) => al.agentId === a.id).length }));

  return {
    kpis: { activeAgents, degradedAgents, openAlerts, criticalAlerts, totalCash: Math.round(totalCash), totalEmoney: Math.round(totalEmoney), avgConfidence: Number(avgConfidence.toFixed(2)), openCases, resolvedToday },
    topAlerts: alerts.map((a) => ({ title: a.title, severity: a.severity, status: a.status, agent: `${a.agent.code} (${a.agent.area})`, provider: a.provider?.name ?? null, scenarioTag: a.scenarioTag })),
    providerSummary,
    agentPressure,
    openCases,
    resolvedToday,
  };
}

function fallbackAnswer(question: string, ctx: ContextSnapshot): string {
  const q = question.toLowerCase();
  if (q.includes("shortage") || q.includes("running low") || q.includes("run out")) {
    const low = ctx.providerSummary.filter((p) => p.totalBalance / p.totalCapacity < 0.3);
    if (low.length > 0) return `Based on the current snapshot, ${low.map((p) => `${p.name} (${Math.round((p.totalBalance / p.totalCapacity) * 100)}%)`).join(", ")} are under liquidity pressure. This requires review — a field officer should confirm the demand pattern and arrange authorised provider support. No automatic action should be taken. (Synthetic data.)`;
    return `No provider is currently below the 30% threshold. All three providers have healthy aggregate balances. Continue monitoring. (Synthetic data.)`;
  }
  if (q.includes("anomaly") || q.includes("unusual") || q.includes("suspicious")) {
    return `There are currently ${ctx.kpis.openAlerts} open alerts (${ctx.kpis.criticalAlerts} critical/high). The top signals are: ${ctx.topAlerts.slice(0, 3).map((a) => `"${a.title}" at ${a.agent}`).join("; ")}. These are advisory only — unusual activity requires human review before any action. This is NOT proof of fraud. (Synthetic data.)`;
  }
  if (q.includes("agent") || q.includes("outlet") || q.includes("pressure")) {
    const pressured = ctx.agentPressure.filter((a) => a.cashPct < 0.3 || a.alertCount > 0).sort((a, b) => b.alertCount - a.alertCount);
    if (pressured.length > 0) return `The outlets under most pressure are: ${pressured.slice(0, 3).map((a) => `${a.code} (${a.area}, cash ${Math.round(a.cashPct * 100)}%, ${a.alertCount} alerts)`).join("; ")}. A field officer should contact these outlets and assess whether authorised support is needed. (Synthetic data.)`;
    return `All ${ctx.kpis.activeAgents} active agents are currently healthy with no significant pressure. (Synthetic data.)`;
  }
  if (q.includes("case") || q.includes("coordination") || q.includes("escalat")) {
    return `There are ${ctx.openCases} open coordination cases and ${ctx.resolvedToday} resolved today. Each case has a traceable audit trail. Important alerts should be acknowledged, assigned, and either resolved or escalated through the field → area → risk ladder. (Synthetic data.)`;
  }
  return `Network snapshot: ${ctx.kpis.activeAgents} active agents (${ctx.kpis.degradedAgents} degraded), ${ctx.kpis.openAlerts} open alerts (${ctx.kpis.criticalAlerts} critical/high), ${ctx.openCases} open cases, avg confidence ${Math.round((ctx.kpis.avgConfidence as number) * 100)}%. Shared cash: ${(ctx.kpis.totalCash as number).toLocaleString()} BDT. E-money: ${(ctx.kpis.totalEmoney as number).toLocaleString()} BDT. (Synthetic data — advisory only.)`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { question, role, history } = body as { question?: string; role?: string; history?: { role: "user" | "assistant"; content: string }[] };
  if (!question || !question.trim()) return NextResponse.json({ error: "question required" }, { status: 400 });

  const ctx = await gatherContext();
  const roleLabel = role ?? "ops_area";

  const contextPrompt = `You are answering for a user viewing as role: ${roleLabel}.\n\nLive network context (synthetic data, refreshed each turn):\n${JSON.stringify(ctx, null, 2)}\n\nAnswer concisely (3-6 sentences) using the context above. If the answer involves numbers, cite them. Always remind that this is advisory and human review is required.`;

  const messages: { role: string; content: string }[] = [
    { role: "system", content: SYSTEM_PREAMBLE },
    { role: "system", content: contextPrompt },
  ];
  const recentHistory = (history ?? []).slice(-6);
  for (const h of recentHistory) messages.push({ role: h.role === "user" ? "user" : "assistant", content: h.content });
  messages.push({ role: "user", content: question });

  // Try OpenAI
  const openai = getOpenAI();
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages as any,
        max_tokens: 300,
      });
      const answer = completion.choices[0]?.message?.content?.trim();
      if (answer && answer.length > 0) {
        return NextResponse.json({ ok: true, answer, source: "ai", context: { openAlerts: ctx.kpis.openAlerts, openCases: ctx.openCases } });
      }
    } catch (e) {
      console.error("[assistant] OpenAI failed, using fallback:", e);
    }
  }

  return NextResponse.json({ ok: true, answer: fallbackAnswer(question, ctx), source: "fallback", context: { openAlerts: ctx.kpis.openAlerts, openCases: ctx.openCases } });
}
