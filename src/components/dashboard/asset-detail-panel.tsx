"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownLeft, ArrowUpRight, MoveLeft, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { InvestmentIcon } from "@/components/ui/investment-icon";
import { Label } from "@/components/ui/label";
import { TablePagination, usePagination } from "@/components/ui/pagination";
import { formatCurrency, formatNav } from "@/lib/analytics";
import { assetTypeLabel, transactionTypeLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { calculateXirr } from "@/lib/xirr";
import type { ChartRange, SerializedAsset, SipRow, TransactionRow } from "@/types/portfolio";

type DetailTarget =
  | { kind: "asset"; id: string }
  | { kind: "sip"; id: string };

type InvestmentDetail = {
  name: string;
  value: number | null;
  changePercent: number | null;
  category?: string;
  amc?: string;
  exchange?: string;
  history: Array<{ date: string; value: number }>;
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

type DetailPayload = AssetDetailPayload | SipDetailPayload;

const stockRanges: ChartRange[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "ALL"];
const fundRanges: ChartRange[] = ["1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "ALL"];

const tooltipStyle = {
  background: "var(--panel)",
  border: "1px solid var(--line)",
  borderRadius: "8px",
  color: "var(--foreground)",
};

export function AssetDetailPanel({
  target,
  onClose,
  onChanged,
  mode = "modal",
}: {
  target: DetailTarget | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
  mode?: "modal" | "page";
}) {
  const [range, setRange] = useState<ChartRange>("1Y");
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemMode, setRedeemMode] = useState<"AMOUNT" | "UNITS">("AMOUNT");
  const [redeemAmount, setRedeemAmount] = useState("");
  const [redeemUnits, setRedeemUnits] = useState("");
  const [redeemConfirmOpen, setRedeemConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const cacheRef = useRef(new Map<string, DetailPayload>());
  const prefetchedRef = useRef(new Set<string>());
  const targetIdentity = target ? `${target.kind}:${target.id}` : "";
  const asset =
    payload && "asset" in payload
      ? payload.asset
      : payload && "sip" in payload
        ? payload.sip.asset
        : null;
  const transactions = useMemo(() => payload?.transactions ?? [], [payload?.transactions]);
  const transactionPagination = usePagination(transactions);
  const summary = useMemo(() => summarizeTransactions(transactions, payload?.details.value ?? null), [
    payload?.details.value,
    transactions,
  ]);
  const redeemQuote = useMemo(
    () =>
      buildRedeemQuote({
        mode: redeemMode,
        amountInput: redeemAmount,
        unitsInput: redeemUnits,
        price: payload?.details.value ?? summary.latestPrice,
        availableUnits: summary.units,
      }),
    [payload?.details.value, redeemAmount, redeemMode, redeemUnits, summary.latestPrice, summary.units],
  );
  const ranges = asset?.type === "MUTUAL_FUND" ? fundRanges : stockRanges;
  const dateTicks = useMemo(
    () => buildDateTicks(payload?.details.history ?? [], range),
    [payload?.details.history, range],
  );
  const isLoading = !payload && !error;

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      if (!target) {
        setPayload(null);
        setError("");
        return;
      }

      const key = cacheKey(target, range);
      const cached = cacheRef.current.get(key);

      if (cached) {
        setPayload(cached);
        setError("");
        return;
      }

      setError("");

      if (!payload || payloadTargetIdentity(payload) !== targetIdentity) {
        setPayload(null);
      }

      try {
        const data = await fetchDetailPayload(target, range, controller.signal);
        cacheRef.current.set(key, data);
        setPayload(data);
        void prefetchTargetRanges(target, data, cacheRef.current, prefetchedRef.current);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Unable to load history.");
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [payload, range, target, targetIdentity]);

  if (!target) {
    return null;
  }

  if (mode === "page" && isLoading) {
    return (
      <section className="page-transition space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            <MoveLeft className="h-4 w-4" aria-hidden />
            Back
          </Button>
        </div>
        <div className="flex min-h-[calc(100vh-140px)] items-center justify-center">
          <HistoryLoader />
        </div>
      </section>
    );
  }

  function handleRedeemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!target || target.kind !== "asset" || !asset || asset.type !== "MUTUAL_FUND") {
      return;
    }

    if (redeemQuote.error) {
      setError(redeemQuote.error);
      return;
    }

    setError("");
    setRedeemConfirmOpen(true);
  }

  async function confirmRedeem() {
    if (!target || target.kind !== "asset" || !asset || asset.type !== "MUTUAL_FUND" || redeemQuote.error) {
      return;
    }

    setIsRedeeming(true);

    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: asset.id,
        type: "SELL",
        amount: redeemQuote.amount,
        quantity: redeemQuote.units,
        navOrPrice: redeemQuote.price,
        tradeDate: new Date().toISOString().slice(0, 10),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setIsRedeeming(false);
      setError(data.error ?? "Unable to redeem units.");
      return;
    }

    cacheRef.current.clear();
    const freshPayload = await fetchDetailPayload(target, range);
    setPayload(freshPayload);
    setIsRedeeming(false);
    setRedeemConfirmOpen(false);
    setRedeemAmount("");
    setRedeemUnits("");
    await onChanged();
  }

  return (
    <div
      className={cn(
        mode === "modal"
          ? "fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm animate-fade"
          : "page-transition space-y-5",
      )}
      role={mode === "modal" ? "dialog" : undefined}
      aria-modal={mode === "modal" ? true : undefined}
    >
      {mode === "modal" ? (
        <button className="absolute inset-0 cursor-default" type="button" aria-label="Close history" onClick={onClose} />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            <MoveLeft className="h-4 w-4" aria-hidden />
            Back
          </Button>
        </div>
      )}
      <aside
        className={cn(
          "flex w-full flex-col overflow-y-auto",
          mode === "modal"
            ? "absolute right-0 top-0 h-full max-w-[1120px] border-l border-[var(--line)] bg-[var(--background)] shadow-xl animate-slide-in"
            : "space-y-5 bg-transparent",
        )}
      >
        <header
          className={cn(
            "z-10 border border-[var(--line)] bg-[var(--panel)]/95 px-5 py-4 backdrop-blur",
            mode === "modal" ? "sticky top-0 border-x-0 border-t-0" : "rounded-xl",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <InvestmentIcon
                name={payload?.details.name ?? asset?.name ?? "Loading history"}
                type={asset?.type}
                symbol={asset?.symbol}
                amc={asset?.amc}
                size="lg"
              />
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap gap-2">
                  {asset ? <Badge>{assetTypeLabel(asset.type)}</Badge> : null}
                  {target.kind === "sip" ? <Badge variant="success">SIP history</Badge> : <Badge variant="muted">Asset history</Badge>}
                </div>
                <h2 className="truncate text-2xl font-semibold text-[var(--foreground)]">
                  {payload?.details.name ?? asset?.name ?? "Loading history"}
                </h2>
                <p className="mt-1 truncate text-sm text-[var(--muted)]">
                  {payload?.details.category ?? payload?.details.exchange ?? asset?.schemeCode ?? asset?.symbol ?? "Live chart and entries"}
                </p>
              </div>
            </div>
            {mode === "modal" ? (
              <Button type="button" variant="secondary" size="icon" aria-label="Close" onClick={onClose}>
                <X className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        </header>

        <div className={cn("space-y-5", mode === "modal" && "p-5")}>
          {error ? (
            <div className="rounded-lg border border-[var(--negative)]/30 bg-[var(--negative-soft)] p-4 text-sm text-[var(--negative)]">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex min-h-[520px] items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--panel)]">
              <HistoryLoader />
            </div>
          ) : (
            <>
              <section className={cn("grid gap-4", asset?.type === "MUTUAL_FUND" ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
                <Metric label="Current amount" value={formatCurrency(summary.currentValue)} />
                <Metric label="Invested amount" value={formatCurrency(summary.investedAmount)} />
                <Metric
                  label="Profit / loss"
                  value={`${summary.gain >= 0 ? "+" : ""}${formatCurrency(summary.gain)} (${summary.gainPercent.toFixed(2)}%)`}
                  tone={summary.gain >= 0 ? "positive" : "negative"}
                />
                {asset?.type === "MUTUAL_FUND" ? (
                  <Metric
                    label="XIRR"
                    value={formatXirr(summary.xirr)}
                    tone={summary.xirr === null ? "default" : summary.xirr >= 0 ? "positive" : "negative"}
                  />
                ) : null}
                <Metric label="Redeemable units" value={summary.units.toFixed(3)} />
              </section>

              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <div className="mb-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">Performance</p>
                    <p className="text-xs text-[var(--muted)]">
                      {asset?.type === "MUTUAL_FUND" ? "Mutual fund charts start at 1W" : "NSE/BSE charts include 1D"}
                    </p>
                  </div>
                </div>
                <div className="h-[360px]">
                  {payload?.details.history.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={payload.details.history} margin={{ left: 6, right: 12, top: 16, bottom: 10 }}>
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
                          ticks={dateTicks}
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
                          stroke="var(--primary)"
                          strokeWidth={3}
                          dot={false}
                          activeDot={{ r: 5, stroke: "#f8fafc", strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-[var(--line)] text-sm text-[var(--muted)]">
                      Chart data unavailable from provider.
                    </div>
                  )}
                </div>
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
              </section>

              {target.kind === "asset" && asset?.type === "MUTUAL_FUND" && summary.units > 0 ? (
                <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">Redeem</p>
                      <p className="text-xs text-[var(--muted)]">
                        Choose units or amount. The final entry is saved only after confirmation.
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2 text-sm">
                      <span className="text-[var(--muted)]">Available </span>
                      <span className="font-semibold text-[var(--foreground)]">{summary.units.toFixed(3)} units</span>
                    </div>
                  </div>
                  <form className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={handleRedeemSubmit}>
                    <div className="flex items-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={redeemMode === "AMOUNT" ? "default" : "secondary"}
                        onClick={() => setRedeemMode("AMOUNT")}
                      >
                        Amount
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={redeemMode === "UNITS" ? "default" : "secondary"}
                        onClick={() => setRedeemMode("UNITS")}
                      >
                        Units
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="redeem-amount">Amount</Label>
                      <Input
                        id="redeem-amount"
                        type="number"
                        min={0}
                        step="0.01"
                        value={redeemMode === "AMOUNT" ? redeemAmount : redeemQuote.amount ? redeemQuote.amount.toFixed(2) : ""}
                        readOnly={redeemMode === "UNITS"}
                        onChange={(event) => setRedeemAmount(event.target.value)}
                        placeholder="Enter amount"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="redeem-units">Units</Label>
                      <Input
                        id="redeem-units"
                        type="number"
                        min={0}
                        step="0.001"
                        value={redeemMode === "UNITS" ? redeemUnits : redeemQuote.units ? redeemQuote.units.toFixed(3) : ""}
                        readOnly={redeemMode === "AMOUNT"}
                        onChange={(event) => setRedeemUnits(event.target.value)}
                        placeholder="Enter units"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" variant="danger" disabled={isRedeeming || Boolean(redeemQuote.error)}>
                        Redeem
                      </Button>
                    </div>
                  </form>
                  <div className="mt-3 text-xs text-[var(--muted)]">
                    NAV {redeemQuote.price ? formatNav(redeemQuote.price) : "Unavailable"}
                    {redeemQuote.amount && redeemQuote.units ? (
                      <span> / Estimated {formatCurrency(redeemQuote.amount)} for {redeemQuote.units.toFixed(3)} units</span>
                    ) : null}
                  </div>
                  {redeemQuote.error ? <p className="mt-2 text-sm text-[var(--negative)]">{redeemQuote.error}</p> : null}
                </section>
              ) : null}

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-[var(--foreground)]">Transaction history</h3>
                    <p className="text-sm text-[var(--muted)]">{transactions.length} entries</p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[980px] grid-cols-[0.9fr_0.9fr_0.8fr_0.9fr_1fr_1fr_1fr] border-b border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                      <span>Date</span>
                      <span>Type</span>
                      <span className="text-right">Units</span>
                      <span className="text-right">NAV/Price</span>
                      <span className="text-right">Invested amount</span>
                      <span className="text-right">Current amount</span>
                      <span className="text-right">Profit / loss</span>
                    </div>
                    {transactions.length ? (
                      transactionPagination.items.map((transaction) => {
                        const isSell = transaction.type === "SELL";
                        const currentAmount = isSell
                          ? null
                          : transaction.quantity * (summary.latestPrice ?? transaction.navOrPrice);
                        const profitLoss = currentAmount === null ? null : currentAmount - transaction.amount;

                        return (
                          <div
                            key={transaction.id}
                            className="grid min-w-[980px] grid-cols-[0.9fr_0.9fr_0.8fr_0.9fr_1fr_1fr_1fr] items-center border-b border-[var(--line)] px-4 py-4 text-sm last:border-b-0"
                          >
                            <span className="text-[var(--foreground)]">{transaction.tradeDate}</span>
                            <span className="flex items-center gap-2 text-[var(--muted)]">
                              {isSell ? (
                                <ArrowDownLeft className="h-4 w-4 text-[var(--negative)]" aria-hidden />
                              ) : (
                                <ArrowUpRight className="h-4 w-4 text-[var(--positive)]" aria-hidden />
                              )}
                              {transactionTypeLabel(transaction.type, transaction.asset.type)}
                            </span>
                            <span className="text-right font-medium text-[var(--foreground)]">{transaction.quantity.toFixed(3)}</span>
                            <span className="text-right text-[var(--muted)]">{formatNav(transaction.navOrPrice)}</span>
                            <span className={isSell ? "text-right font-semibold text-[var(--negative)]" : "text-right font-semibold text-[var(--positive)]"}>
                              {isSell ? "-" : "+"}
                              {formatCurrency(transaction.amount)}
                            </span>
                            <span className="text-right font-semibold text-[var(--foreground)]">
                              {currentAmount === null ? "-" : formatCurrency(currentAmount)}
                            </span>
                            <span className={`text-right font-semibold ${profitLoss === null ? "text-[var(--muted)]" : profitLoss >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
                              {profitLoss === null ? "-" : `${profitLoss >= 0 ? "+" : ""}${formatCurrency(profitLoss)}`}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-sm text-[var(--muted)]">
                        No transactions saved for this selection.
                      </div>
                    )}
                  </div>
                  {transactions.length ? (
                    <TablePagination
                      {...transactionPagination}
                      onPageChange={transactionPagination.setPage}
                      onPageSizeChange={transactionPagination.setPageSize}
                    />
                  ) : null}
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
      <ConfirmDialog
        open={redeemConfirmOpen}
        title="Confirm redemption?"
        description={`This will add a redeem transaction for ${asset?.name ?? "this fund"}.`}
        confirmLabel="Confirm redeem"
        cancelLabel="Review"
        tone="danger"
        isBusy={isRedeeming}
        onClose={() => setRedeemConfirmOpen(false)}
        onConfirm={() => void confirmRedeem()}
      >
        <div className="space-y-2">
          <p>
            Units: <span className="font-semibold text-[var(--foreground)]">{redeemQuote.units.toFixed(3)}</span>
          </p>
          <p>
            Amount: <span className="font-semibold text-[var(--foreground)]">{formatCurrency(redeemQuote.amount)}</span>
          </p>
          <p>
            NAV: <span className="font-semibold text-[var(--foreground)]">{redeemQuote.price ? formatNav(redeemQuote.price) : "Unavailable"}</span>
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}

function HistoryLoader() {
  return (
    <div className="portfolio-loader" role="status" aria-live="polite" aria-label="Loading history">
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
  );
}

function cacheKey(target: DetailTarget, range: ChartRange) {
  return `${target.kind}:${target.id}:${range}`;
}

function detailEndpoint(target: DetailTarget, range: ChartRange) {
  return target.kind === "asset"
    ? `/api/assets/${target.id}?range=${range}`
    : `/api/sips/${target.id}?range=${range}`;
}

function payloadTargetIdentity(payload: DetailPayload) {
  return "asset" in payload ? `asset:${payload.asset.id}` : `sip:${payload.sip.id}`;
}

function buildDateTicks(history: Array<{ date: string; value: number }>, range: ChartRange) {
  const shortRange =
    range === "1D" ||
    range === "1W" ||
    range === "1M" ||
    range === "3M" ||
    range === "6M" ||
    range === "1Y";
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

  return ticks.length
    ? ticks
    : history
        .filter((_, index) => index % Math.ceil(history.length / 6 || 1) === 0)
        .map((point) => point.date);
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

async function fetchDetailPayload(
  target: DetailTarget,
  range: ChartRange,
  signal?: AbortSignal,
): Promise<DetailPayload> {
  const response = await fetch(detailEndpoint(target, range), {
    cache: "no-store",
    signal,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to load history.");
  }

  return data;
}

async function prefetchTargetRanges(
  target: DetailTarget,
  payload: DetailPayload,
  cache: Map<string, DetailPayload>,
  prefetched: Set<string>,
) {
  const identity = payloadTargetIdentity(payload);

  if (prefetched.has(identity)) {
    return;
  }

  prefetched.add(identity);
  const type = "asset" in payload ? payload.asset.type : payload.sip.asset.type;
  const ranges = type === "MUTUAL_FUND" ? fundRanges : stockRanges;

  for (const nextRange of ranges) {
    const key = cacheKey(target, nextRange);

    if (cache.has(key)) {
      continue;
    }

    try {
      cache.set(key, await fetchDetailPayload(target, nextRange));
    } catch {
      // A failed background prefetch should not disturb the open panel.
    }
  }
}

function summarizeTransactions(transactions: TransactionRow[], latestPrice: number | null) {
  let units = 0;
  let investedAmount = 0;

  const chronologicalTransactions = [...transactions].sort(
    (left, right) => new Date(left.tradeDate).getTime() - new Date(right.tradeDate).getTime(),
  );

  for (const transaction of chronologicalTransactions) {
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
  const currentValue = fallbackPrice ? units * fallbackPrice : 0;
  const gain = currentValue - investedAmount;
  const xirr = calculateXirr([
    ...chronologicalTransactions.map((transaction) => ({
      date: transaction.tradeDate,
      amount: transaction.type === "SELL" ? transaction.amount : -transaction.amount,
    })),
    ...(currentValue > 0
      ? [{ amount: currentValue, date: new Date().toISOString().slice(0, 10) }]
      : []),
  ]);

  return {
    units: Math.max(units, 0),
    investedAmount,
    currentValue,
    gain,
    gainPercent: investedAmount ? (gain / investedAmount) * 100 : 0,
    latestPrice: fallbackPrice,
    xirr,
  };
}

function formatXirr(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "NA";
  }

  return `${(value * 100).toFixed(2)}%`;
}

function buildRedeemQuote({
  mode,
  amountInput,
  unitsInput,
  price,
  availableUnits,
}: {
  mode: "AMOUNT" | "UNITS";
  amountInput: string;
  unitsInput: string;
  price: number | null;
  availableUnits: number;
}) {
  if (!price) {
    return { amount: 0, units: 0, price: 0, error: "NAV is unavailable for redemption." };
  }

  if (mode === "AMOUNT") {
    const requestedAmount = Number(amountInput);

    if (!requestedAmount) {
      return { amount: 0, units: 0, price, error: "Enter an amount to redeem." };
    }

    const units = Number((requestedAmount / price).toFixed(3));
    const amount = Number((units * price).toFixed(2));

    if (units > availableUnits) {
      return { amount, units, price, error: "Redeem amount exceeds available units." };
    }

    return { amount, units, price, error: "" };
  }

  const units = Number(Number(unitsInput).toFixed(3));
  const amount = Number((units * price).toFixed(2));

  if (!units) {
    return { amount: 0, units: 0, price, error: "Enter units to redeem." };
  }

  if (units > availableUnits) {
    return { amount, units, price, error: "Redeem units exceed available units." };
  }

  return { amount, units, price, error: "" };
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
  const toneClass =
    tone === "positive"
      ? "text-[var(--positive)]"
      : tone === "negative"
        ? "text-[var(--negative)]"
        : "text-[var(--foreground)]";

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className={`mt-3 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
