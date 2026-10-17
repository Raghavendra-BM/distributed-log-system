import { describe, expect, it } from "vitest";
import { byTimestampDesc } from "./LogTable";
import type { LogEntry } from "@/lib/types";

const row = (row_id: number, timestamp: string, service: string): LogEntry => ({
  row_id,
  timestamp,
  id: String(row_id),
  received_at: timestamp,
  service,
  level: "INFO",
  host: "node-1",
  seq: 1,
  message: "",
});

describe("byTimestampDesc", () => {
  it("orders rows by timestamp, newest first, across services", () => {
    const rows = [row(3, "2026-10-16T10:12:05.000Z", "order"), row(1, "2026-10-16T10:12:09.000Z", "payment"), row(2, "2026-10-16T10:12:07.000Z", "inventory")];
    expect([...rows].sort(byTimestampDesc).map((r) => r.service)).toEqual(["payment", "inventory", "order"]);
  });
  it("breaks exact timestamp ties by row_id", () => {
    const rows = [row(1, "2026-10-16T10:12:07.000Z", "order"), row(9, "2026-10-16T10:12:07.000Z", "payment")];
    expect([...rows].sort(byTimestampDesc).map((r) => r.row_id)).toEqual([9, 1]);
  });
});