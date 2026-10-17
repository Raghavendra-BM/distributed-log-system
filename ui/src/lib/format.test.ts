import { describe, expect, it } from "vitest";
import { formatTime } from "./format";
import { mockGetLogs } from "./mock";

describe("formatTime", () => {
  it("shows only time with milliseconds for today", () => {
    const d = new Date(2026, 9, 16, 9, 5, 3, 7);
    expect(formatTime(d.toISOString(), new Date(2026, 9, 16, 12))).toBe("09:05:03.007");
  });
  it("adds the date when not today", () => {
    const d = new Date(2026, 9, 10, 9, 5, 3, 7);
    expect(formatTime(d.toISOString(), new Date(2026, 9, 16, 12))).toBe("2026-10-10 09:05:03.007");
  });
});

describe("mock logs", () => {
  it("since_id returns only newer rows", () => {
    const first = mockGetLogs({ limit: 10 });
    const max = first.logs[0]!.row_id;
    expect(mockGetLogs({ since_id: max }).logs.every((l) => l.row_id > max)).toBe(true);
  });
  it("level filter is case-insensitive", () => {
    expect(mockGetLogs({ level: "error", limit: 50 }).logs.every((l) => l.level === "ERROR")).toBe(true);
  });
});
