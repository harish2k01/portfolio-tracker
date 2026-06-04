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
  cyan: "bg-cyan-300/10 text-cyan-100 ring-cyan-300/20",
  emerald: "bg-emerald-300/10 text-emerald-100 ring-emerald-300/20",
  amber: "bg-amber-300/10 text-amber-100 ring-amber-300/20",
  rose: "bg-rose-300/10 text-rose-100 ring-rose-300/20",
  slate: "bg-slate-300/10 text-slate-100 ring-white/10",
};

export function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "cyan",
}: MetricCardProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.065]">
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
