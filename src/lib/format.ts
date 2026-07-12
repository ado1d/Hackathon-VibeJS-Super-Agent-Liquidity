// Formatting helpers shared across the UI.

export function fmtBDT(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export function fmtTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function fmtRel(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function fmtHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} h`;
}

export function severityColor(sev: string): string {
  switch (sev) {
    case "critical":
      return "text-rose-300 bg-rose-500/15 border-rose-500/30";
    case "high":
      return "text-orange-300 bg-orange-500/15 border-orange-500/30";
    case "warning":
      return "text-amber-300 bg-amber-500/15 border-amber-500/30";
    default:
      return "text-sky-300 bg-sky-500/15 border-sky-500/30";
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case "resolved":
      return "text-emerald-300 bg-emerald-500/15 border-emerald-500/30";
    case "escalated":
      return "text-rose-300 bg-rose-500/15 border-rose-500/30";
    case "owned":
    case "assigned":
      return "text-violet-300 bg-violet-500/15 border-violet-500/30";
    case "acknowledged":
      return "text-sky-300 bg-sky-500/15 border-sky-500/30";
    default:
      return "text-muted-foreground bg-muted/40 border-border";
  }
}

export function confidenceColor(label: string): string {
  switch (label) {
    case "high":
      return "text-emerald-300 bg-emerald-500/15 border-emerald-500/30";
    case "medium":
      return "text-amber-300 bg-amber-500/15 border-amber-500/30";
    default:
      return "text-rose-300 bg-rose-500/15 border-rose-500/30";
  }
}

export function providerClasses(code: string): { text: string; bg: string; border: string; dot: string } {
  switch (code) {
    case "bkash":
      return { text: "text-pink-300", bg: "bg-pink-500/10", border: "border-pink-500/30", dot: "bg-pink-400" };
    case "nagad":
      return { text: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/30", dot: "bg-orange-400" };
    case "rocket":
      return { text: "text-violet-300", bg: "bg-violet-500/10", border: "border-violet-500/30", dot: "bg-violet-400" };
    default:
      return { text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-400" };
  }
}
