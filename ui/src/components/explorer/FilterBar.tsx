import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { TimeRange } from "@/lib/types";

export interface Filters {
  service: string;
  level: string;
  q: string;
  range: TimeRange;
}

export const EMPTY_FILTERS: Filters = { service: "", level: "", q: "", range: "all" };

interface Props {
  filters: Filters;
  services: string[];
  liveTail: boolean;
  onChange: (f: Filters) => void;
  onLiveTailChange: (on: boolean) => void;
}

const control =
  "h-7 rounded border border-input bg-card px-2 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Filter bar: service, level, search (debounced), time range, live tail, clear.
export function FilterBar({ filters, services, liveTail, onChange, onLiveTailChange }: Props) {
  const [text, setText] = useState(filters.q);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keep input in sync when filters are cleared from outside.
  useEffect(() => setText(filters.q), [filters.q]);

  // Debounce search by 300 ms.
  useEffect(() => {
    if (text === filters.q) return;
    const id = setTimeout(() => onChange({ ...filters, q: text }), 300);
    return () => clearTimeout(id);
  }, [text, filters, onChange]);

  // "/" focuses search unless already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
      <select aria-label="Service" className={control} value={filters.service} onChange={(e) => onChange({ ...filters, service: e.target.value })}>
        <option value="">All services</option>
        {services.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select aria-label="Level" className={control} value={filters.level} onChange={(e) => onChange({ ...filters, level: e.target.value })}>
        <option value="">All levels</option>
        <option value="INFO">INFO</option>
        <option value="WARN">WARN</option>
        <option value="ERROR">ERROR</option>
      </select>
      <div className="relative min-w-56 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        <input
          ref={searchRef}
          type="search"
          aria-label="Search messages"
          placeholder="Search messages"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={`${control} w-full pl-7 pr-7`}
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-[3px] border px-1 font-mono text-[10px] text-muted-foreground">/</kbd>
      </div>
      <select aria-label="Time range" className={control} value={filters.range} onChange={(e) => onChange({ ...filters, range: e.target.value as TimeRange })}>
        <option value="5m">Last 5 minutes</option>
        <option value="15m">Last 15 minutes</option>
        <option value="1h">Last hour</option>
        <option value="all">All time</option>
      </select>
      <label className="ml-1 flex items-center gap-2 text-[13px] text-foreground">
        <Switch checked={liveTail} onCheckedChange={onLiveTailChange} aria-label="Live tail" />
        {liveTail ? "Live tail" : "Paused"}
      </label>
      <button
        type="button"
        onClick={() => onChange(EMPTY_FILTERS)}
        className="ml-auto h-7 rounded px-2 text-[13px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Clear filters
      </button>
    </div>
  );
}
