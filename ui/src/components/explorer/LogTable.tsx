import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import { API_BASE_URL } from "@/lib/config";
import type { LogEntry } from "@/lib/types";
import { LevelBadge } from "./LevelBadge";

interface Props {
  logs: LogEntry[];
  freshIds: Set<number>;
  loading: boolean;
  error: boolean;
  onSelect: (log: LogEntry) => void;
  onUseDemo: () => void;
}

/** Newest first by the timestamp field; row_id breaks exact ties. */
export function byTimestampDesc(a: LogEntry, b: LogEntry): number {
  const diff = Date.parse(b.timestamp) - Date.parse(a.timestamp);
  return diff || b.row_id - a.row_id;
}

// Dense log table with sticky header. Clicking a row opens the detail drawer.
export function LogTable({ logs, freshIds, loading, error, onSelect, onUseDemo }: Props) {
  const rows = useMemo(() => [...logs].sort(byTimestampDesc), [logs]);
  let state: React.ReactNode = null;
  if (error) {
    state = (
      <>
        Cannot reach the collector at {API_BASE_URL}. Check that it is running, or{" "}
        <button type="button" onClick={onUseDemo} className="text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          switch to Demo data
        </button>
        .
      </>
    );
  } else if (loading && logs.length === 0) state = "Loading logs…";
  else if (logs.length === 0) state = "No logs match these filters.";

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-card">
      <table className="w-full table-fixed border-collapse text-[13px]">
        <thead className="sticky top-0 z-10 bg-secondary text-left text-xs text-muted-foreground">
          <tr className="h-7 [&>th]:border-b [&>th]:px-3 [&>th]:font-medium">
            <th className="w-[150px]">Time</th>
            <th className="w-[72px]">Level</th>
            <th className="w-[96px]">Service</th>
            <th className="w-[80px]">Host</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((log) => (
            <tr
              key={log.row_id}
              tabIndex={0}
              onClick={() => onSelect(log)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(log)}
              className={cn(
                "h-8 cursor-pointer border-b hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&>td]:px-3",
                freshIds.has(log.row_id) && "row-new",
              )}
            >
              <td className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">{formatTime(log.timestamp)}</td>
              <td><LevelBadge level={log.level} /></td>
              <td className="truncate">{log.service}</td>
              <td className="truncate text-muted-foreground">{log.host}</td>
              <td className="truncate font-mono text-xs">{log.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {state && <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">{state}</p>}
    </div>
  );
}
