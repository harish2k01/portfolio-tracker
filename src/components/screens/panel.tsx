import { cn } from "@/lib/utils";

/** The flat white card every revamped screen is built from. */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("min-w-0 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]", className)}
      {...props}
    />
  );
}

export function PanelHeader({
  title,
  description,
  action,
  id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold text-[var(--foreground)]">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-[13px] text-[var(--muted)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3.5">
      <span className="text-[13px] text-[var(--muted)]">{label}</span>
      <span
        className={cn(
          "truncate text-[22px] font-semibold leading-tight",
          tone === "positive" && "text-[var(--positive)]",
          tone === "negative" && "text-[var(--negative)]",
        )}
      >
        {value}
      </span>
      {helper ? <span className="truncate text-xs text-[var(--muted)]">{helper}</span> : null}
    </div>
  );
}

export function signed(value: number, format: (value: number) => string) {
  if (value > 0) {
    return `+${format(value)}`;
  }

  if (value < 0) {
    return `−${format(Math.abs(value))}`;
  }

  return format(0);
}
