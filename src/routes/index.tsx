import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical, ServerOff } from "lucide-react";

import { AlertsPanel, ResponsePanel } from "@/components/dashboard/AlertsPanel";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { EcgMonitor } from "@/components/dashboard/EcgMonitor";
import { RadarScope } from "@/components/dashboard/RadarScope";
import { StatusStrip } from "@/components/dashboard/StatusStrip";
import { BloodPressureCard, HeartRateCard, Spo2Card } from "@/components/dashboard/VitalsCards";
import { useTelemetry } from "@/lib/telemetry/useTelemetry";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Worker Health & Safety Monitoring System — Live Dashboard" },
      {
        name: "description",
        content:
          "Real-time industrial worker health and machine safety dashboard: heart rate, SpO₂, ECG and radar proximity streamed from an ESP32.",
      },
      { property: "og:title", content: "Worker Health & Safety Monitoring System" },
      {
        property: "og:description",
        content: "Live ESP32 dashboard for worker vitals, ECG and machine danger-zone radar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const t = useTelemetry();

  return (
    <main className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <DashboardHeader t={t} />

      {t.mode === "demo" && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/50 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          <FlaskConical className="size-4 shrink-0" />
          <span>
            <strong className="font-display uppercase tracking-wider">Demo mode</strong> — simulated
            readings for presentation only. Switch to Live ESP32 for real sensor data.
          </span>
        </div>
      )}
      {t.mode === "live" && t.socketState === "error" && (
        <div className="flex items-start gap-3 rounded-lg border border-critical/50 bg-critical/10 px-4 py-2.5 text-sm text-critical">
          <ServerOff className="mt-0.5 size-4 shrink-0" />
          <span>
            Can't reach the backend at <code className="readout">{t.backendUrl}</code>. Start the
            Node.js server (<code className="readout">npm start</code>) or change the address with
            the Backend button. Retrying automatically…
          </span>
        </div>
      )}

      <StatusStrip t={t} />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <HeartRateCard t={t} />
        <Spo2Card t={t} />
        <BloodPressureCard t={t} className="md:col-span-2 xl:col-span-1" />
      </div>

      <EcgMonitor t={t} />

      <div className="grid gap-5 xl:grid-cols-[1fr_26rem]">
        <RadarScope t={t} />
        <div className="flex flex-col gap-5">
          <ResponsePanel t={t} />
          <AlertsPanel t={t} />
        </div>
      </div>

      <footer className="pb-4 pt-2 text-center text-xs text-muted-foreground">
        ESP32 → Wi-Fi → HTTP POST → Node.js / Express → Socket.IO → Dashboard · No cloud database
      </footer>
    </main>
  );
}
