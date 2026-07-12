"use client";

import { useEffect } from "react";
import { useSaliStore } from "@/lib/store";
import { toast } from "sonner";

// Global keyboard shortcuts for the SALI platform.
// - Cmd/Ctrl+K: command palette
// - Cmd/Ctrl+.: toggle presentation mode (hide chrome)
// - g c / g l / g a / g n / g s: quick view switching (vim-style)
// - ?: show shortcuts help (via toast)
export function useKeyboardShortcuts() {
  const setPaletteOpen = useSaliStore((s) => s.setPaletteOpen);
  const setView = useSaliStore((s) => s.setView);
  const paletteOpen = useSaliStore((s) => s.paletteOpen);
  const presentationMode = useSaliStore((s) => s.presentationMode);
  const setPresentationMode = useSaliStore((s) => s.setPresentationMode);

  useEffect(() => {
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    function handler(e: KeyboardEvent) {
      // Don't interfere with text inputs
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.tagName === "SELECT";

      // Cmd/Ctrl+K always works
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(!useSaliStore.getState().paletteOpen);
        return;
      }

      // Cmd/Ctrl+. toggles presentation mode
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        const next = !useSaliStore.getState().presentationMode;
        setPresentationMode(next);
        toast.info(next ? "Presentation mode on" : "Presentation mode off", {
          description: next ? "Sidebar & topbar hidden. Press ⌘. again to exit." : "Chrome restored.",
          duration: 2500,
        });
        return;
      }

      if (isInput || paletteOpen) return;

      // "g" prefix for view switching (vim-style: g then letter)
      if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        gPressed = true;
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPressed = false; }, 800);
        return;
      }

      if (gPressed) {
        const views: Record<string, string> = {
          c: "command",
          l: "liquidity",
          t: "transactions",
          a: "anomalies",
          o: "coordination",
          n: "network",
          r: "relationships",
          w: "whatif",
          s: "simulation",
          m: "metrics",
          u: "audit",
          i: "assistant",
        };
        const v = views[e.key.toLowerCase()];
        if (v) {
          e.preventDefault();
          setView(v as any);
          toast.success(`→ ${v}`, { duration: 1200 });
        }
        gPressed = false;
        if (gTimer) clearTimeout(gTimer);
        return;
      }

      // "?" shows shortcuts help modal
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        useSaliStore.getState().setHelpOpen(!useSaliStore.getState().helpOpen);
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [setPaletteOpen, setView, paletteOpen, setPresentationMode, presentationMode]);
}
