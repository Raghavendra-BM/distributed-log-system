import { formatNumber } from "@/lib/format";

export interface Stats {
  total: number;
  errorsLastMinute: number;
  logsPerMinute: number;
  queueSize: number;
}

// Four plain figures in one row, separated by thin lines.
export function StatsStrip({ stats }: { stats: Stats | null }) {
  const items = [
    { label: "Total logs", value: stats?.total },
    { label: "Errors in last minute", value: stats?.errorsLastMinute, error: true },
    { label: "Logs per minute", value: stats?.logsPerMinute },
    { label: "Queue size", value: stats?.queueSize },
  ];
  return (
    <dl className="grid grid-cols-2 divide-x border-b bg-card md:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="px-4 py-2">
          <dt className="text-xs text-muted-foreground">{it.label}</dt>
          <dd
            className={
              "mt-0.5 text-lg font-medium tabular-nums " +
              (it.error && (it.value ?? 0) > 0 ? "text-level-error" : "text-foreground")
            }
          >
            {it.value === undefined ? "–" : formatNumber(it.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
