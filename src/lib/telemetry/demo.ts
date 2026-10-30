import type { RadarPoint, SensorPayload } from "./types";

/**
 * DEMO MODE ONLY. Produces clearly-simulated packets so the dashboard can be
 * shown without hardware. Never used in live mode. Never produces blood
 * pressure — BP stays "not connected" unless a real device sends it.
 */
export class DemoSource {
  private t0 = performance.now();
  private ecgPhase = 0;
  private lastTick = performance.now();
  private angle = 0;
  private dir = 1;
  readonly sampleRate = 250;

  next(): SensorPayload {
    const now = performance.now();
    const dt = Math.min(0.5, (now - this.lastTick) / 1000);
    this.lastTick = now;
    const s = (now - this.t0) / 1000;

    // Heart rate: gentle drift with an occasional stress episode every ~45 s.
    const episode = Math.max(0, Math.sin((s / 45) * Math.PI * 2 - 1.2)) ** 6;
    const hr = 76 + 6 * Math.sin(s / 9) + 2 * Math.sin(s / 2.3) + episode * 38;
    const spo2 = 98 - episode * 6 + 0.5 * Math.sin(s / 7);

    // ECG samples synthesised from a PQRST template at the current HR.
    const n = Math.round(dt * this.sampleRate);
    const ecg: number[] = [];
    const beatsPerSample = hr / 60 / this.sampleRate;
    for (let i = 0; i < n; i++) {
      this.ecgPhase = (this.ecgPhase + beatsPerSample) % 1;
      ecg.push(Math.round(2048 + 900 * pqrst(this.ecgPhase) + (Math.random() - 0.5) * 30));
    }

    // Radar: servo sweeps 0–180°, a worker walks toward the machine and back.
    const radar: RadarPoint[] = [];
    const steps = Math.max(1, Math.round(dt * 60));
    const approach = 0.5 + 0.5 * Math.cos((s / 30) * Math.PI * 2); // 1 → far, 0 → close
    const workerDist = 18 + approach * 150;
    const workerAngle = 95 + 25 * Math.sin(s / 11);
    for (let i = 0; i < steps; i++) {
      this.angle += this.dir * 2;
      if (this.angle >= 180) {
        this.angle = 180;
        this.dir = -1;
      } else if (this.angle <= 0) {
        this.angle = 0;
        this.dir = 1;
      }
      let d: number | null = null;
      if (Math.abs(this.angle - workerAngle) < 9) d = workerDist + (Math.random() - 0.5) * 4;
      else if (Math.abs(this.angle - 32) < 5) d = 165 + (Math.random() - 0.5) * 3; // fixed pillar
      radar.push({ angle: this.angle, distance: d });
    }

    return {
      deviceId: "DEMO-SIM",
      workerId: "W-1024",
      heartRate: Math.round(hr),
      spo2: Math.round(Math.min(100, spo2)),
      ecg,
      ecgSampleRate: this.sampleRate,
      ecgLeadsOff: false,
      radar,
      machineStop: workerDist < 30,
      receivedAt: Date.now(),
    };
  }
}

function gauss(x: number, mu: number, sigma: number, amp: number) {
  return amp * Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));
}

/** Normalised PQRST shape for phase 0..1 of one beat. */
function pqrst(p: number) {
  return (
    gauss(p, 0.18, 0.025, 0.12) + // P
    gauss(p, 0.3, 0.008, -0.12) + // Q
    gauss(p, 0.32, 0.01, 1.0) + // R
    gauss(p, 0.345, 0.01, -0.22) + // S
    gauss(p, 0.55, 0.04, 0.28) // T
  );
}
