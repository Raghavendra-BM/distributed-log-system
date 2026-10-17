// All data fetching lives here. Each function takes the data mode and either
// calls the collector REST API or the in-browser demo data layer.

import { API_BASE_URL } from "./config";
import { mockGetLogs, mockGetStats } from "./mock";
import type { DataMode, LogQuery, LogsResponse, StatsResponse } from "./types";

function buildQuery(query: LogQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchLogs(mode: DataMode, query: LogQuery): Promise<LogsResponse> {
  if (mode === "demo") return mockGetLogs(query);
  return getJson<LogsResponse>(`/logs${buildQuery(query)}`);
}

export async function fetchStats(mode: DataMode): Promise<StatsResponse> {
  if (mode === "demo") return mockGetStats();
  return getJson<StatsResponse>("/stats");
}

/** ISO string for "n seconds ago", in UTC. */
export const secondsAgo = (n: number) => new Date(Date.now() - n * 1000).toISOString();

/** Errors in the last 60 seconds. */
export function fetchRecentErrors(mode: DataMode) {
  return fetchLogs(mode, { level: "ERROR", from: secondsAgo(60), limit: 1000 });
}

/** All logs in the last 60 seconds (used for "logs per minute"). */
export function fetchRecentLogs(mode: DataMode) {
  return fetchLogs(mode, { from: secondsAgo(60), limit: 1000 });
}
