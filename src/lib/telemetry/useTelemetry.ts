import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import { DemoSource } from "./demo";
import {
  LIMITS,
  bpLevel,
  heartRateLevel,
  proximityLevel,
  spo2Level,
} from "./thresholds";
import type {
  AlertEntry,
  DataMode,
  DeviceStatusEvent,
  HistoryEvent,
  Level,
  SensorPayload,
} from "./types";

export type SocketState = "idle" | "connecting" | "connected" | "error";

export interface Vitals {
  workerId: string | null;
  deviceId: string | null;
  heartRate: number | null;
  spo2: number | null;
  systolic: number | null;
  diastolic: number | null;
  machineStop: boolean;
  receivedAt: number | null;
}

export interface RadarBlip {
  angle: number;
  distance: number;
  at: number;
}

/** Mutable, high-rate buffers read directly by canvas renderers. */
export interface StreamBuffers {
  ecg: Float32Array;
  ecgWrite: number;
  ecgTotal: number;
  ecgLastAt: number;
  ecgLeadsOff: boolean;
  ecgReportedRate: number | null;
  radarAngle: number;
  radarDistance: number | null;
  radarLastAt: number;
  blips: RadarBlip[];
}

const ECG_CAPACITY = 2500; // 10 s at 250 Hz
const HR_POINTS = 90;
const MAX_ALERTS = 40;
const STORAGE_KEY = "whsms.backendUrl";
export const DEFAULT_BACKEND_URL = "http://localhost:3000";

const emptyVitals: Vitals = {
  workerId: null,
  deviceId: null,
  heartRate: null,
  spo2: null,
  systolic: null,
  diastolic: null,
  machineStop: false,
  receivedAt: null,
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function useTelemetry() {
  const [mode, setMode] = useState<DataMode>("live");
  const [backendUrl, setBackendUrlState] = useState(DEFAULT_BACKEND_URL);
  const [socketState, setSocketState] = useState<SocketState>("idle");
  const [socketError, setSocketError] = useState<string | null>(null);
  const [vitals, setVitals] = useState<Vitals>(emptyVitals);
  const [hrHistory, setHrHistory] = useState<{ t: number; v: number }[]>([]);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [ecgRate, setEcgRate] = useState(0);
  const [radarReadout, setRadarReadout] = useState<{ angle: number; distance: number | null }>({
    angle: 90,
    distance: null,
  });

  const buffers = useRef<StreamBuffers>({
    ecg: new Float32Array(ECG_CAPACITY).fill(Number.NaN),
    ecgWrite: 0,
    ecgTotal: 0,
    ecgLastAt: 0,
    ecgLeadsOff: false,
    ecgReportedRate: null,
    radarAngle: 90,
    radarDistance: null,
    radarLastAt: 0,
    blips: [],
  });

  const prevLevels = useRef<Record<string, Level>>({});
  const lastHrPointAt = useRef(0);
  const ecgCountAtTick = useRef({ count: 0, at: Date.now() });
  const wasOnline = useRef(false);

  const pushAlert = useCallback((a: Omit<AlertEntry, "id" | "at">) => {
    setAlerts((prev) =>
      [{ ...a, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now() }, ...prev].slice(
        0,
        MAX_ALERTS,
      ),
    );
  }, []);

  const trackLevel = useCallback(
    (key: AlertEntry["source"], level: Level, msg: Record<Level, string>) => {
      const prev = prevLevels.current[key] ?? "idle";
      if (prev === level) return;
      prevLevels.current[key] = level;
      if (level === "warning" || level === "critical") pushAlert({ level, source: key, message: msg[level] });
      else if (level === "safe" && (prev === "warning" || prev === "critical"))
        pushAlert({ level: "safe", source: key, message: msg.safe });
    },
    [pushAlert],
  );

  const ingest = useCallback(
    (p: SensorPayload) => {
      const at = p.receivedAt ?? Date.now();
      const b = buffers.current;

      if (Array.isArray(p.ecg) && p.ecg.length) {
        for (const s of p.ecg) {
          if (typeof s !== "number") continue;
          b.ecg[b.ecgWrite] = s;
          b.ecgWrite = (b.ecgWrite + 1) % ECG_CAPACITY;
          b.ecgTotal++;
        }
        b.ecgLastAt = Date.now();
      }
      if (typeof p.ecgLeadsOff === "boolean") {
        if (p.ecgLeadsOff && !b.ecgLeadsOff)
          pushAlert({ level: "warning", source: "ECG", message: "ECG electrodes disconnected (leads off)" });
        b.ecgLeadsOff = p.ecgLeadsOff;
      }
      if (num(p.ecgSampleRate)) b.ecgReportedRate = p.ecgSampleRate!;

      let nearest: number | null = null;
      if (Array.isArray(p.radar) && p.radar.length) {
        for (const r of p.radar) {
          const a = num(r?.angle);
          if (a === null) continue;
          const d = num(r.distance);
          b.radarAngle = Math.max(0, Math.min(180, a));
          b.radarDistance = d !== null && d > 0 ? d : null;
          if (d !== null && d > 0 && d <= LIMITS.proximity.rangeCm) {
            b.blips.push({ angle: b.radarAngle, distance: d, at: Date.now() });
            if (nearest === null || d < nearest) nearest = d;
          }
        }
        b.radarLastAt = Date.now();
        const cutoff = Date.now() - 4000;
        if (b.blips.length > 600 || (b.blips[0] && b.blips[0].at < cutoff))
          b.blips = b.blips.filter((x) => x.at >= cutoff).slice(-600);
        setRadarReadout({ angle: b.radarAngle, distance: b.radarDistance });
      }

      const hr = num(p.heartRate);
      const spo2 = num(p.spo2);
      const sys = num(p.systolic);
      const dia = num(p.diastolic);

      setVitals((v) => ({
        workerId: p.workerId ?? v.workerId,
        deviceId: p.deviceId ?? v.deviceId,
        heartRate: hr ?? v.heartRate,
        spo2: spo2 ?? v.spo2,
        systolic: sys ?? v.systolic,
        diastolic: dia ?? v.diastolic,
        machineStop: typeof p.machineStop === "boolean" ? p.machineStop : v.machineStop,
        receivedAt: at,
      }));

      if (hr !== null && hr > 0 && at - lastHrPointAt.current >= 1000) {
        lastHrPointAt.current = at;
        setHrHistory((h) => [...h, { t: at, v: hr }].slice(-HR_POINTS));
      }

      if (hr !== null)
        trackLevel("Heart rate", heartRateLevel(hr), {
          safe: `Heart rate back to normal (${hr} bpm)`,
          warning: `Heart rate out of normal range: ${hr} bpm — check the worker`,
          critical: `Heart rate critical: ${hr} bpm — act immediately`,
          idle: "",
        });
      if (spo2 !== null)
        trackLevel("SpO₂", spo2Level(spo2), {
          safe: `Oxygen level back to normal (${spo2}%)`,
          warning: `Low oxygen: ${spo2}% — check the worker`,
          critical: `Oxygen critical: ${spo2}% — start medical treatment`,
          idle: "",
        });
      if (sys !== null && dia !== null)
        trackLevel("Blood pressure", bpLevel(sys, dia), {
          safe: `Blood pressure back to normal (${sys}/${dia})`,
          warning: `Elevated blood pressure: ${sys}/${dia} mmHg`,
          critical: `Blood pressure critical: ${sys}/${dia} mmHg`,
          idle: "",
        });
      if (Array.isArray(p.radar) && p.radar.length) {
        const lvl = proximityLevel(nearest);
        trackLevel("Proximity", lvl, {
          safe: "Worker left the machine zone — area clear",
          warning: `Worker in warning zone (${nearest?.toFixed(0)} cm) — committee alerted`,
          critical: `DANGER ZONE: object at ${nearest?.toFixed(0)} cm — machine stop`,
          idle: "",
        });
      }
    },
    [pushAlert, trackLevel],
  );

  const resetStreams = useCallback(() => {
    const b = buffers.current;
    b.ecg.fill(Number.NaN);
    b.ecgWrite = 0;
    b.ecgTotal = 0;
    b.ecgLastAt = 0;
    b.ecgLeadsOff = false;
    b.ecgReportedRate = null;
    b.blips = [];
    b.radarLastAt = 0;
    b.radarDistance = null;
    prevLevels.current = {};
    lastHrPointAt.current = 0;
    ecgCountAtTick.current = { count: 0, at: Date.now() };
    wasOnline.current = false;
    setVitals(emptyVitals);
    setHrHistory([]);
    setRadarReadout({ angle: 90, distance: null });
    setEcgRate(0);
  }, []);

  // Load saved backend URL after hydration.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setBackendUrlState(saved);
  }, []);

  const setBackendUrl = useCallback((url: string) => {
    const clean = url.trim().replace(/\/+$/, "");
    window.localStorage.setItem(STORAGE_KEY, clean);
    setBackendUrlState(clean);
  }, []);

  // Live mode: Socket.IO connection to the user's Node/Express backend.
  useEffect(() => {
    if (mode !== "live") return;
    resetStreams();
    let socket: Socket | null = null;
    let cancelled = false;
    setSocketState("connecting");
    setSocketError(null);

    import("socket.io-client").then(({ io }) => {
      if (cancelled) return;
      socket = io(backendUrl, {
        transports: ["websocket", "polling"],
        reconnectionDelay: 1500,
        timeout: 6000,
      });
      socket.on("connect", () => {
        setSocketState("connected");
        setSocketError(null);
      });
      socket.on("disconnect", () => setSocketState("connecting"));
      socket.on("connect_error", (err) => {
        setSocketState("error");
        setSocketError(err?.message ?? "Unable to reach backend");
      });
      socket.on("history", (h: HistoryEvent) => {
        if (Array.isArray(h?.heartRate)) setHrHistory(h.heartRate.slice(-HR_POINTS));
        if (h?.latest) {
          const { ecg: _e, radar: _r, ...rest } = h.latest;
          ingest(rest);
        }
      });
      socket.on("sensor-data", (p: SensorPayload) => ingest(p));
      socket.on("device-status", (_s: DeviceStatusEvent) => {
        /* Online state is derived client-side from lastReceived; event kept for logging. */
      });
    });

    return () => {
      cancelled = true;
      socket?.removeAllListeners();
      socket?.disconnect();
      setSocketState("idle");
    };
  }, [mode, backendUrl, ingest, resetStreams]);

  // Demo mode: local simulator, clearly labelled in the UI.
  useEffect(() => {
    if (mode !== "demo") return;
    resetStreams();
    const src = new DemoSource();
    const id = window.setInterval(() => ingest(src.next()), 100);
    return () => window.clearInterval(id);
  }, [mode, ingest, resetStreams]);

  // 1 Hz ticker: clock, ECG frequency, device online/offline transitions.
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const b = buffers.current;
      const prev = ecgCountAtTick.current;
      const elapsed = (t - prev.at) / 1000;
      if (elapsed > 0) setEcgRate(Math.max(0, (b.ecgTotal - prev.count) / elapsed));
      ecgCountAtTick.current = { count: b.ecgTotal, at: t };
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const deviceOnline =
    vitals.receivedAt !== null && now - vitals.receivedAt < LIMITS.deviceTimeoutMs;

  useEffect(() => {
    if (deviceOnline && !wasOnline.current) {
      wasOnline.current = true;
      pushAlert({ level: "safe", source: "Device", message: "ESP32 connected — data streaming" });
    } else if (!deviceOnline && wasOnline.current) {
      wasOnline.current = false;
      pushAlert({ level: "warning", source: "Device", message: "ESP32 stopped sending data" });
    }
  }, [deviceOnline, pushAlert]);

  return {
    mode,
    setMode,
    backendUrl,
    setBackendUrl,
    socketState,
    socketError,
    vitals,
    hrHistory,
    alerts,
    clearAlerts: () => setAlerts([]),
    now,
    deviceOnline,
    ecgRate,
    radarReadout,
    buffers,
  };
}

export type Telemetry = ReturnType<typeof useTelemetry>;
