"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  LineChart as LineChartIcon,
  Plus,
  Search,
  X,
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
import {
  calculateNetInvestmentAmount,
  calculateStampDuty,
  calculateUnits,
  formatCurrency,
  formatNav,
} from "@/lib/analytics";
import { assetTypeLabel, transactionTypeLabel } from "@/lib/labels";
import type {
  AssetType,
  ChartRange,
  InvestmentSearchResult,
  SipFrequency,
  TransactionType,
} from "@/types/portfolio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ActionMode = Exclude<TransactionType, "SIP_INSTALLMENT"> | "SIP_MANDATE";

type Detail = {
  name: string;
  value: number | null;
  changePercent: number | null;
  category?: string;
  amc?: string;
  exchange?: string;
  history: Array<{ date: string; value: number }>;
};

const stockRanges: ChartRange[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "ALL"];
const fundRanges: ChartRange[] = ["1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "ALL"];
const selectClass =
  "h-10 w-full rounded-md border border-slate-300/15 bg-black/[0.22] px-3 text-sm text-white outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--focus)]";
const tooltipStyle = {
  background: "#111827",
  border: "1px solid rgba(148,163,184,0.24)",
  borderRadius: "8px",
  color: "#f8fafc",
};

export function FundSearch({
  onChanged,
  onOpenFund,
}: {
  onChanged: () => Promise<void>;
  onOpenFund: (asset: InvestmentSearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InvestmentSearchResult[]>([]);
  const [selected, setSelected] = useState<InvestmentSearchResult | null>(null);
  const [range, setRange] = useState<ChartRange>("1Y");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>("LUMPSUM");
  const [amount, setAmount] = useState(50000);
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10));
  const [frequency, setFrequency] = useState<SipFrequency>("MONTHLY");
  const [navOrPrice, setNavOrPrice] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const detailCacheRef = useRef(new Map<string, Detail>());
  const ranges = selected?.type === "MUTUAL_FUND" ? fundRanges : stockRanges;
  const isSipMandate = actionMode === "SIP_MANDATE";
  const isSellAction = actionMode === "SELL";
  const transactionAction = isSipMandate ? null : actionMode;
  const stampDuty =
    selected && transactionAction ? calculateStampDuty(amount, selected.type, transactionAction) : 0;
  const netAmount = calculateNetInvestmentAmount(amount, stampDuty);
  const calculatedUnits =
    navOrPrice && transactionAction ? calculateUnits(amount, navOrPrice, stampDuty, 3) : 0;
  const chartTicks = useMemo(() => buildDateTicks(detail?.history ?? [], range), [
    detail?.history,
    range,
  ]);

  useEffect(() => {
    const trimmed = query.trim();
    const controller = new AbortController();

    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      setError("");
      return () => controller.abort();
    }

    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setError("");

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          setResults([]);
          setError("Search is unavailable right now.");
          return;
        }

        setResults(dedupeResults(await response.json()));
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setError("Search is unavailable right now.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDetail() {
      if (!selected) {
        setDetail(null);
        return;
      }

      const key = `${assetKey(selected)}:${range}`;
      const cached = detailCacheRef.current.get(key);

      if (cached) {
        setDetail(cached);
        setIsDetailLoading(false);
        return;
      }

      setDetail(null);
      setIsDetailLoading(true);

      try {
        const nextDetail = await fetchInvestmentDetail(selected, range, controller.signal);
        detailCacheRef.current.set(key, nextDetail);
        setDetail(nextDetail);
      } catch {
        if (!controller.signal.aborted) {
          setDetail(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsDetailLoading(false);
        }
      }
    }

    void loadDetail();
    return () => controller.abort();
  }, [range, selected]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPrice() {
      setNavOrPrice(null);
      setError("");

      if (!selected || !tradeDate || isSipMandate) {
        return;
      }

      const params = new URLSearchParams({
        type: selected.type,
        date: tradeDate,
      });

      if (selected.schemeCode) {
        params.set("schemeCode", selected.schemeCode);
      }

      if (selected.symbol) {
        params.set("symbol", selected.symbol);
      }

      try {
        const response = await fetch(`/api/price?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = await response.json();

        if (response.ok) {
          setNavOrPrice(payload.value);
        } else if (!controller.signal.aborted) {
          setError(payload.error ?? "NAV/price unavailable for this date.");
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("NAV/price unavailable for this date.");
        }
      }
    }

    void fetchPrice();
    return () => controller.abort();
  }, [isSipMandate, selected, tradeDate]);

  function openPanel(asset: InvestmentSearchResult) {
    onOpenFund(asset);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selected) {
      return;
    }

    if (isSipMandate) {
      setIsSaving(true);
      const response = await fetch("/api/sips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: selected,
          amount,
          frequency,
          startDate: tradeDate,
        }),
      });
      const payload = await response.json();
      setIsSaving(false);

      if (!response.ok) {
        setError(payload.error ?? "Unable to start SIP.");
        return;
      }

      setSelected(null);
      await onChanged();
      return;
    }

    if (!navOrPrice) {
      setError("Wait for NAV/price to load.");
      return;
    }

    if (!amount || amount <= 0) {
      setError("Enter an amount.");
      return;
    }

    if (isSellAction && calculatedUnits <= 0) {
      setError("Enter a valid sell amount.");
      return;
    }

    setIsSaving(true);
    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset: selected,
        type: actionMode,
        amount,
        tradeDate,
        quantity: isSellAction ? calculatedUnits : undefined,
        navOrPrice,
      }),
    });
    const payload = await response.json();
    setIsSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save transaction.");
      return;
    }

    setSelected(null);
    await onChanged();
  }

  return (
    <section className="space-y-5">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Search Investment</CardTitle>
          <CardDescription>Start typing, then select a result to buy or start SIP.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Indian stock, ETF, or mutual fund"
            />
          </div>
          {error && !selected ? <p className="text-sm text-rose-200">{error}</p> : null}
          {results.length ? (
            <div className="overflow-hidden rounded-lg border border-white/10 bg-black/[0.12]">
              {results.map((asset) => (
                <button
                  key={assetKey(asset)}
                  type="button"
                  className="grid w-full gap-3 border-b border-white/10 px-4 py-3 text-left transition last:border-b-0 hover:bg-white/[0.06] md:grid-cols-[1fr_auto]"
                  onClick={() => openPanel(asset)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{asset.name}</span>
                    <span className="text-xs text-slate-500">{asset.symbol ?? asset.schemeCode ?? asset.exchange}</span>
                  </span>
                  <Badge variant="muted">{assetTypeLabel(asset.type)}</Badge>
                </button>
              ))}
            </div>
          ) : query.trim().length >= 2 && !isSearching ? (
            <div className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">
              No matching live results.
            </div>
          ) : null}
          {isSearching ? <p className="text-sm text-slate-400">Searching...</p> : null}
        </CardContent>
      </Card>

      {selected ? (
        <InvestmentActionPanel
          actionMode={actionMode}
          amount={amount}
          calculatedUnits={calculatedUnits}
          chartTicks={chartTicks}
          detail={detail}
          frequency={frequency}
          isDetailLoading={isDetailLoading}
          isSaving={isSaving}
          navOrPrice={navOrPrice}
          netAmount={netAmount}
          range={range}
          ranges={ranges}
          selected={selected}
          tradeDate={tradeDate}
          error={error}
          onActionModeChange={setActionMode}
          onAmountChange={setAmount}
          onClose={() => setSelected(null)}
          onFrequencyChange={setFrequency}
          onRangeChange={setRange}
          onSubmit={handleSubmit}
          onTradeDateChange={setTradeDate}
        />
      ) : null}
    </section>
  );
}

function InvestmentActionPanel({
  actionMode,
  amount,
  calculatedUnits,
  chartTicks,
  detail,
  error,
  frequency,
  isDetailLoading,
  isSaving,
  navOrPrice,
  netAmount,
  range,
  ranges,
  selected,
  tradeDate,
  onActionModeChange,
  onAmountChange,
  onClose,
  onFrequencyChange,
  onRangeChange,
  onSubmit,
  onTradeDateChange,
}: {
  actionMode: ActionMode;
  amount: number;
  calculatedUnits: number;
  chartTicks: string[];
  detail: Detail | null;
  error: string;
  frequency: SipFrequency;
  isDetailLoading: boolean;
  isSaving: boolean;
  navOrPrice: number | null;
  netAmount: number;
  range: ChartRange;
  ranges: ChartRange[];
  selected: InvestmentSearchResult;
  tradeDate: string;
  onActionModeChange: (action: ActionMode) => void;
  onAmountChange: (amount: number) => void;
  onClose: () => void;
  onFrequencyChange: (frequency: SipFrequency) => void;
  onRangeChange: (range: ChartRange) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTradeDateChange: (date: string) => void;
}) {
  const actions = actionOptionsForAsset(selected.type);
  const isSipMandate = actionMode === "SIP_MANDATE";

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm animate-fade" role="dialog" aria-modal="true">
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Close investment action" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[1120px] flex-col overflow-y-auto border-l border-white/10 bg-[#0b1120] shadow-2xl shadow-black animate-slide-in">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1120]/92 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge>{assetTypeLabel(selected.type)}</Badge>
                <Badge variant="muted">{selected.symbol ?? selected.schemeCode}</Badge>
              </div>
              <h2 className="truncate text-2xl font-semibold text-white">{detail?.name ?? selected.name}</h2>
              <p className="mt-1 truncate text-sm text-slate-400">
                {detail?.category ?? detail?.exchange ?? selected.category ?? selected.amc ?? "Live chart and transaction actions"}
              </p>
            </div>
            <Button type="button" variant="secondary" size="icon" aria-label="Close" onClick={onClose}>
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </header>

        <div className="space-y-5 p-5">
          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-4 flex items-center gap-2">
              <LineChartIcon className="h-4 w-4 text-blue-500" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-white">Performance</p>
                <p className="text-xs text-slate-500">
                  {selected.type === "MUTUAL_FUND" ? "Mutual fund charts start at 1W" : "NSE/BSE charts include 1D"}
                </p>
              </div>
            </div>
            <SimpleNavChart
              data={detail?.history ?? []}
              isLoading={isDetailLoading}
              range={range}
              ticks={chartTicks}
            />
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {ranges.map((item) => (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={range === item ? "default" : "secondary"}
                  onClick={() => onRangeChange(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
          </section>

          <form className="rounded-lg border border-white/10 bg-white/[0.035] p-4" onSubmit={onSubmit}>
            <div className="mb-4 flex flex-wrap gap-2">
              {actions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={actionMode === option.value ? "default" : "secondary"}
                  onClick={() => onActionModeChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="search-action-amount">{isSipMandate ? "SIP amount" : "Amount"}</Label>
                <Input
                  id="search-action-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(event) => onAmountChange(Number(event.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="search-action-date">{isSipMandate ? "Start date" : "Trade date"}</Label>
                <Input
                  id="search-action-date"
                  type="date"
                  value={tradeDate}
                  onChange={(event) => onTradeDateChange(event.target.value)}
                />
              </div>
              {isSipMandate ? (
                <div className="space-y-2">
                  <Label htmlFor="search-action-frequency">Frequency</Label>
                  <select
                    id="search-action-frequency"
                    className={selectClass}
                    value={frequency}
                    onChange={(event) => onFrequencyChange(event.target.value as SipFrequency)}
                  >
                    <option value="WEEKLY" className="bg-slate-950">Weekly</option>
                    <option value="MONTHLY" className="bg-slate-950">Monthly</option>
                    <option value="QUARTERLY" className="bg-slate-950">Quarterly</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="search-action-units">Units</Label>
                  <Input id="search-action-units" readOnly value={calculatedUnits.toFixed(3)} />
                </div>
              )}
              <div className="rounded-lg border border-white/10 bg-black/[0.16] p-3 text-sm">
                <p className="text-slate-500">NAV/price</p>
                <p className="font-semibold text-white">
                  {isSipMandate ? "At due entries" : navOrPrice !== null ? formatNav(navOrPrice) : "Loading"}
                </p>
                {!isSipMandate ? (
                  <>
                    <p className="mt-1 text-xs text-slate-500">Units {calculatedUnits.toFixed(3)}</p>
                    <p className="mt-1 text-xs text-slate-500">Net {formatCurrency(netAmount)}</p>
                  </>
                ) : null}
              </div>
            </div>

            {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSipMandate ? <CalendarClock className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                {isSaving
                  ? "Saving"
                  : isSipMandate
                    ? "Start SIP"
                    : `Add ${transactionTypeLabel(actionMode, selected.type)}`}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
}

function SimpleNavChart({
  data,
  isLoading,
  range,
  ticks,
}: {
  data: Array<{ date: string; value: number }>;
  isLoading: boolean;
  range: ChartRange;
  ticks: string[];
}) {
  return (
    <div className="h-[360px]">
      {isLoading && !data.length ? (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/15 text-sm text-slate-400">
          Loading chart
        </div>
      ) : data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 6, right: 12, top: 16, bottom: 10 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
            <YAxis
              width={58}
              tickLine={false}
              axisLine={{ stroke: "rgba(148,163,184,0.18)" }}
              tick={{ fill: "#9aa8bd", fontSize: 12 }}
              tickFormatter={(value) => formatNavAxis(Number(value))}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: "rgba(148,163,184,0.18)" }}
              ticks={ticks}
              tickFormatter={(value) => formatChartTick(String(value), range)}
              tick={{ fill: "#9aa8bd", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [`NAV: ${formatNav(Number(value))}`, ""]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#0787e5"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, stroke: "#f8fafc", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/15 text-sm text-slate-400">
          Chart data unavailable from provider.
        </div>
      )}
    </div>
  );
}

async function fetchInvestmentDetail(asset: InvestmentSearchResult, range: ChartRange, signal: AbortSignal) {
  const endpoint =
    asset.type === "MUTUAL_FUND" && asset.schemeCode
      ? `/api/funds/${encodeURIComponent(asset.schemeCode)}?range=${range}`
      : asset.symbol
        ? `/api/quotes/${encodeURIComponent(asset.symbol)}?type=${asset.type}&range=${range}`
        : "";

  if (!endpoint) {
    throw new Error("Chart data unavailable for this asset.");
  }

  const response = await fetch(endpoint, { cache: "no-store", signal });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Chart data unavailable.");
  }

  return data as Detail;
}

function actionOptionsForAsset(assetType: AssetType) {
  if (assetType === "MUTUAL_FUND") {
    return [
      { value: "LUMPSUM" as const, label: "Lumpsum" },
      { value: "SIP_MANDATE" as const, label: "SIP" },
    ];
  }

  return [
    { value: "BUY" as const, label: "Buy" },
    { value: "SELL" as const, label: "Sell" },
  ];
}

function dedupeResults(results: InvestmentSearchResult[]) {
  const seen = new Set<string>();
  const deduped: InvestmentSearchResult[] = [];

  for (const result of results) {
    const key = assetKey(result);

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(result);
    }
  }

  return deduped;
}

function assetKey(asset: Pick<InvestmentSearchResult, "type" | "schemeCode" | "symbol" | "name">) {
  return `${asset.type}:${asset.schemeCode ?? asset.symbol ?? asset.name}`;
}

function buildDateTicks(history: Array<{ date: string; value: number }>, range: ChartRange) {
  const shortRange = range === "1D" || range === "1W" || range === "1M" || range === "3M" || range === "6M" || range === "1Y";
  const groups = new Set<string>();
  const ticks: string[] = [];

  for (const point of history) {
    const parsed = parseChartDate(point.date);

    if (!parsed) {
      continue;
    }

    const key = shortRange
      ? `${parsed.getFullYear()}-${parsed.getMonth()}`
      : `${parsed.getFullYear()}`;

    if (!groups.has(key)) {
      groups.add(key);
      ticks.push(point.date);
    }
  }

  return ticks.length ? ticks : history.filter((_, index) => index % Math.ceil(history.length / 6 || 1) === 0).map((point) => point.date);
}

function formatChartTick(value: string, range: ChartRange) {
  const parsed = parseChartDate(value);

  if (!parsed) {
    return value;
  }

  if (range === "3Y" || range === "5Y" || range === "ALL") {
    return String(parsed.getFullYear());
  }

  return parsed.toLocaleDateString("en-IN", { month: "short" });
}

function parseChartDate(value: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const indian = value.match(/^(\d{2})-(\d{2})-(\d{4})/);

  if (indian) {
    return new Date(Number(indian[3]), Number(indian[2]) - 1, Number(indian[1]));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatNavAxis(value: number) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return value >= 10 ? value.toFixed(0) : value.toFixed(2);
}
