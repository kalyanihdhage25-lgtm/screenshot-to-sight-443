import { Activity, Clock, Cpu, Factory, HardHat, HeartPulse } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  bpLevel,
  heartRateLevel,
  proximityLevel,
  spo2Level,
  worstLevel,
} from "@/lib/telemetry/thresholds";
import type { Level } from "@/lib/telemetry/types";
import type { Telemetry } from "@/lib/telemetry/useTelemetry";

import { levelBg, levelText } from "./level";

export function StatusStrip({ t }: { t: Telemetry }) {
  const { vitals, deviceOnline } = t;
  const health = deviceOnline
    ? worstLevel(
        heartRateLevel(vitals.heartRate),
        spo2Level(vitals.spo2),
        bpLevel(vitals.systolic, vitals.diastolic),
      )
    : "idle";
  const proximity: Level = deviceOnline
    ? vitals.machineStop
      ? "critical"
      : proximityLevel(t.radarReadout.distance)
    : "idle";

  const working: { level: Level; text: string } = !deviceOnline
    ? { level: "idle", text: "Offline" }
    : health === "critical"
      ? { level: "critical", text: "Replace worker" }
      : health === "warning"
        ? { level: "warning", text: "Check worker" }
        : { level: "safe", text: "On duty" };

  const healthText: Record<Level, string> = {
    safe: "Healthy",
    warning: "At risk",
    critical: "Critical",
    idle: "No data",
  };
  const machineText: Record<Level, string> = {
    safe: "Safe · running",
    warning: "Worker nearby",
    critical: "Machine stop",
    idle: "Unknown",
  };

  const esp: { level: Level; text: string } =
    t.mode === "demo"
      ? { level: "warning", text: "Demo data" }
      : deviceOnline
        ? { level: "safe", text: "Online" }
        : t.socketState === "connected"
          ? { level: "warning", text: "Waiting for ESP32" }
          : t.socketState === "error"
            ? { level: "critical", text: "Server unreachable" }
            : { level: "idle", text: "Connecting…" };

  const last = vitals.receivedAt
    ? `${new Date(vitals.receivedAt).toLocaleTimeString([], { hour12: false })}`
    : "—";
  const ago = vitals.receivedAt ? Math.max(0, Math.round((t.now - vitals.receivedAt) / 1000)) : null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile icon={<HardHat />} label="Worker ID" value={vitals.workerId ?? "—"} mono />
      <Tile icon={<Activity />} label="Working status" value={working.text} level={working.level} />
      <Tile icon={<HeartPulse />} label="Health status" value={healthText[health]} level={health} />
      <Tile
        icon={<Factory />}
        label="Machine safety"
        value={machineText[proximity]}
        level={proximity}
      />
      <Tile icon={<Cpu />} label="ESP32 link" value={esp.text} level={esp.level} />
      <Tile
        icon={<Clock />}
        label="Last data"
        value={last}
        sub={ago !== null ? `${ago}s ago` : t.backendUrl}
        mono
      />
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  sub,
  level,
  mono,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  level?: Level;
  mono?: boolean;
}) {
  return (
    <div className="panel flex min-w-0 flex-col gap-1.5 px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground [&_svg]:size-3.5">
        {icon}
        <span className="label-caps truncate">{label}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        {level && (
          <span className={cn("relative size-2.5 shrink-0 rounded-full", levelBg[level])}>
            {level === "critical" && (
              <span className={cn("absolute inset-0 animate-pulse-ring rounded-full", levelBg[level])} />
            )}
          </span>
        )}
        <span
          className={cn(
            "truncate text-base font-semibold",
            mono ? "readout" : "font-display tracking-wide",
            level && levelText[level],
          )}
        >
          {value}
        </span>
      </div>
      {sub && <span className="readout truncate text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}
