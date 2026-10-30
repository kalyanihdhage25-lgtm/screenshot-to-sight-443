import type { Level } from "@/lib/telemetry/types";

export const levelText: Record<Level, string> = {
  safe: "text-safe",
  warning: "text-warning",
  critical: "text-critical",
  idle: "text-idle",
};

export const levelBg: Record<Level, string> = {
  safe: "bg-safe",
  warning: "bg-warning",
  critical: "bg-critical",
  idle: "bg-idle",
};

export const levelBorder: Record<Level, string> = {
  safe: "border-safe/40",
  warning: "border-warning/50",
  critical: "border-critical/60",
  idle: "border-border",
};

export const levelGlow: Record<Level, string> = {
  safe: "",
  warning: "glow-warning",
  critical: "glow-critical",
  idle: "",
};

/** Read a CSS custom property (e.g. "--ecg") for canvas drawing. */
export function cssVar(name: string, fallback = "#22c55e") {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Same color with alpha, using color-mix so oklch tokens work on canvas. */
export function withAlpha(color: string, alpha: number) {
  return `color-mix(in oklab, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}
