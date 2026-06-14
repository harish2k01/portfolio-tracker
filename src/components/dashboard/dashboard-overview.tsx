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
import { Activity, CalendarClock, IndianRupee, Landmark, PiggyBank, TrendingUp } from "lucide-react";
import { formatCompactCurrency, formatCurrency } from "@/lib/analytics";
import { assetTypeLabel } from "@/lib/labels";
import type { AllocationPoint, HoldingRow, PortfolioDashboard, PortfolioTimelinePoint } from "@/types/portfolio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/metric-card";

const allocationPalettes = {
  "Asset split": ["#0787e5", "#00a866", "#f3a325"],
  "Market cap split": ["#6246ea", "#0787e5", "#00a866"],
  "Sector allocation": ["#0787e5", "#00a866", "#f3a325", "#8b5cf6", "#e72b4d", "#00a7b5"],
} as const;
const assetClassOrder = ["Equity", "Debt", "Commodities"] as const;
const portfolioRanges = ["1M", "3M", "6M", "1Y", "ALL"] as const;

const tooltipStyle = {
  background: "#111827",
  border: "1px solid rgba(148,163,184,0.24)",
  borderRadius: "8px",
  color: "#f8fafc",
};

type AssetClassName = (typeof assetClassOrder)[number];
type HoldingView = "ALL" | "MF" | "STOCKS";

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
          <div className="grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
            <div className="relative h-[190px]">
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
                  >
                    {shownData.map((point, index) => (
                      <Cell key={point.name} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [`${Number(value).toFixed(2)}%`, "Allocation"]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="text-sm font-semibold text-white">{shownData.length} groups</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span>{label}</span>
                <span>Allocation</span>
              </div>
              {shownData.slice(0, 6).map((point, index) => (
                <button
                  key={point.name}
                  type="button"
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-4 rounded-md p-2 text-left transition hover:bg-white/[0.045]"
                  onClick={() => onSelect(point.name)}
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
  onOpenAsset,
}: {
  dashboard: PortfolioDashboard | null;
  onOpenTransactions: () => void;
  onOpenAsset: (assetId: string) => void;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const [holdingView, setHoldingView] = useState<HoldingView>("ALL");
  const summary = dashboard?.summary;
  const holdings = useMemo(() => dashboard?.holdings ?? [], [dashboard?.holdings]);
  const assetSplit = useMemo(
    () => buildAssetSplit(dashboard?.allocations.assets ?? [], holdings),
    [dashboard?.allocations.assets, holdings],
  );
  const typeFilteredHoldings = holdings.filter((holding) => {
    if (holdingView === "MF") {
      return holding.type === "MUTUAL_FUND";
    }

    if (holdingView === "STOCKS") {
      return holding.type === "STOCK" || holding.type === "ETF";
    }

    return true;
  });
  const filteredHoldings = filter
    ? typeFilteredHoldings.filter(
        (holding) =>
          holding.assetClass === filter ||
          (holding.category ?? "") === filter ||
          holding.sectorAllocation?.some((point) => point.name === filter) ||
          holding.marketCapAllocation?.some((point) => point.name === filter),
      )
    : typeFilteredHoldings;

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
          onSelect={setFilter}
        />
        <AllocationCard
          title="Market cap split"
          data={dashboard.allocations.marketCap}
          label="Market cap"
          emptyText="Market-cap metadata is unavailable from the provider for these holdings."
          onSelect={setFilter}
        />
        <AllocationCard
          title="Sector allocation"
          data={dashboard.allocations.sectors}
          label="Sector"
          emptyText="Sector metadata is unavailable from the provider for these holdings."
          onSelect={setFilter}
        />
      </div>

      <Card className="glass-panel animate-in">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Holdings</CardTitle>
            <CardDescription>{filter ? `Filtered by ${filter}` : "Click a holding for full history"}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["ALL", "MF", "STOCKS"] as const).map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={holdingView === item ? "default" : "secondary"}
                onClick={() => setHoldingView(item)}
              >
                {item === "ALL" ? "All" : item === "MF" ? "MF" : "Stocks"}
              </Button>
            ))}
            {filter ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => setFilter(null)}>
                Clear
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {filteredHoldings.length ? (
            <div className="overflow-hidden rounded-lg border border-white/10">
              <div className="hidden grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.7fr] border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 lg:grid">
                <span>Holding</span>
                <span className="text-right">Units</span>
                <span className="text-right">Invested</span>
                <span className="text-right">Current</span>
                <span className="text-right">Returns</span>
              </div>
              {filteredHoldings.map((holding: HoldingRow) => (
                <button
                  key={holding.assetId}
                  type="button"
                  className="grid w-full gap-3 border-b border-white/10 px-4 py-4 text-left transition duration-200 last:border-b-0 hover:bg-white/[0.055] lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.7fr] lg:items-center"
                  onClick={() => onOpenAsset(holding.assetId)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{holding.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {holding.assetClass} / {assetTypeLabel(holding.type)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-white lg:text-right">{holding.quantity.toFixed(3)}</p>
                  <p className="text-sm font-semibold text-white lg:text-right">{formatCurrency(holding.investedAmount)}</p>
                  <p className="text-sm font-semibold text-white lg:text-right">{formatCurrency(holding.currentValue)}</p>
                  <div className="lg:text-right">
                    <p className={holding.gain >= 0 ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-rose-300"}>
                      {holding.gain >= 0 ? "+" : ""}
                      {formatCurrency(holding.gain)}
                    </p>
                    <p className="text-xs text-slate-500">{holding.gainPercent.toFixed(2)}%</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title={filter ? "No holdings match this allocation." : "Add transactions to see holdings here."} action={filter ? undefined : onOpenTransactions} />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
