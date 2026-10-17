// Single place for app configuration.

export const API_BASE_URL: string = (
  import.meta.env['VITE_API_BASE_URL'] || "http://127.0.0.1:8000"
).replace(/\/$/, "");

/** Host part shown in the status, e.g. "127.0.0.1:8000". */
export const API_HOST = API_BASE_URL.replace(/^https?:\/\//, "");

export const MAX_ROWS = 500;
export const INITIAL_LIMIT = 100;
export const TAIL_INTERVAL_MS = 2000;
export const STATS_INTERVAL_MS = 3000;
export const ALERT_INTERVAL_MS = 5000;
/** Errors in the last 60 seconds that trigger the alert banner. */
export const ERROR_ALERT_THRESHOLD = 40;
