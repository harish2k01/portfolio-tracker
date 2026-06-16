import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
  tone?: "cyan" | "emerald" | "amber" | "rose" | "slate";
};

const toneStyles = {
  cyan: "bg-blue-500/10 text-[var(--primary)] ring-blue-600/15",
  emerald: "bg-[var(--positive-soft)] text-[var(--positive)] ring-[var(--positive)]/15",
  amber: "bg-[var(--warning-soft)] text-[var(--warning)] ring-[var(--warning)]/15",
  rose: "bg-[var(--negative-soft)] text-[var(--negative)] ring-[var(--negative)]/15",
  slate: "bg-slate-500/10 text-[var(--muted)] ring-slate-500/15",
};

export function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "amber",
}: MetricCardProps) {
  return (
    <div className="motion-card rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 hover:border-[var(--line-strong)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {label}
          </p>
          <p className="mt-3 truncate text-2xl font-semibold text-[var(--foreground)]">{value}</p>
        </div>
        <div className={cn("rounded-md p-2 ring-1", toneStyles[tone])}>
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
      {helper ? <p className="mt-3 text-sm text-[var(--muted)]">{helper}</p> : null}
    </div>
  );
}
