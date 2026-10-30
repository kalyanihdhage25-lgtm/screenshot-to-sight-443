import { useEffect, useRef } from "react";
import { Ban, BellRing, CircleCheck, Radar } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { LIMITS, proximityLevel } from "@/lib/telemetry/thresholds";
import type { Level } from "@/lib/telemetry/types";
import type { Telemetry } from "@/lib/telemetry/useTelemetry";

import { Panel } from "./Panel";
import { cssVar, levelText, withAlpha } from "./level";

const RANGE = LIMITS.proximity.rangeCm;
const BLIP_LIFE_MS = 4000;

export function RadarScope({ t }: { t: Telemetry }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const b = t.buffers.current;
  const live = b.radarLastAt && t.now - b.radarLastAt < LIMITS.deviceTimeoutMs;
  const recent = b.blips.filter((x) => t.now - x.at < 1500);
  const nearest = recent.reduce<number | null>(
    (m, x) => (m === null || x.distance < m ? x.distance : m),
    null,
  );
  const zone: Level = live ? (t.vitals.machineStop ? "critical" : proximityLevel(nearest)) : "idle";
  const zoneText: Record<Level, string> = {
    safe: "Safe zone",
    warning: "Warning zone",
    critical: "Danger zone",
    idle: "Radar idle",
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const c = {
      radar: cssVar("--radar"),
      safe: cssVar("--safe"),
      warning: cssVar("--warning"),
      critical: cssVar("--critical"),
      muted: cssVar("--muted-foreground"),
      grid: cssVar("--grid-strong"),
      fg: cssVar("--foreground"),
    };
    const font = cssVar("--font-mono", "monospace");

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let shown = 90;
    let lastTarget = 90;
    let dir = 1;
    let raf = 0;

    const draw = () => {
      const buf = t.buffers.current;
      const now = Date.now();
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h - 26;
      const R = Math.max(40, Math.min(w / 2 - 28, h - 52));
      const toXY = (deg: number, dist: number) => {
        const a = (deg * Math.PI) / 180;
        const r = (Math.min(dist, RANGE) / RANGE) * R;
        return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
      };
      const half = (r: number, fill: string) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      };

      // Zone shading (outer → inner).
      half(R, withAlpha(c.safe, 0.06));
      half((LIMITS.proximity.warningCm / RANGE) * R, withAlpha(c.warning, 0.12));
      half((LIMITS.proximity.dangerCm / RANGE) * R, withAlpha(c.critical, 0.2));

      // Distance rings.
      ctx.lineWidth = 1;
      ctx.font = `10px ${font}`;
      ctx.textBaseline = "middle";
      for (let d = 50; d <= RANGE; d += 50) {
        const r = (d / RANGE) * R;
        ctx.strokeStyle = d === RANGE ? withAlpha(c.radar, 0.6) : c.grid;
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = c.muted;
        ctx.textAlign = "left";
        ctx.fillText(`${d}cm`, cx + r + 3, cy + 10);
      }

      // Angle spokes and labels.
      ctx.textAlign = "center";
      for (let deg = 0; deg <= 180; deg += 15) {
        const major = deg % 30 === 0;
        const [x, y] = toXY(deg, RANGE);
        ctx.strokeStyle = major ? c.grid : withAlpha(c.radar, 0.08);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.stroke();
        if (major) {
          const a = (deg * Math.PI) / 180;
          ctx.fillStyle = c.fg;
          ctx.fillText(`${deg}°`, cx + (R + 15) * Math.cos(a), cy - (R + 15) * Math.sin(a));
        }
      }
      ctx.strokeStyle = withAlpha(c.radar, 0.6);
      ctx.beginPath();
      ctx.moveTo(cx - R, cy);
      ctx.lineTo(cx + R, cy);
      ctx.stroke();

      const active = buf.radarLastAt && now - buf.radarLastAt < LIMITS.deviceTimeoutMs;

      // Sweep: ease toward the latest servo angle, trailing fade behind motion.
      const target = buf.radarAngle;
      if (Math.abs(target - lastTarget) > 0.1) dir = target > lastTarget ? 1 : -1;
      lastTarget = target;
      shown += (target - shown) * 0.25;
      if (active) {
        for (let i = 0; i < 28; i++) {
          const deg = shown - dir * i * 0.9;
          if (deg < 0 || deg > 180) continue;
          const [x, y] = toXY(deg, RANGE);
          ctx.strokeStyle = withAlpha(c.radar, 0.35 * (1 - i / 28));
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        const [sx, sy] = toXY(shown, RANGE);
        ctx.strokeStyle = c.radar;
        ctx.lineWidth = 2;
        ctx.shadowColor = c.radar;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Detected objects.
      for (const blip of buf.blips) {
        const age = now - blip.at;
        if (age > BLIP_LIFE_MS) continue;
        const alpha = 1 - age / BLIP_LIFE_MS;
        const col =
          blip.distance < LIMITS.proximity.dangerCm
            ? c.critical
            : blip.distance < LIMITS.proximity.warningCm
              ? c.warning
              : c.safe;
        const [x, y] = toXY(blip.angle, blip.distance);
        ctx.fillStyle = withAlpha(col, alpha);
        ctx.shadowColor = col;
        ctx.shadowBlur = 10 * alpha;
        ctx.beginPath();
        ctx.arc(x, y, 3 + 2 * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Machine at the origin.
      ctx.fillStyle = c.fg;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [t.buffers]);

  return (
    <Panel
      title="Live radar · HC-SR04 + SG90"
      icon={<Radar />}
      level={zone}
      levelLabel={zoneText[zone]}
      className="h-full"
    >
      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_15rem]">
        <div
          ref={wrapRef}
          className="relative h-64 overflow-hidden rounded-lg border border-border bg-background/60 sm:h-80 xl:h-[30rem]"
        >
          <canvas ref={canvasRef} className="absolute inset-0" />
          {!live && (
            <div className="absolute inset-x-0 top-6 text-center text-sm text-muted-foreground">
              {t.mode === "live" ? "Waiting for radar sweep from ESP32…" : "Starting demo…"}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Readout label="Servo angle" value={live ? `${Math.round(t.radarReadout.angle)}°` : "--"} />
            <Readout
              label="Distance"
              value={live && t.radarReadout.distance ? `${t.radarReadout.distance.toFixed(0)} cm` : "--"}
            />
            <Readout
              label="Nearest object"
              value={nearest !== null ? `${nearest.toFixed(0)} cm` : "None"}
              className={levelText[zone]}
            />
            <Readout label="Echoes" value={live ? String(recent.length) : "--"} />
          </div>
          <Zone
            active={zone === "safe"}
            icon={<CircleCheck />}
            level="safe"
            title={`Safe · > ${LIMITS.proximity.warningCm} cm`}
            text="Machine runs normally."
          />
          <Zone
            active={zone === "warning"}
            icon={<BellRing />}
            level="warning"
            title={`Warning · ${LIMITS.proximity.dangerCm}–${LIMITS.proximity.warningCm} cm`}
            text="Committee and worker alerted."
          />
          <Zone
            active={zone === "critical"}
            icon={<Ban />}
            level="critical"
            title={`Danger · < ${LIMITS.proximity.dangerCm} cm`}
            text="Machine stops automatically."
          />
        </div>
      </div>
    </Panel>
  );
}

function Readout({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="label-caps text-[10px]">{label}</p>
      <p className={cn("readout mt-0.5 text-lg font-semibold", className)}>{value}</p>
    </div>
  );
}

function Zone({
  active,
  icon,
  level,
  title,
  text,
}: {
  active: boolean;
  icon: ReactNode;
  level: Level;
  title: string;
  text: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border px-3 py-2 transition-colors",
        active ? "border-current bg-muted/50" : "border-border opacity-60",
        levelText[level],
      )}
    >
      <span className="mt-0.5 [&_svg]:size-4">{icon}</span>
      <div>
        <p className="font-display text-xs font-semibold uppercase tracking-wider">{title}</p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
