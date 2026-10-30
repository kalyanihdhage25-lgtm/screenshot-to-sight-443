/** Payload the backend broadcasts on the "sensor-data" Socket.IO event. */
export interface RadarPoint {
  /** Servo angle in degrees, 0–180. */
  angle: number;
  /** Measured distance in cm. Negative / null means no echo. */
  distance: number | null;
}

export interface SensorPayload {
  deviceId?: string;
  workerId?: string;
  heartRate?: number | null;
  spo2?: number | null;
  /** Only present when a real BP device is attached. */
  systolic?: number | null;
  diastolic?: number | null;
  /** Raw AD8232 ADC samples since the last packet. */
  ecg?: number[];
  ecgSampleRate?: number;
  ecgLeadsOff?: boolean;
  radar?: RadarPoint[];
  machineStop?: boolean;
  uptimeMs?: number;
  /** Added by the backend (ms since epoch). */
  receivedAt?: number;
}

export interface DeviceStatusEvent {
  online: boolean;
  lastSeen: number | null;
  deviceId?: string | null;
}

export interface HistoryEvent {
  heartRate: { t: number; v: number }[];
  spo2: { t: number; v: number }[];
  latest: SensorPayload | null;
  device: DeviceStatusEvent;
}

export type Level = "safe" | "warning" | "critical" | "idle";

export type DataMode = "live" | "demo";

export interface AlertEntry {
  id: string;
  at: number;
  level: Exclude<Level, "idle" | "safe"> | "safe";
  source: "Heart rate" | "SpO₂" | "Blood pressure" | "Proximity" | "Device" | "ECG";
  message: string;
}
