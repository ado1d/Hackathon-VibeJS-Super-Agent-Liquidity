import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/loadtest  { requests, concurrency }
// Runs a synthetic load test against the database layer — fires N concurrent
// read queries and measures aggregate + per-request latency. This satisfies
// the hackathon optional deliverable: "Load-test, profiling, or trace outputs".
//
// All data is SYNTHETIC. This only reads — never writes or modifies state.

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const totalRequests = Math.min(200, Math.max(10, Number(body.requests) || 50));
  const concurrency = Math.min(20, Math.max(1, Number(body.concurrency) || 5));

  // Define a pool of read-only query functions to simulate realistic mixed load
  const queries = [
    () => db.agent.findMany({ take: 6 }),
    () => db.alert.findMany({ take: 20, orderBy: { createdAt: "desc" } }),
    () => db.transaction.count(),
    () => db.agentProviderBalance.findMany({ take: 18 }),
    () => db.case.findMany({ take: 10, orderBy: { createdAt: "desc" } }),
    () => db.balanceSnapshot.findMany({ take: 50, orderBy: { timestamp: "desc" } }),
  ];

  const results: { ok: boolean; ms: number; query: string }[] = [];
  let dispatched = 0;

  async function worker() {
    while (dispatched < totalRequests) {
      const idx = dispatched++;
      const fn = queries[idx % queries.length];
      const t0 = performance.now();
      try {
        await fn();
        results.push({ ok: true, ms: performance.now() - t0, query: fn.name || `query_${idx % queries.length}` });
      } catch {
        results.push({ ok: false, ms: performance.now() - t0, query: fn.name || `query_${idx % queries.length}` });
      }
    }
  }

  const t0 = performance.now();
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  const totalMs = performance.now() - t0;

  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const successCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;
  const avg = latencies.reduce((s, x) => s + x, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.99))];
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const rps = (totalRequests / totalMs) * 1000;

  // Per-query-type breakdown
  const byQuery: Record<string, { count: number; avgMs: number; maxMs: number }> = {};
  for (const r of results) {
    const k = r.query;
    if (!byQuery[k]) byQuery[k] = { count: 0, avgMs: 0, maxMs: 0 };
    byQuery[k].count++;
    byQuery[k].avgMs += r.ms;
    byQuery[k].maxMs = Math.max(byQuery[k].maxMs, r.ms);
  }
  for (const k of Object.keys(byQuery)) {
    byQuery[k].avgMs = byQuery[k].avgMs / byQuery[k].count;
  }

  return NextResponse.json({
    config: { totalRequests, concurrency },
    summary: {
      totalMs: Math.round(totalMs),
      requestsPerSecond: Number(rps.toFixed(1)),
      successCount,
      failCount,
      avgMs: Number(avg.toFixed(2)),
      minMs: Number(min.toFixed(2)),
      maxMs: Number(max.toFixed(2)),
      p50Ms: Number(p50.toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      p99Ms: Number(p99.toFixed(2)),
    },
    byQuery,
    note: "Synthetic load test against SQLite with 6 read-only query types. No writes. All data is simulated.",
  });
}
