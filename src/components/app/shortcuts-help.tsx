"use client";

import { useSaliStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard, Command, CornerDownLeft } from "lucide-react";

const SHORTCUT_GROUPS = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["⌘", "K"], label: "Command palette" },
      { keys: ["⌘", "."], label: "Toggle presentation mode" },
      { keys: ["?"], label: "Show this help" },
      { keys: ["g", "c"], label: "Go to Command Center" },
      { keys: ["g", "l"], label: "Go to Unified Liquidity" },
      { keys: ["g", "t"], label: "Go to Transactions" },
      { keys: ["g", "a"], label: "Go to Anomaly Review" },
      { keys: ["g", "o"], label: "Go to Coordination" },
      { keys: ["g", "n"], label: "Go to Network Hotspots" },
      { keys: ["g", "r"], label: "Go to Relationship Graph" },
      { keys: ["g", "w"], label: "Go to What-If Simulator" },
      { keys: ["g", "i"], label: "Go to AI Assistant" },
      { keys: ["g", "u"], label: "Go to Audit Trail" },
      { keys: ["g", "m"], label: "Go to Metrics" },
      { keys: ["g", "s"], label: "Go to Simulation" },
    ],
  },
  {
    title: "Coordination (when a case is selected)",
    shortcuts: [
      { keys: ["A"], label: "Acknowledge case" },
      { keys: ["E"], label: "Escalate case" },
      { keys: ["R"], label: "Resolve case" },
    ],
  },
  {
    title: "Command Palette",
    shortcuts: [
      { keys: ["↑", "↓"], label: "Navigate results" },
      { keys: ["↵"], label: "Select item" },
      { keys: ["esc"], label: "Close" },
    ],
  },
];

export function ShortcutsHelp() {
  const helpOpen = useSaliStore((s) => s.helpOpen);
  const setHelpOpen = useSaliStore((s) => s.setHelpOpen);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <DialogTitle className="sr-only">Keyboard Shortcuts</DialogTitle>

        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border">
          <div className="grid place-items-center w-8 h-8 rounded-lg bg-primary/15 text-primary">
            <Keyboard className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Keyboard Shortcuts</div>
            <div className="text-[10.5px] text-muted-foreground">Press ? anytime to toggle this help</div>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto scroll-thin p-4 space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                {group.title}
              </div>
              <div className="space-y-1.5">
                {group.shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-1">
                    <span className="text-[12.5px] text-foreground/90">{s.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="min-w-[24px] text-center text-[10px] font-medium border border-border bg-muted/40 rounded px-1.5 py-0.5 text-foreground/80"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20 text-[10.5px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Command className="w-3 h-3" /> Shortcuts work globally (except in text inputs)
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" /> Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
