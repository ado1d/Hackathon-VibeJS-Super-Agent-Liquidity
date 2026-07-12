"use client";

import { ShieldCheck, AlertTriangle } from "lucide-react";
import { SAFETY_GUARDRAILS } from "@/lib/config";

// Sticky footer: reinforces the responsible-design boundary on every screen.
export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-background/80 backdrop-blur-xl">
      <div className="px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5 text-emerald-300 shrink-0">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="font-semibold">Responsible design</span>
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 truncate">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">
              {SAFETY_GUARDRAILS[(Math.floor(Date.now() / 6000)) % SAFETY_GUARDRAILS.length]}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground/70">
          SALI · Codex Community Hackathon · bKash presents SUST CSE Carnival 2026 ·{" "}
          <span className="text-muted-foreground">Synthetic data only</span>
        </div>
      </div>
    </footer>
  );
}
