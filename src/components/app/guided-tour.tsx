"use client";

import { useEffect, useState } from "react";
import { useSaliStore, type ViewKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronRight,
  ChevronLeft,
  X,
  MapPin,
  Waves,
  ScanSearch,
  Users,
  Sparkles,
  ShieldCheck,
  Play,
  Pause,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

interface TourStep {
  id: number;
  title: string;
  scenario?: "A" | "B" | "C" | "D";
  view: ViewKey;
  description: string;
  whatToDoShow: string;
  icon: React.ElementType;
  tone: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 0,
    title: "Welcome to SALI",
    view: "command",
    description:
      "Super Agent Liquidity & Risk Intelligence — a decision-support platform for multi-provider mobile financial service agents (bKash, Nagad, Rocket). This tour walks you through the 4 hackathon demo scenarios. All data is SYNTHETIC.",
    whatToDoShow: "The Command Center shows live KPIs, provider pressure, alert feed, and agent network health.",
    icon: Sparkles,
    tone: "emerald",
  },
  {
    id: 1,
    title: "Scenario A — Hidden Provider Shortage",
    scenario: "A",
    view: "liquidity",
    description:
      "A multi-provider agent looks healthy in aggregate, but one provider's e-money is about to run out. The platform shows which provider is under pressure, when the shortage may happen, and how certain the estimate is.",
    whatToDoShow: "Look at the 4 balance cards + the 'Projected Shortages' section. The Nagad card shows a shortage ETA of ~1.5h with high confidence.",
    icon: Waves,
    tone: "amber",
  },
  {
    id: 2,
    title: "Scenario B — Liquidity + Unusual Activity",
    scenario: "B",
    view: "anomalies",
    description:
      "Physical cash is falling quickly AND one provider shows repeated near-identical amounts from a small customer group. The platform surfaces both the liquidity risk and the unusual pattern — with evidence and uncertainty. It never declares fraud.",
    whatToDoShow: "Find the 'Repeated ~4,900 BDT' alert. Expand it to see evidence, possible normal reasons, uncertainty, and the safe next step. Click 'Explain' for an AI advisory.",
    icon: ScanSearch,
    tone: "rose",
  },
  {
    id: 3,
    title: "Scenario C — Data Inconsistency",
    scenario: "C",
    view: "anomalies",
    description:
      "A provider feed is delayed or possibly conflicting. The platform warns about the data problem, reduces confidence, keeps provider balances separate, and avoids giving a misleading recommendation.",
    whatToDoShow: "Find the 'bKash feed delayed' alert. Notice the low confidence badge and the message that no confident recommendation is given.",
    icon: ScanSearch,
    tone: "violet",
  },
  {
    id: 4,
    title: "Scenario D — Coordinated Response",
    scenario: "D",
    view: "coordination",
    description:
      "A high-priority alert is routed, acknowledged, escalated, and resolved. The platform shows who received it, who owns it, the recommended next step, and the full audit trail — traceable end to end.",
    whatToDoShow: "Find the resolved case (Scenario D). Expand it to see the ownership, escalation path, and the complete audit trail timeline.",
    icon: Users,
    tone: "emerald",
  },
  {
    id: 5,
    title: "Responsible Design",
    view: "metrics",
    description:
      "Every alert uses careful language ('unusual', 'requires review'). The prototype never auto-blocks, freezes, accuses, or moves funds. Provider boundaries are preserved. Human review is always required.",
    whatToDoShow: "The Metrics & Validation view shows architecture, measured evidence, and the responsible-design note with actions intentionally NOT performed.",
    icon: ShieldCheck,
    tone: "emerald",
  },
];

const TONE_CLASSES: Record<string, { border: string; bg: string; text: string; icon: string }> = {
  emerald: { border: "border-emerald-500/40", bg: "bg-emerald-500/5", text: "text-emerald-300", icon: "bg-emerald-500/15 text-emerald-300" },
  amber: { border: "border-amber-500/40", bg: "bg-amber-500/5", text: "text-amber-300", icon: "bg-amber-500/15 text-amber-300" },
  rose: { border: "border-rose-500/40", bg: "bg-rose-500/5", text: "text-rose-300", icon: "bg-rose-500/15 text-rose-300" },
  violet: { border: "border-violet-500/40", bg: "bg-violet-500/5", text: "text-violet-300", icon: "bg-violet-500/15 text-violet-300" },
};

export function GuidedTour() {
  const tourOpen = useSaliStore((s) => s.tourOpen);
  const tourStep = useSaliStore((s) => s.tourStep);
  const setTourOpen = useSaliStore((s) => s.setTourOpen);
  const setTourStep = useSaliStore((s) => s.setTourStep);
  const setView = useSaliStore((s) => s.setView);
  const [autoPlay, setAutoPlay] = useState(false);
  const AUTO_ADVANCE_MS = 8000;

  const step = TOUR_STEPS[tourStep];
  const isLast = tourStep === TOUR_STEPS.length - 1;

  // Auto-advance timer for hands-free demo mode (must be before any early return)
  useEffect(() => {
    if (!tourOpen || !autoPlay || !step) return;
    const timer = setTimeout(() => {
      if (isLast) {
        setAutoPlay(false);
        setTourOpen(false);
        setTourStep(0);
        toast.success("Demo complete!", { description: "Auto-play finished all scenarios." });
      } else {
        const next = tourStep + 1;
        setTourStep(next);
        setView(TOUR_STEPS[next].view);
      }
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [tourOpen, autoPlay, tourStep, isLast, step, setTourOpen, setTourStep, setView]);

  if (!step) return null;
  const tone = TONE_CLASSES[step.tone] ?? TONE_CLASSES.emerald;
  const Icon = step.icon;

  function toggleAutoPlay() {
    setAutoPlay((v) => !v);
    if (!autoPlay) {
      toast.info("Demo mode on", { description: `Auto-advancing every ${AUTO_ADVANCE_MS / 1000}s. Click pause to stop.` });
    } else {
      toast.info("Demo mode paused");
    }
  }

  function goNext() {
    if (isLast) {
      setTourOpen(false);
      setTourStep(0);
      setAutoPlay(false);
      toast.success("Tour complete!", { description: "You've seen all 4 scenarios + responsible design." });
      return;
    }
    const next = tourStep + 1;
    setTourStep(next);
    setView(TOUR_STEPS[next].view);
  }

  function goPrev() {
    if (tourStep === 0) return;
    const prev = tourStep - 1;
    setTourStep(prev);
    setView(TOUR_STEPS[prev].view);
  }

  function skip() {
    setTourOpen(false);
    setTourStep(0);
  }

  // When opening the tour, jump to the step's view
  function handleOpenChange(open: boolean) {
    if (open) {
      setView(step.view);
    }
    setTourOpen(open);
  }

  return (
    <Dialog open={tourOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden border-l-4" style={{ borderLeftColor: step.tone === "amber" ? "#fbbf24" : step.tone === "rose" ? "#fb7185" : step.tone === "violet" ? "#a78bfa" : "#34d399" }}>
        <DialogTitle className="sr-only">{step.title}</DialogTitle>

        {/* Header with step indicator */}
        <div className={cn("flex items-center gap-3 p-4 border-b border-border", tone.bg)}>
          <div className={cn("grid place-items-center w-10 h-10 rounded-lg shrink-0", tone.icon)}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {step.scenario && (
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", tone.border, tone.text, tone.bg)}>
                  SCENARIO {step.scenario}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">Step {tourStep + 1} of {TOUR_STEPS.length}</span>
            </div>
            <h3 className="text-sm font-semibold mt-0.5">{step.title}</h3>
          </div>
          <button onClick={skip} className="grid place-items-center w-7 h-7 rounded-md hover:bg-muted/60 transition-colors shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-muted/40">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${((tourStep + 1) / TOUR_STEPS.length) * 100}%`,
              background: step.tone === "amber" ? "#fbbf24" : step.tone === "rose" ? "#fb7185" : step.tone === "violet" ? "#a78bfa" : "#34d399",
            }}
          />
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-[13px] text-foreground/90 leading-relaxed">{step.description}</p>

          <div className={cn("rounded-lg border p-3", tone.border, tone.bg)}>
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className={cn("w-3 h-3", tone.text)} />
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider", tone.text)}>What to look for</span>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">{step.whatToDoShow}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 p-4 border-t border-border bg-muted/20">
          {/* Step dots */}
          <div className="flex items-center gap-1.5 mr-auto">
            {TOUR_STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setTourStep(i); setView(s.view); }}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  i === tourStep ? "w-4 bg-primary" : i < tourStep ? "bg-primary/40" : "bg-muted-foreground/30"
                )}
                title={s.title}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={goPrev}
            disabled={tourStep === 0}
            className="h-8 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAutoPlay}
            className={cn("h-8 text-xs", autoPlay && "text-amber-300 bg-amber-500/10 hover:bg-amber-500/20")}
            title={autoPlay ? "Pause auto-play" : "Start hands-free demo (auto-advances every 8s)"}
          >
            {autoPlay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {autoPlay ? "Pause" : "Auto"}
          </Button>

          {isLast ? (
            <Button size="sm" onClick={goNext} className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
              <CheckCircle2 className="w-3.5 h-3.5" /> Finish
            </Button>
          ) : (
            <Button size="sm" onClick={goNext} className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Tour launcher button — placed in the topbar or command center
export function TourLauncher() {
  const setTourOpen = useSaliStore((s) => s.setTourOpen);
  const setTourStep = useSaliStore((s) => s.setTourStep);
  return (
    <button
      onClick={() => { setTourStep(0); setTourOpen(true); }}
      className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors"
      title="Start guided tour"
    >
      <Play className="w-3 h-3" /> Tour
    </button>
  );
}
