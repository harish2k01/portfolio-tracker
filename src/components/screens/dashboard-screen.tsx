"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, CalendarClock, CheckCircle2, Clock3, Landmark, Plus, RefreshCcw } from "lucide-react";
import { useApp } from "@/components/app/app-shell";
import { AllocationBars, StockConcentration, buildAssetSplit } from "@/components/dashboard/look-through";
import { PageHeader } from "@/components/screens/page-header";
import { Panel, PanelHeader, signed } from "@/components/screens/panel";
import { buttonVariants } from "@/components/ui/button";
import { formatCompactCurrency, formatCurrency } from "@/lib/analytics";
import { buildAttentionItems, type AttentionItem } from "@/lib/attention";
import { chartPalette } from "@/lib/chart-colors";
import { assetTypeLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { PortfolioDashboard, PortfolioTimelinePoint } from "@/types/portfolio";

const ranges = ["1M", "3M", "6M", "1Y", "ALL"] as const;
type Range = (typeof ranges)[number];
const rangeLabels: Record<Range, string> = {
  "1M": "past month",
  "3M": "past 3 months",
  "6M": "past 6 months",
  "1Y": "past year",
  ALL: "since you started",
};
const investmentCategories = new Set(["Mutual Funds", "Stocks", "ETFs"]);

function useMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

function pointsInRange(data: PortfolioTimelinePoint[], range: Range) {
  if (range === "ALL") {
    return data;
  }

  const days = range === "1M" ? 31 : range === "3M" ? 93 : range === "6M" ? 186 : 366;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const points = data.filter((point) => new Date(point.date) >= cutoff);

  return points.length > 1 ? points : data;
}

function formatAxisDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "2-digit" } : {}),
  });
}

function percent(value: number) {
  return `${Math.abs(value).toFixed(1)}%`;
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export function DashboardScreen() {
  const { dashboard } = useApp();
  const mounted = useMounted();

  if (!dashboard) {
    return null;
  }

  const isEmpty = dashboard.holdings.length === 0 && dashboard.netWorthAssets.length === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={mounted ? greeting() : "Overview"}
        description={
          mounted
            ? new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
            : " "
        }
        actions={
          <>
            <Link href="/assets" className={cn(buttonVariants({ variant: "secondary" }), "h-11")}>
              <RefreshCcw className="h-4 w-4" aria-hidden />
              Update a balance
            </Link>
            <Link href="/activity" className={cn(buttonVariants(), "h-11")}>
              <Plus className="h-4 w-4" aria-hidden />
              Add transaction
            </Link>
          </>
        }
      />

      {isEmpty ? <GettingStarted /> : null}

      <NetWorthHero dashboard={dashboard} mounted={mounted} />

      <div className="grid gap-5 lg:grid-cols-2">
        <AttentionPanel dashboard={dashboard} />
        <AllocationPanel dashboard={dashboard} />
      </div>

      <TopHoldings dashboard={dashboard} />

      <LookThrough dashboard={dashboard} />
    </div>
  );
}

function GettingStarted() {
  return (
    <Panel className="p-5">
      <h2 className="text-base font-semibold">Start with what you already have</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Add a fund or stock you hold, or a bank balance, FD, EPF or PPF value. Prices for funds and stocks update by themselves.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/search" className={buttonVariants()}>
          Find a fund or stock
        </Link>
        <Link href="/activity" className={buttonVariants({ variant: "secondary" })}>
          Import a statement
        </Link>
        <Link href="/assets" className={buttonVariants({ variant: "secondary" })}>
          Add an account or deposit
        </Link>
      </div>
    </Panel>
  );
}

function NetWorthHero({ dashboard, mounted }: { dashboard: PortfolioDashboard; mounted: boolean }) {
  const [range, setRange] = useState<Range>("1Y");
  const { summary } = dashboard;
  const chartData = useMemo(() => pointsInRange(dashboard.timeline, range), [dashboard.timeline, range]);
  const first = chartData[0];
  const last = chartData[chartData.length - 1];
  const change = first && last ? last.current - first.current : 0;
  const newMoney = first && last ? last.invested - first.invested : 0;
  const changePercent = first?.current ? (change / first.current) * 100 : 0;
  const nextSip = dashboard.sips
    .filter((sip) => sip.status === "ACTIVE" && sip.nextDueDate)
    .map((sip) => sip.nextDueDate as string)
    .sort()[0];

  return (
    <Panel aria-label="Net worth" className="flex flex-wrap">
      <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--muted)]">Net worth</span>
            <span className="font-display text-[40px] font-semibold leading-none tracking-tight sm:text-[44px]">
              {formatCurrency(summary.totalNetWorth)}
            </span>
            {chartData.length > 1 ? (
              <span className="flex flex-wrap gap-x-2 text-sm text-[var(--muted)]">
                <span className={cn("font-semibold", change >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]")}>
                  {signed(change, formatCurrency)} ({change >= 0 ? "+" : "−"}
                  {percent(changePercent)})
                </span>
                <span>{rangeLabels[range]}</span>
                {newMoney > 0 ? <span>· {formatCurrency(newMoney)} of it new money</span> : null}
              </span>
            ) : null}
          </div>
          <div role="group" aria-label="Chart range" className="flex gap-0.5 rounded-xl bg-[var(--panel-soft)] p-1">
            {ranges.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={range === item}
                className={cn(
                  "h-9 min-w-11 rounded-lg px-2 text-sm font-medium transition",
                  range === item
                    ? "bg-[var(--panel)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
                onClick={() => setRange(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {chartData.length > 1 && mounted ? (
          <div className="h-[260px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--line)" strokeOpacity={0.7} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  tickFormatter={formatAxisDate}
                />
                <YAxis
                  width={72}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  tickFormatter={formatCompactCurrency}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    color: "var(--foreground)",
                  }}
                  labelFormatter={(value) => formatAxisDate(String(value))}
                  formatter={(value, name) => [formatCurrency(Number(value)), name === "current" ? "Net worth" : "Money invested"]}
                />
                <Area
                  type="monotone"
                  dataKey="current"
                  stroke="var(--accent)"
                  strokeWidth={2.25}
                  fill="url(#netWorthFill)"
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
                <Line type="monotone" dataKey="invested" stroke="var(--chart-invested)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[200px] items-center justify-center rounded-xl bg-[var(--panel-soft)] p-6 text-center text-sm text-[var(--muted)]">
            {mounted ? "Your net-worth chart appears once you have dated investments or balances." : null}
          </div>
        )}

        <div className="flex gap-5 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 bg-[var(--accent)]" aria-hidden />
            Net worth
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 border-t-2 border-dashed border-[var(--chart-invested)]" aria-hidden />
            Money invested
          </span>
        </div>
      </div>

      <dl className="grid flex-[1_1_260px] grid-cols-2 gap-px border-t border-[var(--line)] bg-[var(--line)] lg:grid-cols-1 lg:border-l lg:border-t-0">
        <HeroStat label="Invested" value={formatCurrency(summary.netWorthCostBasis)} />
        <HeroStat
          label="Total gain"
          value={signed(summary.netWorthGain, formatCurrency)}
          tone={summary.netWorthGain >= 0 ? "positive" : "negative"}
          helper={`${summary.netWorthGain >= 0 ? "+" : "−"}${percent(summary.netWorthGainPercent)} · realised ${formatCurrency(summary.realizedGain)}`}
        />
        <HeroStat
          label="Investments"
          value={formatCurrency(summary.investmentValue)}
          helper={`${summary.holdingsCount} holdings · ${formatCompactCurrency(summary.otherAssetsValue)} in other assets`}
        />
        <HeroStat
          label="Monthly SIP"
          value={formatCurrency(summary.monthlySipTotal)}
          helper={`${summary.activeSipCount} active${nextSip ? ` · next ${formatShortDate(nextSip)}` : ""}`}
        />
      </dl>
    </Panel>
  );
}

function formatShortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function HeroStat({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1 bg-[var(--panel)] px-5 py-4 sm:px-6">
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd
        className={cn(
          "truncate text-xl font-semibold",
          tone === "positive" && "text-[var(--positive)]",
          tone === "negative" && "text-[var(--negative)]",
        )}
      >
        {value}
      </dd>
      {helper ? <dd className="truncate text-xs text-[var(--muted)]">{helper}</dd> : null}
    </div>
  );
}

const attentionStyle: Record<AttentionItem["kind"], { icon: typeof CalendarClock; tint: string; action: string }> = {
  sip: { icon: CalendarClock, tint: "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]", action: "Review" },
  maturity: { icon: Landmark, tint: "bg-[var(--warning-soft)] text-[var(--warning)]", action: "Decide" },
  stale: { icon: Clock3, tint: "bg-[var(--panel-soft)] text-[var(--muted)]", action: "Update" },
};

function AttentionPanel({ dashboard }: { dashboard: PortfolioDashboard }) {
  const items = useMemo(
    () => buildAttentionItems({ sips: dashboard.sips, netWorthAssets: dashboard.netWorthAssets }),
    [dashboard.sips, dashboard.netWorthAssets],
  );
  const shown = items.slice(0, 5);

  return (
    <Panel aria-labelledby="attention-title">
      <PanelHeader
        id="attention-title"
        title="Needs your attention"
        action={
          items.length ? (
            <span className="rounded-full bg-[var(--warning-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--warning)]">
              {items.length}
            </span>
          ) : null
        }
      />
      {shown.length ? (
        <ul className="px-5 pb-3">
          {shown.map((item) => {
            const style = attentionStyle[item.kind];
            const Icon = style.icon;

            return (
              <li key={item.id} className="flex items-center gap-3.5 border-t border-[var(--line)] py-3">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", style.tint)}>
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="block truncate text-[13px] text-[var(--muted)]">{item.detail}</span>
                </span>
                <Link href={item.href} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-9 shrink-0 px-3")}>
                  {style.action}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mx-5 mb-5 flex items-center gap-3 rounded-xl bg-[var(--panel-soft)] p-4 text-sm text-[var(--muted)]">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--positive)]" aria-hidden />
          Nothing needs you this week. SIPs, maturing deposits and out-of-date balances show up here.
        </div>
      )}
    </Panel>
  );
}

function AllocationPanel({ dashboard }: { dashboard: PortfolioDashboard }) {
  const points = dashboard.allocations.netWorth.filter((point) => point.value > 0);

  return (
    <Panel aria-labelledby="allocation-title" className="flex flex-col">
      <PanelHeader id="allocation-title" title="Where your money is" />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
        {points.length ? (
          <>
            <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Net worth allocation">
              {points.map((point, index) => (
                <span key={point.name} style={{ width: `${point.value}%`, background: chartPalette[index % chartPalette.length] }} />
              ))}
            </div>
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {points.map((point, index) => (
                <li key={point.name}>
                  <Link
                    href={investmentCategories.has(point.name) ? "/holdings" : "/assets"}
                    className="flex min-h-10 items-center gap-2.5 rounded-lg px-1.5 text-sm transition hover:bg-[var(--row-hover)]"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: chartPalette[index % chartPalette.length] }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[var(--muted)]">{point.name}</span>
                    {point.amount ? <span className="hidden text-xs text-[var(--muted)] xl:inline">{formatCompactCurrency(point.amount)}</span> : null}
                    <span className="w-12 text-right font-semibold">{point.value.toFixed(point.value >= 10 ? 0 : 1)}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="rounded-xl bg-[var(--panel-soft)] p-4 text-sm text-[var(--muted)]">
            Add investments, accounts, deposits or retirement savings to see your split.
          </p>
        )}
      </div>
    </Panel>
  );
}

function TopHoldings({ dashboard }: { dashboard: PortfolioDashboard }) {
  const { openAsset } = useApp();
  const total = dashboard.summary.investmentValue || 1;
  const top = [...dashboard.holdings].sort((a, b) => b.currentValue - a.currentValue).slice(0, 5);

  if (!top.length) {
    return null;
  }

  return (
    <Panel aria-labelledby="top-holdings-title">
      <PanelHeader
        id="top-holdings-title"
        title="Top holdings"
        action={
          <Link href="/holdings" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline">
            View all {dashboard.holdings.length}
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-right text-xs text-[var(--muted)]">
              <th scope="col" className="border-t border-[var(--line)] px-5 py-2.5 text-left font-medium">Holding</th>
              <th scope="col" className="border-t border-[var(--line)] px-4 py-2.5 font-medium">Value</th>
              <th scope="col" className="border-t border-[var(--line)] px-4 py-2.5 font-medium">Gain</th>
              <th scope="col" className="border-t border-[var(--line)] px-5 py-2.5 font-medium">Weight</th>
            </tr>
          </thead>
          <tbody>
            {top.map((holding) => {
              const weight = (holding.currentValue / total) * 100;

              return (
                <tr key={holding.assetId} className="text-right transition hover:bg-[var(--row-hover)]">
                  <td className="border-t border-[var(--line)] px-5 py-3 text-left">
                    <button type="button" className="text-left" onClick={() => openAsset(holding.assetId)}>
                      <span className="block font-medium hover:underline">{holding.name}</span>
                      <span className="block text-xs text-[var(--muted)]">
                        {holding.assetClass} · {assetTypeLabel(holding.type)}
                      </span>
                    </button>
                  </td>
                  <td className="border-t border-[var(--line)] px-4 py-3 font-medium">{formatCurrency(holding.currentValue)}</td>
                  <td
                    className={cn(
                      "border-t border-[var(--line)] px-4 py-3",
                      holding.gain >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]",
                    )}
                  >
                    {signed(holding.gain, formatCurrency)}
                    <span className="block text-xs">
                      {holding.gainPercent >= 0 ? "+" : "−"}
                      {percent(holding.gainPercent)}
                    </span>
                  </td>
                  <td className="border-t border-[var(--line)] px-5 py-3">
                    <span className="inline-flex items-center gap-2.5">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--panel-soft)]">
                        <span className="block h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(weight, 100)}%` }} />
                      </span>
                      {weight.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function LookThrough({ dashboard }: { dashboard: PortfolioDashboard }) {
  const assetSplit = useMemo(
    () => buildAssetSplit(dashboard.allocations.assets, dashboard.holdings),
    [dashboard.allocations.assets, dashboard.holdings],
  );

  if (!dashboard.holdings.length) {
    return null;
  }

  const toHoldings = (name: string) => `/holdings?filter=${encodeURIComponent(name)}`;

  return (
    <section aria-labelledby="look-through-title" className="space-y-3">
      <div>
        <h2 id="look-through-title" className="text-base font-semibold">Inside your investments</h2>
        <p className="text-[13px] text-[var(--muted)]">Fund portfolios unpacked into what they actually own. Select a row to see the holdings behind it.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <LinkedBars title="Asset class" data={assetSplit} hrefFor={toHoldings} emptyText="Add holdings to see Equity, Debt and Commodities." />
        <LinkedBars
          title="Market cap"
          data={dashboard.allocations.marketCap}
          hrefFor={toHoldings}
          emptyText="Market-cap data is unavailable for these holdings."
        />
        <LinkedBars
          title="Sectors"
          data={dashboard.allocations.sectors}
          hrefFor={toHoldings}
          emptyText="Sector data is unavailable for these holdings."
          barColor="var(--chart-4)"
        />
      </div>
      <StockConcentration data={dashboard.allocations.stockConcentration} />
    </section>
  );
}

function LinkedBars({
  hrefFor,
  ...props
}: Omit<React.ComponentProps<typeof AllocationBars>, "onSelect"> & { hrefFor: (name: string) => string }) {
  const router = useRouter();

  return <AllocationBars {...props} onSelect={(name) => router.push(hrefFor(name))} />;
}
