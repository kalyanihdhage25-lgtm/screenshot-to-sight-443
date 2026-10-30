import type { Level } from "./types";

/**
 * Safety limits shared by every card. Keep in sync with the ESP32 firmware
 * (DANGER_CM / WARNING_CM) so the machine-stop output matches the dashboard.
 */
export const LIMITS = {
  heartRate: { normalMin: 60, normalMax: 100, criticalMin: 50, criticalMax: 120 },
  spo2: { normalMin: 95, criticalBelow: 90 },
  bp: { warnSys: 130, warnDia: 85, critSys: 140, critDia: 90, lowSys: 90 },
  proximity: { dangerCm: 30, warningCm: 80, rangeCm: 200 },
  /** No packet for this long → ESP32 considered offline. */
  deviceTimeoutMs: 5000,
  /** No ECG samples for this long → "no signal". */
  ecgTimeoutMs: 2000,
} as const;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function heartRateLevel(bpm: number | null | undefined): Level {
  if (!isNum(bpm) || bpm <= 0) return "idle";
  const l = LIMITS.heartRate;
  if (bpm < l.criticalMin || bpm > l.criticalMax) return "critical";
  if (bpm < l.normalMin || bpm > l.normalMax) return "warning";
  return "safe";
}

export function spo2Level(pct: number | null | undefined): Level {
  if (!isNum(pct) || pct <= 0) return "idle";
  if (pct < LIMITS.spo2.criticalBelow) return "critical";
  if (pct < LIMITS.spo2.normalMin) return "warning";
  return "safe";
}

export function bpLevel(sys: number | null | undefined, dia: number | null | undefined): Level {
  if (!isNum(sys) || !isNum(dia) || sys <= 0 || dia <= 0) return "idle";
  const l = LIMITS.bp;
  if (sys >= l.critSys || dia >= l.critDia || sys < l.lowSys) return "critical";
  if (sys >= l.warnSys || dia >= l.warnDia) return "warning";
  return "safe";
}

export function proximityLevel(cm: number | null | undefined): Level {
  if (!isNum(cm) || cm <= 0) return "safe";
  if (cm < LIMITS.proximity.dangerCm) return "critical";
  if (cm < LIMITS.proximity.warningCm) return "warning";
  return "safe";
}

const RANK: Record<Level, number> = { idle: 0, safe: 1, warning: 2, critical: 3 };

export function worstLevel(...levels: Level[]): Level {
  return levels.reduce<Level>((w, l) => (RANK[l] > RANK[w] ? l : w), "idle");
}

export const LEVEL_LABEL: Record<Level, string> = {
  safe: "Normal",
  warning: "Warning",
  critical: "Critical",
  idle: "No data",
};
