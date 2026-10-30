import { BellRing, CircleCheck, Siren, Stethoscope, UserRoundX, Power } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  bpLevel,
  heartRateLevel,
  proximityLevel,
  spo2Level,
  worstLevel,
} from "@/lib/telemetry/thresholds";
import type { Telemetry } from "@/lib/telemetry/useTelemetry";

import { Panel } from "./Panel";
import { levelBg, levelText } from "./level";

export function AlertsPanel({ t }: { t: Telemetry }) {
  return (
    <Panel
      title="Alert log"
      icon={<Siren />}
      actions={
        t.alerts.length > 0 ? (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={t.clearAlerts}>
            Clear
          </Button>
        ) : null
      }
      className="h-full"
    >
      {t.alerts.length === 0 ? (
        <div className="grid flex-1 place-items-center py-8 text-sm text-muted-foreground">
          No alerts yet.
        </div>
      ) : (
        <ul className="-mr-2 max-h-80 flex-1 space-y-2 overflow-y-auto pr-2">
          {t.alerts.map((a) => (
            <li
              key={a.id}
              className="flex animate-fade-up items-start gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", levelBg[a.level])} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("font-display text-xs font-semibold uppercase tracking-wider", levelText[a.level])}>
                    {a.source}
                  </span>
                  <span className="readout text-[11px] text-muted-foreground">
                    {new Date(a.at).toLocaleTimeString([], { hour12: false })}
                  </span>
                </div>
                <p className="text-sm text-foreground/90">{a.message}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Response workflow from the project slides: alert → stop → replace → treat. */
export function ResponsePanel({ t }: { t: Telemetry }) {
  const { vitals, deviceOnline } = t;
  const health = deviceOnline
    ? worstLevel(heartRateLevel(vitals.heartRate), spo2Level(vitals.spo2), bpLevel(vitals.systolic, vitals.diastolic))
    : "idle";
  const prox = deviceOnline
    ? vitals.machineStop
      ? "critical"
      : proximityLevel(t.radarReadout.distance)
    : "idle";
  const any = worstLevel(health, prox);

  const steps: { icon: ReactNode; label: string; on: boolean }[] = [
    { icon: <BellRing />, label: "Alert the worker", on: any === "warning" || any === "critical" },
    { icon: <Power />, label: "Stop the machine", on: prox === "critical" },
    { icon: <UserRoundX />, label: "Replace the worker", on: health === "critical" },
    { icon: <Stethoscope />, label: "Start medical treatment", on: health === "critical" },
  ];

  return (
    <Panel title="Response actions" icon={<CircleCheck />}>
      <ol className="grid grid-cols-2 gap-2">
        {steps.map((s, i) => (
          <li
            key={s.label}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
              s.on ? "border-critical/60 bg-critical/15 text-critical" : "border-border text-muted-foreground",
            )}
          >
            <span className="readout text-xs opacity-60">{i + 1}</span>
            {s.icon}
            <span className="leading-tight">{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        {any === "idle"
          ? "Waiting for live data."
          : any === "safe"
            ? "All readings normal — keep monitoring."
            : "Abnormal reading or worker too close — follow the highlighted steps."}
      </p>
    </Panel>
  );
}
