import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { LogEntry } from "@/lib/types";
import { LevelBadge } from "./LevelBadge";

// Right-side drawer with the full log record as JSON and a copy button.
// Escape closes it (handled by the sheet).
export function LogDrawer({ log, onClose }: { log: LogEntry | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const json = log ? JSON.stringify(log, null, 2) : "";

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Sheet open={log !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 rounded-none border-l p-0 sm:max-w-xl">
        {log && (
          <>
            <div className="flex items-center gap-3 border-b px-4 py-3 pr-12">
              <LevelBadge level={log.level} />
              <SheetTitle className="text-sm font-semibold">
                {log.service} · {log.host} · seq {log.seq}
              </SheetTitle>
            </div>
            <SheetDescription className="border-b px-4 py-2 font-mono text-xs text-foreground">{log.message}</SheetDescription>
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs text-muted-foreground">Full record</span>
              <button
                type="button"
                onClick={copy}
                className="flex h-7 items-center gap-1.5 rounded border px-2 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="mx-4 mb-4 flex-1 overflow-auto rounded border bg-secondary p-3 font-mono text-xs leading-5">{json}</pre>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
