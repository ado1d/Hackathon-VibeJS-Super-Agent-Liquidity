"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/format";
import type { ReactNode } from "react";

// Animated number counter — smooth tween from previous to next value.
export function AnimatedNumber({
  value,
  format = (n: number) => Math.round(n).toLocaleString("en-IN"),
  duration = 600,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span className={cn("tnum", className)}>{format(display)}</span>;
}

export function ConfidenceBadge({ label, value }: { label: string; value?: number }) {
  const color =
    label === "high"
      ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
      : label === "medium"
      ? "text-amber-300 bg-amber-500/15 border-amber-500/30"
      : "text-rose-300 bg-rose-500/15 border-rose-500/30";
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border", color)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label} confidence{value !== undefined ? ` · ${Math.round(value * 100)}%` : ""}
    </span>
  );
}

export function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border", className)}>
      {children}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: string;
  icon?: ReactNode;
  tone?: "default" | "emerald" | "amber" | "rose" | "violet" | "sky";
  hint?: string;
}) {
  const toneClass = {
    default: "text-foreground",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
    violet: "text-violet-300",
    sky: "text-sky-300",
  }[tone];
  const ringClass = {
    default: "",
    emerald: "border-emerald-500/20",
    amber: "border-amber-500/20",
    rose: "border-rose-500/20",
    violet: "border-violet-500/20",
    sky: "border-sky-500/20",
  }[tone];
  return (
    <div className={cn("surface surface-hover rounded-xl p-4 flex flex-col gap-1.5", ringClass)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon && <span className={cn("opacity-70", toneClass)}>{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-2xl font-bold tracking-tight tnum", toneClass)}>{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {(delta || hint) && (
        <div className="text-[11px] text-muted-foreground truncate">
          {delta && <span className="text-muted-foreground">{delta}</span>}
          {hint && <span className="text-muted-foreground/70"> · {hint}</span>}
        </div>
      )}
    </div>
  );
}

export function SectionTitle({
  title,
  desc,
  right,
}: {
  title: string;
  desc?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function ProgressBar({ pct, tone = "emerald" }: { pct: number; tone?: string }) {
  const toneClass: Record<string, string> = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    violet: "bg-violet-400",
    sky: "bg-sky-400",
    pink: "bg-pink-400",
    orange: "bg-orange-400",
  };
  const color =
    pct < 0.2 ? "bg-rose-400" : pct < 0.4 ? "bg-amber-400" : toneClass[tone] ?? "bg-emerald-400";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }} />
    </div>
  );
}

export { fmtPct };

// Sparkline — tiny inline SVG trend line for balance cards.
export function Sparkline({
  data,
  color = "#34d399",
  width = 100,
  height = 28,
  fill = true,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`);
  const path = `M ${points.join(" L ")}`;
  const fillPath = `${path} L ${width},${height} L 0,${height} Z`;
  const gradId = `spark-${color.replace("#", "")}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && <path d={fillPath} fill={`url(#${gradId})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="draw-line" />
      <circle cx={width} cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2} r={2} fill={color} />
    </svg>
  );
}

