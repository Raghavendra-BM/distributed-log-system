// Small formatting helpers.

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** Local time as HH:mm:ss.SSS, prefixed with YYYY-MM-DD when not today. */
export function formatTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay ? time : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`;
}

export const formatNumber = (n: number) => n.toLocaleString("en-US");
