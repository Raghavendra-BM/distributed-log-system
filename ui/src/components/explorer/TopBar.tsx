import { cn } from "@/lib/utils";
import { API_HOST } from "@/lib/config";
import type { DataMode } from "@/lib/types";

interface Props {
  mode: DataMode;
  reachable: boolean | null;
  fellBack: boolean;
  onModeChange: (mode: DataMode) => void;
}

// Top bar: app name, connection status and the Live API / Demo data toggle.
export function TopBar({ mode, reachable, fellBack, onModeChange }: Props) {
  let dot = "bg-muted-foreground";
  let text = `Connecting to ${API_HOST}…`;
  if (mode === "demo") {
    text = fellBack ? `Demo data (${API_HOST} unreachable)` : "Demo data";
    dot = "bg-level-warn";
  } else if (reachable === true) {
    text = `Connected to ${API_HOST}`;
    dot = "bg-status-ok";
  } else if (reachable === false) {
    text = "Unreachable";
    dot = "bg-level-error";
  }

  return (
    <header className="flex h-11 items-center justify-between gap-4 border-b bg-card px-4">
      <h1 className="text-sm font-semibold text-foreground">Log Aggregation System</h1>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />
          {text}
        </span>
        <div className="flex rounded border text-xs" role="group" aria-label="Data source">
          {(["live", "demo"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => onModeChange(m)}
              className={cn(
                "px-2.5 py-1 first:rounded-l-[3px] last:rounded-r-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === m ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                m === "demo" && "border-l",
              )}
            >
              {m === "live" ? "Live API" : "Demo data"}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
