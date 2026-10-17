import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLogs, fetchRecentErrors, fetchRecentLogs, fetchStats, secondsAgo } from "@/lib/api";
import {
  ALERT_INTERVAL_MS, ERROR_ALERT_THRESHOLD, INITIAL_LIMIT, MAX_ROWS, STATS_INTERVAL_MS, TAIL_INTERVAL_MS,
} from "@/lib/config";
import { formatNumber } from "@/lib/format";
import type { DataMode, LogEntry, LogQuery, TimeRange } from "@/lib/types";
import { useInterval } from "@/hooks/use-interval";
import { TopBar } from "@/components/explorer/TopBar";
import { AlertBanner } from "@/components/explorer/AlertBanner";
import { StatsStrip, type Stats } from "@/components/explorer/StatsStrip";
import { FilterBar, EMPTY_FILTERS, type Filters } from "@/components/explorer/FilterBar";
import { LogTable } from "@/components/explorer/LogTable";
import { LogDrawer } from "@/components/explorer/LogDrawer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Log explorer · Log Aggregation System" },
      { name: "description", content: "Search, filter and live-tail logs from the distributed log collector." },
      { property: "og:title", content: "Log explorer · Log Aggregation System" },
      { property: "og:description", content: "Search, filter and live-tail logs from the distributed log collector." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LogExplorer,
});

const RANGE_SECONDS: Record<TimeRange, number | null> = { "5m": 300, "15m": 900, "1h": 3600, all: null };

/** Turns the UI filters into API query parameters. */
function toQuery(f: Filters): LogQuery {
  const secs = RANGE_SECONDS[f.range];
  return {
    service: f.service || undefined,
    level: f.level || undefined,
    q: f.q || undefined,
    from: secs ? secondsAgo(secs) : undefined,
  };
}

// The whole page: holds state, polls the data source and wires the components together.
function LogExplorer() {
  const [mode, setMode] = useState<DataMode>("live");
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [fellBack, setFellBack] = useState(false);
  const autoFallback = useRef(true); // only fall back automatically on first failure

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [liveTail, setLiveTail] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [alert, setAlert] = useState<{ count: number; services: string[] } | null>(null);
  const maxRowId = useRef(0);
  const loadingRef = useRef(true); // true while the initial load is in flight

  const onSuccess = useCallback(() => {
    if (mode === "live") {
      setReachable(true);
      autoFallback.current = false;
    }
  }, [mode]);

  const onFailure = useCallback(() => {
    setReachable(false);
    if (autoFallback.current) {
      autoFallback.current = false;
      setFellBack(true);
      setMode("demo");
    } else {
      setError(true);
    }
  }, []);

  const changeMode = (m: DataMode) => {
    setFellBack(false);
    setReachable(null);
    setError(false);
    setMode(m);
  };

  // Remember every service name we have seen, for the service select.
  const rememberServices = (rows: LogEntry[]) =>
    setServices((prev) => {
      const set = new Set(prev);
      rows.forEach((r) => set.add(r.service));
      return set.size === prev.length ? prev : [...set].sort();
    });

  // Initial load whenever the mode or filters change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadingRef.current = true;
    setError(false);
    fetchLogs(mode, { ...toQuery(filters), limit: INITIAL_LIMIT })
      .then((res) => {
        if (cancelled) return;
        setLogs(res.logs);
        setFreshIds(new Set());
        maxRowId.current = res.logs[0]?.row_id ?? 0;
        rememberServices(res.logs);
        onSuccess();
      })
      .catch(() => !cancelled && onFailure())
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        loadingRef.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [mode, filters, onSuccess, onFailure]);

  // Live tail: ask only for rows newer than the highest row_id we have.
  useInterval(
    async () => {
      if (loadingRef.current) return;
      try {
        const res = await fetchLogs(mode, { ...toQuery(filters), since_id: maxRowId.current, limit: 1000 });
        onSuccess();
        setError(false);
        if (res.logs.length === 0) return;
        maxRowId.current = Math.max(maxRowId.current, res.logs[0]!.row_id);
        rememberServices(res.logs);
        setFreshIds(new Set(res.logs.map((l) => l.row_id)));
        setLogs((prev) => [...res.logs, ...prev].slice(0, MAX_ROWS));
      } catch {
        onFailure();
      }
    },
    TAIL_INTERVAL_MS,
    liveTail,
    `${mode}-${JSON.stringify(filters)}`,
  );

  // Stats strip, every 3 seconds.
  useInterval(
    async () => {
      try {
        const [s, errs, recent] = await Promise.all([fetchStats(mode), fetchRecentErrors(mode), fetchRecentLogs(mode)]);
        setStats({ total: s.total_logs, queueSize: s.queue_size, errorsLastMinute: errs.count, logsPerMinute: recent.count });
      } catch {
        setStats(null);
      }
    },
    STATS_INTERVAL_MS,
    true,
    mode,
  );

  // Error alert banner, every 5 seconds.
  useInterval(
    async () => {
      try {
        const res = await fetchRecentErrors(mode);
        const svc = [...new Set(res.logs.map((l) => l.service))];
        setAlert(res.count >= ERROR_ALERT_THRESHOLD ? { count: res.count, services: svc } : null);
      } catch {
        setAlert(null);
      }
    },
    ALERT_INTERVAL_MS,
    true,
    mode,
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopBar mode={mode} reachable={reachable} fellBack={fellBack} onModeChange={changeMode} />
      {alert && <AlertBanner count={alert.count} threshold={ERROR_ALERT_THRESHOLD} services={alert.services} />}
      <StatsStrip stats={stats} />
      <FilterBar
        filters={filters}
        services={services}
        liveTail={liveTail}
        onChange={setFilters}
        onLiveTailChange={setLiveTail}
      />
      <LogTable
        logs={logs}
        freshIds={freshIds}
        loading={loading}
        error={error}
        onSelect={setSelected}
        onUseDemo={() => changeMode("demo")}
      />
      <footer className="flex h-8 items-center border-t bg-card px-4 text-xs tabular-nums text-muted-foreground">
        Showing {formatNumber(logs.length)}
        {stats ? ` of ${formatNumber(stats.total)}` : ""}
      </footer>
      <LogDrawer log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
