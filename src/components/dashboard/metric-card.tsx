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
  cyan: "bg-blue-500/10 text-blue-700 ring-blue-600/15",
  emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-500/10 text-amber-700 ring-amber-600/15",
  rose: "bg-rose-500/10 text-rose-700 ring-rose-600/15",
  slate: "bg-slate-500/10 text-slate-600 ring-slate-500/15",
};

export function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "amber",
}: MetricCardProps) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 transition duration-200 hover:border-[var(--line-strong)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          <p className="mt-3 truncate text-2xl font-semibold text-white">{value}</p>
        </div>
        <div className={cn("rounded-md p-2 ring-1", toneStyles[tone])}>
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
      {helper ? <p className="mt-3 text-sm text-slate-400">{helper}</p> : null}
    </div>
  );
}
