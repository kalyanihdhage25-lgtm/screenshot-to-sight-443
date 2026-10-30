import { useEffect, useRef, useState } from "react";
import { Activity, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/lib/telemetry/thresholds";
import type { Level } from "@/lib/telemetry/types";
import type { Telemetry } from "@/lib/telemetry/useTelemetry";

import { Panel } from "./Panel";
import { cssVar, levelText, withAlpha } from "./level";

const WINDOW_SEC = 5;

export function EcgMonitor({ t }: { t: Telemetry }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const snapshot = useRef<Float32Array | null>(null);
  const rateRef = useRef(250);
  const b = t.buffers.current;

  const measured = t.ecgRate;
  rateRef.current = b.ecgReportedRate ?? (measured > 5 ? measured : 250);

  const signal: { level: Level; text: string } = b.ecgLeadsOff
    ? { level: "warning", text: "Leads off" }
    : b.ecgLastAt && t.now - b.ecgLastAt < LIMITS.ecgTimeoutMs
      ? { level: "safe", text: "Signal OK" }
      : { level: "idle", text: "No signal" };

  const togglePause = () => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    snapshot.current = next ? readWindow(t.buffers.current, rateRef.current) : null;
    setPaused(next);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = {
      ecg: cssVar("--ecg"),
      grid: cssVar("--grid"),
      gridStrong: cssVar("--grid-strong"),
      warning: cssVar("--warning"),
      muted: cssVar("--muted-foreground"),
    };

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

    let lo = 1500;
    let hi = 2600;
    let raf = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Medical grid: major every 0.2 s, minor every 0.04 s, square cells.
      const major = w / (WINDOW_SEC / 0.2);
      const minor = major / 5;
      ctx.lineWidth = 1;
      if (minor >= 4) {
        ctx.strokeStyle = colors.grid;
        ctx.beginPath();
        for (let x = 0; x <= w; x += minor) {
          ctx.moveTo(Math.round(x) + 0.5, 0);
          ctx.lineTo(Math.round(x) + 0.5, h);
        }
        for (let y = h; y >= 0; y -= minor) {
          ctx.moveTo(0, Math.round(y) + 0.5);
          ctx.lineTo(w, Math.round(y) + 0.5);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = colors.gridStrong;
      ctx.beginPath();
      for (let x = 0; x <= w; x += major) {
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, h);
      }
      for (let y = h; y >= 0; y -= major) {
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
      }
      ctx.stroke();

      const buf = t.buffers.current;
      const data = pausedRef.current && snapshot.current ? snapshot.current : readWindow(buf, rateRef.current);

      let mn = Infinity;
      let mx = -Infinity;
      let valid = 0;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] ?? Number.NaN;
        if (Number.isNaN(v)) continue;
        valid++;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }

      if (valid > 2) {
        const pad = Math.max(40, (mx - mn) * 0.15);
        lo += (mn - pad - lo) * 0.08;
        hi += (mx + pad - hi) * 0.08;
        const span = Math.max(1, hi - lo);

        ctx.strokeStyle = buf.ecgLeadsOff ? colors.warning : colors.ecg;
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.shadowColor = withAlpha(ctx.strokeStyle as string, 0.8);
        ctx.shadowBlur = 8;
        ctx.beginPath();
        let started = false;
        const step = w / Math.max(1, data.length - 1);
        for (let i = 0; i < data.length; i++) {
          const v = data[i] ?? Number.NaN;
          if (Number.isNaN(v)) {
            started = false;
            continue;
          }
          const x = i * step;
          const y = h - ((v - lo) / span) * h;
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Leading dot.
        const lastV = data[data.length - 1] ?? Number.NaN;
        if (!Number.isNaN(lastV) && !pausedRef.current) {
          ctx.fillStyle = colors.ecg;
          ctx.beginPath();
          ctx.arc(w - 2, h - ((lastV - lo) / span) * h, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Flat baseline when nothing has arrived.
        ctx.strokeStyle = withAlpha(colors.ecg, 0.35);
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [t.buffers]);

  const shownRate = measured > 0 ? measured : 0;

  return (
    <Panel
      title="ECG monitor · AD8232"
      icon={<Activity />}
      level={signal.level}
      levelLabel={signal.text}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={togglePause}
          aria-label={paused ? "Resume ECG" : "Pause ECG"}
          className="h-7 font-display text-[11px] uppercase tracking-wider"
        >
          {paused ? <Play /> : <Pause />}
          {paused ? "Resume" : "Pause"}
        </Button>
      }
    >
      <div
        ref={wrapRef}
        className="relative h-56 overflow-hidden rounded-lg border border-grid-strong bg-background/70 sm:h-64"
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
        {paused && (
          <div className="absolute left-3 top-3 rounded bg-warning/20 px-2 py-0.5 font-display text-[11px] uppercase tracking-widest text-warning">
            Paused
          </div>
        )}
        {signal.level === "idle" && !paused && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            {t.mode === "live" ? "Waiting for AD8232 samples from ESP32…" : "Starting demo…"}
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Signal" value={signal.text} className={levelText[signal.level]} />
        <Stat label="Incoming rate" value={`${shownRate.toFixed(0)} Hz`} />
        <Stat label="Samples received" value={b.ecgTotal.toLocaleString()} />
        <Stat label="Window" value={`${WINDOW_SEC} s · 25 mm/s`} />
      </div>
    </Panel>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="label-caps text-[10px]">{label}</p>
      <p className={cn("readout mt-0.5 truncate text-sm font-semibold", className)}>{value}</p>
    </div>
  );
}

function readWindow(buf: Telemetry["buffers"]["current"], rate: number) {
  const cap = buf.ecg.length;
  const n = Math.min(cap, Math.max(50, Math.round(WINDOW_SEC * rate)));
  const out = new Float32Array(n);
  const start = (buf.ecgWrite - n + cap) % cap;
  for (let i = 0; i < n; i++) out[i] = buf.ecg[(start + i) % cap] ?? Number.NaN;
  return out;
}
