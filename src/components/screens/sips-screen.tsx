"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useApp } from "@/components/app/app-shell";
import { SipManager } from "@/components/dashboard/sip-manager";
import { PageHeader } from "@/components/screens/page-header";
import { Panel, PanelHeader, StatTile } from "@/components/screens/panel";
import { formatCompactCurrency, formatCurrency } from "@/lib/analytics";
import { localIsoDate } from "@/lib/attention";
import { projectSipDebits } from "@/lib/sip-schedule";
import { cn } from "@/lib/utils";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function useToday() {
  // Server render has no reliable "today" for the viewer; fill it in on the client.
  return useSyncExternalStore(
    () => () => undefined,
    () => localIsoDate(),
    () => null,
  );
}

function monthBounds(today: string) {
  const [year, month] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  return { year, month, lastDay, firstWeekday, from: `${prefix}-01`, to: `${prefix}-${String(lastDay).padStart(2, "0")}`, prefix };
}

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function SipsScreen() {
  const { dashboard, refreshDashboard, openSip } = useApp();
  const today = useToday();
  const sips = useMemo(() => dashboard?.sips ?? [], [dashboard?.sips]);
  const month = today ? monthBounds(today) : null;
  const monthDebits = useMemo(() => (month ? projectSipDebits(sips, month.from, month.to) : []), [sips, month?.from, month?.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const upcoming = useMemo(() => (today ? projectSipDebits(sips, today, addDays(today, 45)).slice(0, 6) : []), [sips, today]);

  if (!dashboard) {
    return null;
  }

  const activeCount = sips.filter((sip) => sip.status === "ACTIVE").length;
  const pausedCount = sips.length - activeCount;
  const monthTotal = monthDebits.reduce((total, debit) => total + debit.amount, 0);
  const byDay = new Map<string, number>();
  for (const debit of monthDebits) {
    byDay.set(debit.date, (byDay.get(debit.date) ?? 0) + debit.amount);
  }
  const next = upcoming[0];

  return (
    <div className="space-y-5">
      <PageHeader
        title="SIPs & cash flow"
        description={`${formatCurrency(dashboard.summary.monthlySipTotal)} a month across ${activeCount} active ${activeCount === 1 ? "SIP" : "SIPs"}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Monthly commitment" value={formatCurrency(dashboard.summary.monthlySipTotal)} helper="Weekly and quarterly SIPs scaled to a month" />
        <StatTile label="Active SIPs" value={String(activeCount)} helper={pausedCount ? `${pausedCount} paused` : "None paused"} />
        <StatTile label="Next debit" value={next ? formatCurrency(next.amount) : "—"} helper={next ? `${shortDate(next.date)} · ${next.name}` : "No active SIPs"} />
        <StatTile label="Debits this month" value={formatCurrency(monthTotal)} helper={`${monthDebits.length} ${monthDebits.length === 1 ? "date" : "dates"}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel aria-labelledby="sip-calendar-title">
          <PanelHeader
            id="sip-calendar-title"
            title={month ? new Date(Date.UTC(month.year, month.month - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }) : "This month"}
            description="SIP debit dates"
          />
          <div className="grid grid-cols-7 gap-1.5 px-5 pb-5 text-center">
            {weekdays.map((day) => (
              <span key={day} className="pb-1 text-xs text-[var(--muted)]">
                {day}
              </span>
            ))}
            {month
              ? [
                  ...Array.from({ length: month.firstWeekday }, (_, index) => <span key={`pad-${index}`} aria-hidden />),
                  ...Array.from({ length: month.lastDay }, (_, index) => {
                    const day = index + 1;
                    const iso = `${month.prefix}-${String(day).padStart(2, "0")}`;
                    const amount = byDay.get(iso);
                    const isToday = iso === today;
                    const isPast = today ? iso < today : false;

                    return (
                      <span
                        key={iso}
                        className={cn(
                          "flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[13px]",
                          amount
                            ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] font-medium text-[var(--accent)]"
                            : "bg-[var(--row-hover)] text-[var(--muted)]",
                          isPast && amount && "opacity-60",
                          isToday && "ring-2 ring-[var(--foreground)] ring-offset-1 ring-offset-[var(--panel)]",
                        )}
                      >
                        {day}
                        {amount ? <span className="text-[10px] font-semibold">{formatCompactCurrency(amount)}</span> : null}
                        <span className="sr-only">{amount ? `${formatCurrency(amount)} due` : "no debit"}</span>
                      </span>
                    );
                  }),
                ]
              : null}
          </div>
        </Panel>

        <Panel aria-labelledby="sip-upcoming-title">
          <PanelHeader id="sip-upcoming-title" title="Coming up" description="Next six weeks" />
          {upcoming.length ? (
            <ul className="px-5 pb-3">
              {upcoming.map((debit) => (
                <li key={`${debit.sipId}-${debit.date}`} className="flex min-h-14 items-center gap-3 border-t border-[var(--line)] py-2.5">
                  <span className="w-[86px] shrink-0 text-[13px] text-[var(--muted)]">{shortDate(debit.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{debit.name}</span>
                  <span className="text-sm font-semibold">{formatCurrency(debit.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mx-5 mb-5 rounded-xl bg-[var(--panel-soft)] p-4 text-sm text-[var(--muted)]">
              No active SIPs. Add one below and its debit dates appear here.
            </p>
          )}
        </Panel>
      </div>

      <SipManager sips={sips} onChanged={refreshDashboard} onOpenSip={openSip} />
    </div>
  );
}
