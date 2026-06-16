"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Area,
  Cell,
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, CalendarClock, IndianRupee, Landmark, PiggyBank, TrendingUp, X } from "lucide-react";
import { formatCompactCurrency, formatCurrency } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { AllocationPoint, HoldingRow, PortfolioDashboard, PortfolioTimelinePoint } from "@/types/portfolio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/metric-card";

const allocationPalettes = {
  "Asset split": ["#0787e5", "#00a866", "#f3a325"],
  "Market cap split": ["#6246ea", "#0787e5", "#00a866"],
  "Sector allocation": [
    "#0787e5",
    "#00a866",
    "#f3a325",
    "#8b5cf6",
    "#e72b4d",
    "#00a7b5",
    "#f97316",
    "#84cc16",
    "#ec4899",
    "#64748b",
  ],
} as const;
const assetClassOrder = ["Equity", "Debt", "Commodities"] as const;
const portfolioRanges = ["1M", "3M", "6M", "1Y", "ALL"] as const;
const stockConcentrationColors = ["#0787e5", "#00a866", "#f3a325", "#8b5cf6", "#e72b4d"];

const tooltipStyle = {
  background: "#111827",
  border: "1px solid rgba(148,163,184,0.24)",
  borderRadius: "8px",
  color: "#f8fafc",
};

type AssetClassName = (typeof assetClassOrder)[number];

function useMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

function EmptyState({ title, action }: { title: string; action?: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.035] p-8 text-center">
      <p className="text-sm text-slate-300">{title}</p>
      {action ? (
        <Button type="button" className="mt-4" onClick={action}>
          Add first entry
        </Button>
      ) : null}
    </div>
  );
}

function filteredTimeline(data: PortfolioTimelinePoint[], range: (typeof portfolioRanges)[number]) {
  if (range === "ALL") {
    return data;
  }

  const days = range === "1M" ? 31 : range === "3M" ? 93 : range === "6M" ? 186 : 366;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return data.filter((point) => new Date(point.date) >= cutoff);
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

function PortfolioAnalysis({
  dashboard,
  onOpenTransactions,
}: {
  dashboard: PortfolioDashboard;
  onOpenTransactions: () => void;
}) {
  const mounted = useMounted();
  const [range, setRange] = useState<(typeof portfolioRanges)[number]>("ALL");
  const summary = dashboard.summary;
  const chartData = useMemo(() => {
    const points = filteredTimeline(dashboard.timeline, range);
    if (points.length > 1) {
      return points;
    }

    return dashboard.timeline.length > 1 ? dashboard.timeline : points;
  }, [dashboard.timeline, range]);

  return (
    <Card className="glass-panel overflow-hidden animate-in">
      <CardHeader className="border-b border-white/10 pb-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-3xl">Portfolio</CardTitle>
            <CardDescription>Current value versus invested amount from your saved entries</CardDescription>
          </div>
          <div className="grid grid-cols-2 gap-6 text-left sm:text-right">
            <div>
              <p className="flex items-center gap-2 text-sm text-slate-300 sm:justify-end">
                Current <span className="h-3 w-3 rounded-sm bg-[#0787e5]" />
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(summary.totalValue)}</p>
              <p className={summary.gains >= 0 ? "mt-2 text-sm font-semibold text-emerald-300" : "mt-2 text-sm font-semibold text-rose-300"}>
                {summary.gains >= 0 ? "+" : ""}
                {formatCurrency(summary.gains)} ({summary.gainsPercent.toFixed(2)}%)
              </p>
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm text-slate-300 sm:justify-end">
                Invested <span className="h-3 w-3 rounded-sm bg-[#98a2b3]" />
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(summary.investedAmount)}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {chartData.length > 1 && mounted ? (
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ left: 0, right: 24, top: 16, bottom: 10 }}>
                <defs>
                  <linearGradient id="portfolioCurrentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0787e5" stopOpacity={0.14} />
                    <stop offset="95%" stopColor="#0787e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={34}
                  tick={{ fill: "#9aa8bd", fontSize: 12 }}
                  tickFormatter={formatAxisDate}
                />
                <YAxis
                  width={82}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#9aa8bd", fontSize: 12 }}
                  tickFormatter={formatCompactCurrency}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [formatCurrency(Number(value)), name === "current" ? "Current" : "Invested"]}
                />
                <Area
                  type="monotone"
                  dataKey="current"
                  stroke="#0787e5"
                  strokeWidth={3}
                  fill="url(#portfolioCurrentFill)"
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="invested"
                  stroke="#98a2b3"
                  strokeWidth={2.5}
                  strokeDasharray="6 5"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="Add at least two dated entries to build the portfolio chart." action={onOpenTransactions} />
        )}
        <div className="mt-4 flex justify-center gap-2">
          {portfolioRanges.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={range === item ? "default" : "secondary"}
              onClick={() => setRange(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AllocationCard({
  title,
  data,
  label,
  emptyText,
  onSelect,
}: {
  title: string;
  data: AllocationPoint[];
  label: string;
  emptyText: string;
  onSelect: (name: string) => void;
}) {
  const [activeName, setActiveName] = useState<string | null>(null);
  const shownData = normalizeKnownAllocations(data);
  const colors = allocationPalettes[title as keyof typeof allocationPalettes] ?? allocationPalettes["Sector allocation"];

  return (
    <Card className="glass-panel overflow-hidden animate-in">
      <CardHeader className="border-b border-white/10 pb-5">
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{shownData.length ? `${shownData.length} groups` : emptyText}</CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        {shownData.length ? (
          <div className="grid gap-5">
            <div className="relative mx-auto h-[190px] w-full max-w-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={shownData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="56%"
                    outerRadius="82%"
                    paddingAngle={shownData.length > 1 ? 3 : 0}
                    cornerRadius={shownData.length > 1 ? 7 : 0}
                    stroke="var(--panel)"
                    strokeWidth={4}
                    onMouseLeave={() => setActiveName(null)}
                    onMouseEnter={(_, index) => setActiveName(shownData[index]?.name ?? null)}
                  >
                    {shownData.map((point, index) => (
                      <Cell
                        key={point.name}
                        fill={colors[index % colors.length]}
                        opacity={!activeName || activeName === point.name ? 1 : 0.2}
                        className="cursor-pointer transition-opacity"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="text-sm font-semibold text-white">{shownData.length} groups</p>
              </div>
            </div>

            <div className={cn("space-y-3", shownData.length > 5 && "max-h-[268px] overflow-y-auto pr-2")}>
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span>{label}</span>
                <span>Allocation</span>
              </div>
              {shownData.map((point, index) => (
                <button
                  key={point.name}
                  type="button"
                  className={cn(
                    "grid min-h-[44px] w-full grid-cols-[1fr_auto] items-center gap-4 rounded-md p-2 text-left transition",
                    activeName === point.name
                      ? "bg-white/[0.06]"
                      : activeName
                        ? "opacity-35"
                        : "hover:bg-white/[0.045]",
                  )}
                  onClick={() => onSelect(point.name)}
                  onMouseEnter={() => setActiveName(point.name)}
                  onMouseLeave={() => setActiveName(null)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    />
                    <span className="truncate text-sm font-semibold text-white">{point.name}</span>
                  </span>
                  <span className="text-sm font-semibold text-white">{point.value}%</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title={emptyText} />
        )}
      </CardContent>
    </Card>
  );
}

function StockConcentrationCard({ data }: { data: AllocationPoint[] }) {
  const [showOtherStocks, setShowOtherStocks] = useState(false);
  const knownStocks = data.filter((point) => point.value > 0);
  const topStocks = knownStocks.slice(0, 5);
  const otherStocks = knownStocks.slice(5);
  const otherValue = Number(otherStocks.reduce((sum, point) => sum + point.value, 0).toFixed(2));
  const maxValue = Math.max(...topStocks.map((point) => point.value), otherValue, 1);
  const otherMaxValue = Math.max(...otherStocks.map((point) => point.value), 1);

  return (
    <>
      <Card className="glass-panel overflow-hidden animate-in">
        <CardHeader className="border-b border-white/10 pb-5">
          <CardTitle className="text-2xl">Stocks concentration</CardTitle>
          <CardDescription>
            {knownStocks.length
              ? `${knownStocks.length} stocks across direct holdings and fund portfolios`
              : "Underlying stock holdings are unavailable from providers."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          {topStocks.length ? (
            <div className="space-y-5">
              {topStocks.map((point, index) => (
                <div
                  key={point.name}
                  className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] md:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white"
                      style={{
                        backgroundColor: stockConcentrationColors[index % stockConcentrationColors.length],
                        color: "#ffffff",
                      }}
                    >
                      {point.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate text-sm font-semibold text-white">{point.name}</span>
                  </div>
                  <div className="relative h-9 overflow-hidden rounded-md bg-white/[0.08]">
                    <span
                      className="absolute inset-y-0 left-0 rounded-md"
                      style={{
                        width: `${Math.max((point.value / maxValue) * 100, 8)}%`,
                        backgroundColor: "rgba(7, 135, 229, 0.22)",
                      }}
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-white">
                      {point.value.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
              {otherStocks.length ? (
                <button
                  type="button"
                  className="grid w-full gap-3 rounded-md pt-2 text-left transition hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] md:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] md:items-center"
                  onClick={() => setShowOtherStocks(true)}
                >
                  <span className="px-2 text-sm font-semibold text-slate-400">Other stocks</span>
                  <span className="relative h-8 overflow-hidden rounded-md bg-white/[0.05]">
                    <span
                      className="absolute inset-y-0 left-0 rounded-md bg-white/[0.08]"
                      style={{ width: `${Math.max((otherValue / maxValue) * 100, 8)}%` }}
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-slate-300">
                      {otherValue.toFixed(2)}%
                    </span>
                  </span>
                </button>
              ) : null}
            </div>
          ) : (
            <EmptyState title="Underlying stock holdings are unavailable from providers for the current portfolio." />
          )}
        </CardContent>
      </Card>

      {showOtherStocks ? (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm animate-fade" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close other stocks"
            onClick={() => setShowOtherStocks(false)}
          />
          <div className="modal-panel absolute left-1/2 top-1/2 flex max-h-[82vh] w-[min(92vw,860px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-5">
              <div>
                <h3 className="text-xl font-semibold text-white">Other stocks concentration</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {otherStocks.length} stocks making up {otherValue.toFixed(2)}% of stock exposure
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Close other stocks"
                onClick={() => setShowOtherStocks(false)}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="space-y-3">
                {otherStocks.map((point, index) => (
                  <div
                    key={point.name}
                    className="grid gap-3 rounded-md border border-[var(--line)] bg-[var(--panel-soft)] p-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)] md:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
                        style={{
                          backgroundColor: stockConcentrationColors[index % stockConcentrationColors.length],
                          color: "#ffffff",
                        }}
                      >
                        {point.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{point.name}</p>
                        {point.amount ? (
                          <p className="mt-1 text-xs text-slate-500">{formatCurrency(point.amount)} exposure</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="relative h-8 overflow-hidden rounded-md bg-white/[0.08]">
                      <span
                        className="absolute inset-y-0 left-0 rounded-md"
                        style={{
                          width: `${Math.max((point.value / otherMaxValue) * 100, 8)}%`,
                          backgroundColor: "rgba(7, 135, 229, 0.22)",
                        }}
                      />
                      <span className="absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-white">
                        {point.value.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function normalizeKnownAllocations(data: AllocationPoint[]) {
  const known = data.filter((point) => point.value > 0 && !isUnclassified(point.name));
  const total = known.reduce((sum, point) => sum + point.value, 0);

  if (!total) {
    return [];
  }

  return known.map((point) => ({
    ...point,
    value: Number(((point.value / total) * 100).toFixed(2)),
  }));
}

function isUnclassified(name: string) {
  return name.toLowerCase() === "unclassified";
}

function buildAssetSplit(apiAllocations: AllocationPoint[], holdings: HoldingRow[]) {
  const allApiLabelsAreAssetClasses =
    apiAllocations.length > 0 &&
    apiAllocations.some((point) => point.value > 0 || (point.amount ?? 0) > 0) &&
    apiAllocations.every((point) => assetClassOrder.includes(point.name as AssetClassName));

  if (allApiLabelsAreAssetClasses) {
    return sortAssetClasses(apiAllocations);
  }

  const totals = new Map<AssetClassName, number>(
    assetClassOrder.map((name) => [name, 0]),
  );

  for (const holding of holdings) {
    const amount = holding.currentValue || holding.investedAmount;
    totals.set(holding.assetClass, (totals.get(holding.assetClass) ?? 0) + amount);
  }

  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);

  return sortAssetClasses(
    [...totals.entries()]
      .filter(([, amount]) => amount > 0)
      .map(([name, amount]) => ({
        name,
        amount,
        value: total ? Number(((amount / total) * 100).toFixed(2)) : 0,
      })),
  );
}

function sortAssetClasses(points: AllocationPoint[]) {
  return [...points].sort((a, b) => {
    const aIndex = assetClassOrder.indexOf(a.name as AssetClassName);
    const bIndex = assetClassOrder.indexOf(b.name as AssetClassName);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
}

export function DashboardOverview({
  dashboard,
  onOpenTransactions,
  onOpenHoldings,
}: {
  dashboard: PortfolioDashboard | null;
  onOpenTransactions: () => void;
  onOpenHoldings: (filter?: string) => void;
}) {
  const summary = dashboard?.summary;
  const holdings = useMemo(() => dashboard?.holdings ?? [], [dashboard?.holdings]);
  const assetSplit = useMemo(
    () => buildAssetSplit(dashboard?.allocations.assets ?? [], holdings),
    [dashboard?.allocations.assets, holdings],
  );

  if (!dashboard || !summary) {
    return <EmptyState title="Loading portfolio..." />;
  }

  return (
    <section className="space-y-5">
      <PortfolioAnalysis dashboard={dashboard} onOpenTransactions={onOpenTransactions} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          label="Portfolio value"
          value={formatCurrency(summary.totalValue)}
          helper={`${summary.gainsPercent.toFixed(1)}% unrealized return`}
          icon={IndianRupee}
          tone="cyan"
        />
        <MetricCard
          label="Invested amount"
          value={formatCurrency(summary.investedAmount)}
          helper={`${summary.holdingsCount} active holdings`}
          icon={PiggyBank}
          tone="slate"
        />
        <MetricCard
          label="Unrealized gain"
          value={formatCurrency(summary.gains)}
          helper={`${summary.gains >= 0 ? "+" : ""}${summary.gainsPercent.toFixed(1)}%`}
          icon={TrendingUp}
          tone={summary.gains >= 0 ? "emerald" : "rose"}
        />
        <MetricCard
          label="Realized gain"
          value={`${summary.realizedGain > 0 ? "+" : ""}${formatCurrency(summary.realizedGain)}`}
          helper="From sell and redeem transactions"
          icon={Landmark}
          tone={summary.realizedGain >= 0 ? "emerald" : "rose"}
        />
        <MetricCard
          label="Monthly SIP"
          value={formatCurrency(summary.monthlySipTotal)}
          helper="Active mandates"
          icon={Activity}
          tone="amber"
        />
        <MetricCard
          label="Active SIPs"
          value={String(summary.activeSipCount)}
          helper="Recurring mandates"
          icon={CalendarClock}
          tone="emerald"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <AllocationCard
          title="Asset split"
          data={assetSplit}
          label="Asset class"
          emptyText="Add holdings to calculate Equity, Debt, and Commodities."
          onSelect={(name) => onOpenHoldings(name)}
        />
        <AllocationCard
          title="Market cap split"
          data={dashboard.allocations.marketCap}
          label="Market cap"
          emptyText="Market-cap metadata is unavailable from the provider for these holdings."
          onSelect={(name) => onOpenHoldings(name)}
        />
        <AllocationCard
          title="Sector allocation"
          data={dashboard.allocations.sectors}
          label="Sector"
          emptyText="Sector metadata is unavailable from the provider for these holdings."
          onSelect={(name) => onOpenHoldings(name)}
        />
      </div>

      <StockConcentrationCard data={dashboard.allocations.stockConcentration} />
    </section>
  );
}
