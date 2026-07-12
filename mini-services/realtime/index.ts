// Real-time coordination service for the Super Agent Liquidity & Risk
// Intelligence Platform.
//
// Responsibilities:
//  - Advance the live synthetic simulation on a fixed cadence.
//  - Re-run the explainable anomaly scan periodically and surface new findings.
//  - Broadcast lightweight "refresh" pings + payloads so connected dashboards
//    re-fetch authoritative detail from the Next.js API.
//
// NOTE: This service shares the same SQLite database as the Next.js app. It
// imports the simulation + prisma modules from the host project via relative
// paths. All data remains SYNTHETIC.

import { createServer } from "http";
import { Server } from "socket.io";

// Resolve host-project libs via relative paths.
const HOST = "../..";
const db = (await import(`${HOST}/src/lib/db.ts`)).db;
const simulate = (await import(`${HOST}/src/lib/simulate.ts`));
const anomaly = (await import(`${HOST}/src/lib/anomaly.ts`));

const httpServer = createServer();
const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = 3001;

interface BroadcastPayload {
  ts: string;
  tick?: { newTxns: number; agents: number };
  newAlerts?: { id: string; title: string; agentCode: string; severity: string }[];
  event: "tick" | "scan" | "status";
}

function broadcast(p: BroadcastPayload) {
  io.emit("sali:update", p);
}

async function ensureSeeded() {
  try {
    await simulate.seedDatabase();
  } catch (e) {
    console.error("[seed] failed:", e);
  }
}

async function runTick() {
  try {
    const summary = await simulate.simulationTick();
    broadcast({ ts: new Date().toISOString(), event: "tick", tick: summary });
    console.log(`[tick] ${summary.newTxns} new txns across ${summary.agents} agents`);
  } catch (e) {
    console.error("[tick] failed:", e);
  }
}

async function runScan() {
  try {
    const findings = await anomaly.runAnomalyScan();
    const created: { id: string; title: string; agentCode: string; severity: string }[] = [];
    const { db: DB } = await import(`${HOST}/src/lib/db.ts`);
    for (const f of findings) {
      const dup = await DB.alert.findFirst({
        where: {
          agentId: f.agentId,
          providerId: f.providerId,
          category: f.category,
          status: { not: "resolved" },
        },
      });
      if (dup) continue;
      const agent = await DB.agent.findUnique({ where: { id: f.agentId } });
      const alertType = f.category === "data_conflict" ? "data_quality" : "anomaly";
      const alert = await DB.alert.create({
        data: {
          agentId: f.agentId,
          providerId: f.providerId,
          type: alertType,
          category: f.category,
          severity: f.severity,
          title: f.title,
          message: f.message,
          evidence: JSON.stringify(f.evidence),
          confidence: f.confidence,
          confidenceLabel: f.confidenceLabel,
          status: "open",
        },
      });
      const ownerRole = f.category === "data_conflict" ? "ops_field" : "risk";
      const c = await DB.case.create({
        data: {
          alertId: alert.id,
          agentId: f.agentId,
          providerId: f.providerId,
          priority: f.severity === "high" || f.severity === "critical" ? "p1" : "p2",
          ownerRole,
          status: "open",
          escalationPath: JSON.stringify(["ops_field", "ops_area", "risk"]),
        },
      });
      await DB.caseEvent.create({
        data: {
          caseId: c.id,
          type: "created",
          actor: "Anomaly Engine",
          role: "system",
          note: `Detected by ${f.category} detector. Confidence ${f.confidence}. Advisory only.`,
          createdAt: new Date(),
        },
      });
      created.push({
        id: alert.id,
        title: f.title,
        agentCode: agent?.code ?? "?",
        severity: f.severity,
      });
    }
    if (created.length > 0) {
      broadcast({ ts: new Date().toISOString(), event: "scan", newAlerts: created });
      console.log(`[scan] ${created.length} new alert(s) surfaced`);
    }
  } catch (e) {
    console.error("[scan] failed:", e);
  }
}

io.on("connection", (socket) => {
  console.log(`[io] client connected: ${socket.id}`);
  socket.emit("sali:hello", { ts: new Date().toISOString(), port: PORT });
  socket.on("disconnect", () => console.log(`[io] client disconnected: ${socket.id}`));
});

async function start() {
  await ensureSeeded();
  httpServer.listen(PORT, () => {
    console.log(`[sali-realtime] listening on :${PORT}`);
  });
  // Cadence: tick every 9s, anomaly scan every 35s.
  setInterval(runTick, 9_000);
  setInterval(runScan, 35_000);
  // initial runs
  setTimeout(runTick, 1500);
  setTimeout(runScan, 4000);
}

start();

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0));
});
