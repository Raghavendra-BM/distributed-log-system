// Shared types for the log explorer. Shapes match the collector REST API exactly.

export type Level = "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  row_id: number;
  id: string;
  timestamp: string; // UTC ISO
  received_at: string; // UTC ISO
  service: string;
  level: Level;
  host: string;
  seq: number;
  message: string;
}

export interface LogsResponse {
  count: number;
  logs: LogEntry[];
}

export interface StatsResponse {
  queue_size: number;
  total_logs: number;
  by_level: Record<Level, number>;
}

export interface LogQuery {
  service?: string | undefined;
  level?: string | undefined;
  q?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  since_id?: number | undefined;
  limit?: number | undefined;
}

/** Where data comes from: the real collector or the in-browser mock. */
export type DataMode = "live" | "demo";

export type TimeRange = "5m" | "15m" | "1h" | "all";
