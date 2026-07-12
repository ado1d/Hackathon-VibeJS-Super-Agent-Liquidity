import { NextResponse } from "next/server";
import { seedDatabase, resetDatabase } from "@/lib/simulate";

// POST /api/seed  -> ensures the synthetic dataset exists (idempotent)
// POST /api/seed?reset=1 -> wipes & re-seeds
export async function POST(req: Request) {
  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") === "1";
  if (reset) await resetDatabase();
  const result = await seedDatabase();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  return NextResponse.json({ ok: true, seeded: true });
}
