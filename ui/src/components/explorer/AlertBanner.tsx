// Solid red strip shown when there are many errors in the last 60 seconds.
export function AlertBanner({
  count,
  threshold,
  services,
}: {
  count: number;
  threshold: number;
  services: string[];
}) {
  return (
    <div role="alert" className="bg-destructive px-4 py-1.5 text-[13px] font-medium text-destructive-foreground">
      {count} errors in the last 60 seconds (threshold {threshold}): {services.join(", ")}
    </div>
  );
}