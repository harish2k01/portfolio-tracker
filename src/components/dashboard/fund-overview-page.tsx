"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  ChevronRight,
  MoveLeft,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestmentIcon } from "@/components/ui/investment-icon";
import { TablePagination, usePagination } from "@/components/ui/pagination";
import { formatCurrency, formatNav } from "@/lib/analytics";
import { assetTypeLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type {
  ChartRange,
  InvestmentSearchResult,
  SerializedAsset,
  SipRow,
  TransactionRow,
} from "@/types/portfolio";

export type FundOverviewTarget =
  | { kind: "asset"; assetId: string }
  | { kind: "sip"; sipId: string }
  | { kind: "search"; asset: InvestmentSearchResult };

type DetailTarget =
  | { kind: "asset"; id: string }
  | { kind: "sip"; id: string };

type InvestmentDetail = {
  name: string;
  type?: string;
  value: number | null;
  changePercent: number | null;
  category?: string;
  amc?: string;
  exchange?: string;
  schemeCode?: string;
  symbol?: string;
  history: Array<{ date: string; value: number }>;
  holdings?: Array<{ name: string; weight: number; sector?: string; instrument?: string }>;
  assetAllocation?: Array<{ name: string; value: number }>;
  sectorAllocation?: Array<{ name: string; value: number }>;
  marketCapAllocation?: Array<{ name: string; value: number }>;
};

type AssetDetailPayload = {
  asset: SerializedAsset;
  details: InvestmentDetail;
  transactions: TransactionRow[];
};

type SipDetailPayload = {
  sip: SipRow;
  details: InvestmentDetail;
  transactions: TransactionRow[];
};

type FundPayload =
  | AssetDetailPayload
  | SipDetailPayload
  | {
      details: InvestmentDetail;
      transactions: TransactionRow[];
      asset?: InvestmentSearchResult;
    };

const ranges: ChartRange[] = ["1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "ALL"];
const allocationColors = ["#1277d3", "#536dfe", "#f0a62a", "#20a4c8", "#7c8fa6", "#8b6f47"];
const tooltipStyle = {
  background: "var(--panel)",
  border: "1px solid var(--line)",
  borderRadius: "8px",
  color: "var(--foreground)",
};

export function FundOverviewPage({
  target,
  onBack,
  onOpenInvestment,
}: {
  target: FundOverviewTarget;
  onBack: () => void;
  onOpenInvestment: (target: DetailTarget) => void;
}) {
  const [range, setRange] = useState<ChartRange>("3Y");
  const [payload, setPayload] = useState<FundPayload | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const details = payload?.details;
  const transactions = useMemo(() => payload?.transactions ?? [], [payload?.transactions]);
  const holdings = useMemo(() => details?.holdings ?? [], [details?.holdings]);
  const holdingsPagination = usePagination(holdings);
  const investmentTarget = investmentDetailTarget(payload);
  const summary = useMemo(
    () => summarizeTransactions(transactions, details?.value ?? null),
    [details?.value, transactions],
  );
  const ticks = useMemo(() => buildDateTicks(details?.history ?? [], range), [details?.history, range]);
  const type = getAssetType(payload, target);
  const code = getSchemeOrSymbol(payload, target);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        setPayload(await fetchFundPayload(target, range, controller.signal));
      } catch (caught) {
        if (!controller.signal.aborted) {
          setPayload(null);
          setError(caught instanceof Error ? caught.message : "Unable to load fund details.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [range, target]);

  if (isLoading && !details) {
    return (
      <section className="page-transition flex min-h-[calc(100vh-48px)] items-center justify-center">
        <div className="portfolio-loader" role="status" aria-live="polite" aria-label="Loading fund details">
          <p className="portfolio-loader-title">Loading...</p>
          <div className="portfolio-loader-bars" aria-hidden>
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page-transition space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          <MoveLeft className="h-4 w-4" aria-hidden />
          Back
        </Button>
        <Button type="button" variant="secondary" size="icon" aria-label="Save fund">
          <Bookmark className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-[var(--negative)]/30 bg-[var(--negative-soft)] p-4 text-sm text-[var(--negative)]">
          {error}
        </div>
      ) : null}

      <Card className="glass-panel overflow-hidden">
        <CardContent className="p-5 sm:p-7">
          <div className="space-y-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <InvestmentIcon
                  name={details?.name ?? targetLabel(target)}
                  type={type}
                  symbol={details?.symbol ?? (target.kind === "search" ? target.asset.symbol : undefined)}
                  amc={details?.amc ?? (target.kind === "search" ? target.asset.amc : undefined)}
                  size="lg"
                  className="mb-5"
                />
                <h1 className="max-w-4xl text-3xl font-semibold leading-tight text-[var(--foreground)]">
                  {details?.name ?? targetLabel(target)}
                </h1>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>{assetTypeLabel(type)}</Badge>
                  {details?.category ? <Badge variant="muted">{compactCategory(details.category)}</Badge> : null}
                  {details?.amc ? <Badge variant="muted">{details.amc}</Badge> : null}
                  {code ? <Badge variant="muted">{code}</Badge> : null}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 xl:text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Current NAV</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                  {details?.value !== null && details?.value !== undefined ? formatNav(details.value) : "Unavailable"}
                </p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-h-[420px]">
                <div className="mb-3">
                  <p className={cn("text-3xl font-semibold", (details?.changePercent ?? 0) >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]")}>
                    {formatPercent(details?.changePercent)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{range} return</p>
                </div>
                <FundLineChart data={details?.history ?? []} ticks={ticks} range={range} />
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {ranges.map((item) => (
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
              </div>

              <div className="space-y-3">
                <Fact label="AMC" value={details?.amc} />
                <Fact label="Category" value={details?.category} />
                <Fact label="Scheme" value={code} />
                <Fact label="Data source" value="MFAPI / Groww / MFData" />
              </div>
            </div>

            {summary.investedAmount > 0 && investmentTarget ? (
              <button
                type="button"
                className="grid w-full gap-4 rounded-lg border border-[var(--line)] bg-[var(--panel-soft)] p-4 text-left transition hover:border-[var(--line-strong)] hover:bg-[var(--panel)] md:grid-cols-[1fr_1fr_1fr_auto] md:items-center"
                onClick={() => onOpenInvestment(investmentTarget)}
              >
                <Metric label="Invested value" value={formatCurrency(summary.investedAmount)} />
                <Metric
                  label="Total returns"
                  value={`${summary.gain >= 0 ? "+" : ""}${formatCurrency(summary.gain)} (${summary.gainPercent.toFixed(2)}%)`}
                  tone={summary.gain >= 0 ? "positive" : "negative"}
                />
                <Metric label="Current value" value={formatCurrency(summary.currentValue)} />
                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--primary)]">
                  Full details
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </span>
              </button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <AllocationCard title="Asset split" data={details?.assetAllocation ?? []} />
        <AllocationCard title="Market cap split" data={details?.marketCapAllocation ?? []} />
        <AllocationCard title="Sector allocation" data={details?.sectorAllocation ?? []} />
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Holdings ({holdings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {holdingsPagination.items.length ? (
            <div className="overflow-hidden rounded-lg border border-[var(--line)]">
              <div className="hidden grid-cols-[minmax(240px,1.4fr)_0.9fr_0.9fr_0.55fr] border-b border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)] md:grid">
                <span>Name</span>
                <span>Sector</span>
                <span>Instrument</span>
                <span className="text-right">Assets</span>
              </div>
              {holdingsPagination.items.map((holding) => (
                <div
                  key={`${holding.name}:${holding.weight}`}
                  className="grid gap-2 border-b border-[var(--line)] px-4 py-4 text-sm last:border-b-0 md:grid-cols-[minmax(240px,1.4fr)_0.9fr_0.9fr_0.55fr] md:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <InvestmentIcon name={holding.name} type="STOCK" />
                    <p className="truncate font-semibold text-[var(--foreground)]">{holding.name}</p>
                  </div>
                  <p className="text-[var(--muted)] md:text-[var(--foreground)]">{holding.sector ?? "Unspecified"}</p>
                  <p className="text-[var(--muted)] md:text-[var(--foreground)]">{holding.instrument ?? "Equity"}</p>
                  <p className="font-semibold text-[var(--foreground)] md:text-right">{holding.weight.toFixed(2)}%</p>
                </div>
              ))}
              <TablePagination
                {...holdingsPagination}
                onPageChange={holdingsPagination.setPage}
                onPageSizeChange={holdingsPagination.setPageSize}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">
              Holdings are unavailable from the provider.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function FundLineChart({
  data,
  ticks,
  range,
}: {
  data: Array<{ date: string; value: number }>;
  ticks: string[];
  range: ChartRange;
}) {
  if (!data.length) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed border-[var(--line)] text-sm text-[var(--muted)]">
        Chart data unavailable from provider.
      </div>
    );
  }

  return (
    <div className="h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 12, top: 10, bottom: 10 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
          <YAxis
            width={58}
            tickLine={false}
            axisLine={{ stroke: "rgba(148,163,184,0.18)" }}
            tick={{ fill: "#8b9ab1", fontSize: 12 }}
            tickFormatter={(value) => formatNavAxis(Number(value))}
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={{ stroke: "rgba(148,163,184,0.18)" }}
            ticks={ticks}
            tickFormatter={(value) => formatChartTick(String(value), range)}
            tick={{ fill: "#8b9ab1", fontSize: 12 }}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`NAV: ${formatNav(Number(value))}`, ""]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5, stroke: "#f8fafc", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AllocationCard({ title, data }: { title: string; data: Array<{ name: string; value: number }> }) {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <div className="space-y-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-[var(--panel-soft)]">
              {data.map((item, index) => (
                <span
                  key={item.name}
                  className="h-full"
                  style={{
                    width: `${item.value}%`,
                    backgroundColor: allocationColors[index % allocationColors.length],
                  }}
                />
              ))}
            </div>
            <div className="space-y-3">
              {data.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: allocationColors[index % allocationColors.length] }}
                    />
                    <span className="truncate text-sm font-semibold text-[var(--foreground)]">{item.name}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-[var(--foreground)]">{item.value.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">Unavailable from provider.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-soft)] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{value || "Unavailable"}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <span>
      <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</span>
      <span
        className={cn(
          "mt-2 block text-lg font-semibold text-[var(--foreground)]",
          tone === "positive" && "text-[var(--positive)]",
          tone === "negative" && "text-[var(--negative)]",
        )}
      >
        {value}
      </span>
    </span>
  );
}

async function fetchFundPayload(target: FundOverviewTarget, range: ChartRange, signal: AbortSignal): Promise<FundPayload> {
  const endpoint =
    target.kind === "asset"
      ? `/api/assets/${encodeURIComponent(target.assetId)}?range=${range}`
      : target.kind === "sip"
        ? `/api/sips/${encodeURIComponent(target.sipId)}?range=${range}`
        : target.asset.type === "MUTUAL_FUND" && target.asset.schemeCode
          ? `/api/funds/${encodeURIComponent(target.asset.schemeCode)}?range=${range}`
          : target.asset.symbol
            ? `/api/quotes/${encodeURIComponent(target.asset.symbol)}?type=${target.asset.type}&range=${range}`
            : "";

  if (!endpoint) {
    throw new Error("Fund details are unavailable for this result.");
  }

  const response = await fetch(endpoint, { cache: "no-store", signal });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to load fund details.");
  }

  if (target.kind === "search") {
    return { details: data as InvestmentDetail, transactions: [], asset: target.asset };
  }

  return data as FundPayload;
}

function summarizeTransactions(transactions: TransactionRow[], latestPrice: number | null) {
  let units = 0;
  let investedAmount = 0;

  for (const transaction of [...transactions].sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))) {
    if (transaction.type === "SELL") {
      const averageCost = units > 0 ? investedAmount / units : 0;
      const soldUnits = Math.min(transaction.quantity, units);
      investedAmount = Math.max(investedAmount - averageCost * soldUnits, 0);
      units = Math.max(units - transaction.quantity, 0);
    } else {
      units += transaction.quantity;
      investedAmount += transaction.amount;
    }
  }

  const fallbackPrice = latestPrice ?? transactions[0]?.navOrPrice ?? null;
  const currentValue = fallbackPrice ? Math.max(units, 0) * fallbackPrice : 0;
  const gain = currentValue - investedAmount;

  return {
    units: Math.max(units, 0),
    investedAmount,
    currentValue,
    gain,
    gainPercent: investedAmount ? (gain / investedAmount) * 100 : 0,
  };
}

function investmentDetailTarget(payload: FundPayload | null): DetailTarget | null {
  if (!payload) {
    return null;
  }

  if ("asset" in payload && payload.asset && "id" in payload.asset) {
    return { kind: "asset", id: payload.asset.id };
  }

  if ("sip" in payload) {
    return { kind: "sip", id: payload.sip.id };
  }

  return null;
}

function getAssetType(payload: FundPayload | null, target: FundOverviewTarget) {
  if (payload && "asset" in payload && payload.asset) {
    return payload.asset.type;
  }

  if (payload && "sip" in payload) {
    return payload.sip.asset.type;
  }

  if (target.kind === "search") {
    return target.asset.type;
  }

  return "MUTUAL_FUND";
}

function getSchemeOrSymbol(payload: FundPayload | null, target: FundOverviewTarget) {
  if (payload && "asset" in payload && payload.asset) {
    return payload.asset.schemeCode ?? payload.asset.symbol ?? undefined;
  }

  if (payload && "sip" in payload) {
    return payload.sip.asset.schemeCode ?? payload.sip.asset.symbol ?? undefined;
  }

  if (target.kind === "search") {
    return target.asset.schemeCode ?? target.asset.symbol;
  }

  return undefined;
}

function targetLabel(target: FundOverviewTarget) {
  if (target.kind === "search") {
    return target.asset.name;
  }

  return "Fund details";
}

function compactCategory(category: string) {
  return category.split(":").at(-1)?.trim() || category;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Return unavailable";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function buildDateTicks(history: Array<{ date: string; value: number }>, range: ChartRange) {
  const shortRange = range === "1W" || range === "1M" || range === "3M" || range === "6M" || range === "1Y";
  const groups = new Set<string>();
  const ticks: string[] = [];

  for (const point of history) {
    const date = new Date(point.date);
    const key = shortRange
      ? `${date.getFullYear()}-${date.getMonth()}`
      : `${date.getFullYear()}`;

    if (!groups.has(key)) {
      groups.add(key);
      ticks.push(point.date);
    }
  }

  return ticks;
}

function formatChartTick(value: string, range: ChartRange) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  if (range === "1W" || range === "1M" || range === "3M" || range === "6M" || range === "1Y") {
    return date.toLocaleDateString("en-IN", { month: "short" });
  }

  return String(date.getFullYear());
}

function formatNavAxis(value: number) {
  if (value >= 1000) {
    return `₹${Math.round(value).toLocaleString("en-IN")}`;
  }

  return value.toFixed(value >= 100 ? 0 : 2);
}
