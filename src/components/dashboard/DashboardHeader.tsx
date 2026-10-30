import { useState } from "react";
import { FlaskConical, Radio, Settings2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Telemetry } from "@/lib/telemetry/useTelemetry";

export function DashboardHeader({ t }: { t: Telemetry }) {
  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-4">
        <div className="relative mt-1 grid size-12 shrink-0 place-items-center rounded-xl border border-safe/40 bg-safe/10 text-safe">
          <ShieldCheck className="size-6" />
          <span className="absolute -right-1 -top-1 size-3 rounded-full bg-safe">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-safe" />
          </span>
        </div>
        <div>
          <p className="label-caps text-warning">Industrial Safety · IoT · Wearables</p>
          <h1 className="font-display text-2xl font-bold leading-tight tracking-wide sm:text-3xl">
            WORKER HEALTH &amp; SAFETY MONITORING SYSTEM
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-Time Industrial Worker Health and Machine Safety Monitoring
            <span className="mx-2 text-border">|</span>
            <span className="font-display tracking-wider">Team Nexguard</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="readout hidden rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-muted-foreground sm:block">
          {t.now ? new Date(t.now).toLocaleTimeString([], { hour12: false }) : "--:--:--"}
        </div>
        <div
          role="tablist"
          aria-label="Data source"
          className="flex rounded-lg border border-border bg-panel p-1"
        >
          <ModeButton active={t.mode === "live"} onClick={() => t.setMode("live")}>
            <Radio /> Live ESP32
          </ModeButton>
          <ModeButton active={t.mode === "demo"} onClick={() => t.setMode("demo")}>
            <FlaskConical /> Demo
          </ModeButton>
        </div>
        <ConnectionDialog t={t} />
      </div>
    </header>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wider transition-colors [&_svg]:size-3.5",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ConnectionDialog({ t }: { t: Telemetry }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(t.backendUrl);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setUrl(t.backendUrl);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="font-display uppercase tracking-wider">
          <Settings2 /> Backend
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide">Backend connection</DialogTitle>
          <DialogDescription>
            Address of the Node.js server that receives data from your ESP32.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            t.setBackendUrl(url);
            t.setMode("live");
            setOpen(false);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="backend-url">Backend URL</Label>
            <Input
              id="backend-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:3000"
              className="readout"
            />
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>
              <span className="text-foreground">ESP32 sends to:</span>{" "}
              <code className="readout text-safe">http://&lt;computer-IP&gt;:3000/api/sensor-data</code>
            </p>
            <p>
              Open this dashboard on the same computer that runs the server and keep{" "}
              <code className="readout">http://localhost:3000</code>. For other devices, expose the
              server with an HTTPS tunnel and paste that address here.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit">Connect</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
