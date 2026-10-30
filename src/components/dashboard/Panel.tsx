import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LEVEL_LABEL } from "@/lib/telemetry/thresholds";
import type { Level } from "@/lib/telemetry/types";

import { levelBorder, levelGlow } from "./level";

interface PanelProps {
  title: string;
  icon?: ReactNode;
  level?: Level;
  levelLabel?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, icon, level, levelLabel, actions, className, children }: PanelProps) {
  return (
    <section
      className={cn(
        "panel flex flex-col p-4 transition-[border-color,box-shadow] duration-500 sm:p-5",
        level && levelBorder[level],
        level && levelGlow[level],
        className,
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
          <h2 className="label-caps truncate">{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {level && <LevelBadge level={level} label={levelLabel} />}
        </div>
      </header>
      {children}
    </section>
  );
}

export function LevelBadge({ level, label }: { level: Level; label?: string }) {
  return <Badge variant={level}>{label ?? LEVEL_LABEL[level]}</Badge>;
}
