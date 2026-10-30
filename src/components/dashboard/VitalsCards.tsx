import { Droplets, Gauge, HeartPulse, PlugZap } from "lucide-react";
import {
  Area,
  AreaChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import { LIMITS, bpLevel, heartRateLevel, spo2Level } from "@/lib/telemetry/thresholds";
import type { Telemetry } from "@/lib/telemetry/useTelemetry";

import { Panel } from "./Panel";
import { levelText } from "./level";

export function HeartRateCard({ t }: { t: Telemetry }) {
  const hr = t.deviceOnline ? t.vitals.heartRate : null;
  const level = heartRateLevel(hr);
  const l = LIMITS.heartRate;
  const data = t.hrHistory.map((p) => ({ t: p.t, v: p.v }));

  return (
    <Panel title="Heart rate" icon={<HeartPulse />} level={level} className="min-h-[300px]">
      <div className="flex items-end gap-2">
        <span className={cn("readout text-6xl font-bold leading-none", levelText[level])}>
          {hr && hr > 0 ? Math.round(hr) : "--"}
        </span>
        <span className="mb-1 font-display text-sm uppercase tracking-wider text-muted-foreground">
          BPM
        </span>
        {hr && hr > 0 ? (
          <HeartPulse
            className={cn("mb-2 ml-1 size-5 animate-pulse", levelText[level])}
            style={{ animationDuration: `${60 / Math.max(30, hr)}s` }}
          />
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Normal {l.normalMin}–{l.normalMax} bpm · source MAX30100
      </p>
      <div className="mt-3 h-40 flex-1">
        {data.length < 2 ? (
          <EmptyChart text="Waiting for heart-rate readings…" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--safe)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--safe)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <ReferenceArea y1={l.normalMin} y2={l.normalMax} fill="var(--safe)" fillOpacity={0.06} />
              <ReferenceArea y1={l.normalMax} y2={l.criticalMax} fill="var(--warning)" fillOpacity={0.06} />
              <ReferenceArea y1={l.criticalMax} y2={200} fill="var(--critical)" fillOpacity={0.08} />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v) => new Date(v).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" })}
                stroke="var(--muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={[40, 160]}
                stroke="var(--muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                ticks={[50, 60, 100, 120, 150]}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
                labelFormatter={(v) => new Date(v as number).toLocaleTimeString([], { hour12: false })}
                formatter={(v) => [`${v} bpm`, "Heart rate"]}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--safe)"
                strokeWidth={2}
                fill="url(#hrFill)"
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

export function Spo2Card({ t }: { t: Telemetry }) {
  const spo2 = t.deviceOnline ? t.vitals.spo2 : null;
  const level = spo2Level(spo2);
  const pct = spo2 && spo2 > 0 ? Math.min(100, spo2) : 0;
  // Ring maps 70–100 % onto the full arc so small drops are visible.
  const frac = Math.max(0, Math.min(1, (pct - 70) / 30));
  const r = 62;
  const c = 2 * Math.PI * r;
  const ringColor =
    level === "critical" ? "var(--critical)" : level === "warning" ? "var(--warning)" : level === "safe" ? "var(--safe)" : "var(--idle)";

  return (
    <Panel title="Oxygen saturation" icon={<Droplets />} level={level} className="min-h-[300px]">
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="relative size-44">
          <svg viewBox="0 0 160 160" className="size-full -rotate-90">
            <circle cx="80" cy="80" r={r} fill="none" stroke="var(--muted)" strokeWidth="12" />
            <circle
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={ringColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - frac)}
              style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.4s" }}
            />
            {/* 90 % and 95 % markers */}
            {[90, 95].map((m) => {
              const a = ((m - 70) / 30) * Math.PI * 2;
              return (
                <line
                  key={m}
                  x1={80 + (r - 9) * Math.cos(a)}
                  y1={80 + (r - 9) * Math.sin(a)}
                  x2={80 + (r + 9) * Math.cos(a)}
                  y2={80 + (r + 9) * Math.sin(a)}
                  stroke="var(--foreground)"
                  strokeOpacity={0.5}
                  strokeWidth={2}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("readout text-5xl font-bold leading-none", levelText[level])}>
              {pct ? Math.round(pct) : "--"}
            </span>
            <span className="font-display text-sm uppercase tracking-wider text-muted-foreground">
              % SpO₂
            </span>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Normal ≥ {LIMITS.spo2.normalMin}% · Critical &lt; {LIMITS.spo2.criticalBelow}% · source MAX30100
        </p>
      </div>
    </Panel>
  );
}

export function BloodPressureCard({ t }: { t: Telemetry }) {
  const { systolic, diastolic } = t.vitals;
  const connected = systolic !== null && diastolic !== null && systolic > 0 && diastolic > 0;
  const level = connected ? bpLevel(systolic, diastolic) : "idle";

  return (
    <Panel
      title="Blood pressure"
      icon={<Gauge />}
      level={level}
      levelLabel={connected ? undefined : "Offline"}
      className="min-h-[300px]"
    >
      {connected ? (
        <div className="flex flex-1 flex-col justify-center gap-4">
          <div className="grid grid-cols-2 gap-3">
            <BpValue label="Systolic" value={systolic} className={levelText[level]} />
            <BpValue label="Diastolic" value={diastolic} className={levelText[level]} />
          </div>
          <p className="readout text-center text-2xl text-muted-foreground">
            {Math.round(systolic)}/{Math.round(diastolic)} <span className="text-sm">mmHg</span>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Warning ≥ {LIMITS.bp.warnSys}/{LIMITS.bp.warnDia} · Critical ≥ {LIMITS.bp.critSys}/
            {LIMITS.bp.critDia}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
          <PlugZap className="size-8 text-idle" />
          <p className="font-display text-lg font-semibold tracking-widest text-foreground">
            BP SENSOR NOT CONNECTED
          </p>
          <p className="max-w-[18rem] text-xs text-muted-foreground">
            The MAX30100 cannot measure blood pressure. Readings appear here only when a real BP
            device sends systolic and diastolic values.
          </p>
        </div>
      )}
    </Panel>
  );
}

function BpValue({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
      <p className="label-caps">{label}</p>
      <p className={cn("readout mt-1 text-4xl font-bold", className)}>{Math.round(value)}</p>
      <p className="text-xs text-muted-foreground">mmHg</p>
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="grid h-full place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
      {text}
    </div>
  );
}
