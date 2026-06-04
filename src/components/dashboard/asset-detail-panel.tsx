"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calculateNetInvestmentAmount, formatCurrency } from "@/lib/analytics";
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

const stockRanges: ChartRange[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "ALL"];
const fundRanges: ChartRange[] = ["1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "ALL"];

const tooltipStyle = {
  background: "#0f1319",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "8px",
  color: "#f8fafc",
};

export function AssetDetailPanel({
  target,
  onClose,
}: {
  target: DetailTarget | null;
  onClose: () => void;
}) {
  const [range, setRange] = useState<ChartRange>("1Y");
  const [payload, setPayload] = useState<AssetDetailPayload | SipDetailPayload | null>(null);
  const [error, setError] = useState("");
  const asset =
    payload && "asset" in payload
      ? payload.asset
      : payload && "sip" in payload
        ? payload.sip.asset
        : null;
  const transactions = useMemo(() => payload?.transactions ?? [], [payload?.transactions]);
  const summary = useMemo(() => summarizeTransactions(transactions, payload?.details.value ?? null), [
    payload?.details.value,
    transactions,
  ]);
  const ranges = asset?.type === "MUTUAL_FUND" ? fundRanges : stockRanges;
  const isLoading = !payload && !error;

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setPayload(null);
      setError("");

      if (!target) {
        return;
      }

      const endpoint =
        target.kind === "asset"
          ? `/api/assets/${target.id}?range=${range}`
          : `/api/sips/${target.id}?range=${range}`;
      const response = await fetch(endpoint, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to load history.");
        return;
      }

      setPayload(data);
    }

    void load();
    return () => controller.abort();
  }, [range, target]);

  if (!target) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade" role="dialog" aria-modal="true">
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Close history" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[1120px] flex-col overflow-y-auto border-l border-white/10 bg-[#090b0f] shadow-2xl shadow-black animate-slide-in">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#090b0f]/92 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-2">
                {asset ? <Badge>{asset.type.replace("_", " ")}</Badge> : null}
                {target.kind === "sip" ? <Badge variant="success">SIP history</Badge> : <Badge variant="muted">Asset history</Badge>}
              </div>
              <h2 className="truncate text-2xl font-semibold text-white">
                {payload?.details.name ?? asset?.name ?? "Loading history"}
              </h2>
              <p className="mt-1 truncate text-sm text-slate-400">
                {payload?.details.category ?? payload?.details.exchange ?? asset?.schemeCode ?? asset?.symbol ?? "Live chart and entries"}
              </p>
            </div>
            <Button type="button" variant="secondary" size="icon" aria-label="Close" onClick={onClose}>
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </header>

        <div className="space-y-5 p-5">
          {error ? (
            <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
              <div className="text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-cyan-300" />
                <p className="mt-4 text-sm font-semibold text-white">Loading history</p>
                <p className="mt-1 text-sm text-slate-500">Fetching saved entries and live chart data</p>
              </div>
            </div>
          ) : (
            <>
              <section className="grid gap-4 lg:grid-cols-4">
                <Metric label="Current" value={formatCurrency(summary.currentValue)} />
                <Metric label="Invested" value={formatCurrency(summary.investedAmount)} />
                <Metric
                  label="Total returns"
                  value={`${summary.gain >= 0 ? "+" : ""}${formatCurrency(summary.gain)} (${summary.gainPercent.toFixed(2)}%)`}
                  tone={summary.gain >= 0 ? "positive" : "negative"}
                />
                <Metric label="Redeemable units" value={summary.units.toFixed(3)} />
              </section>

              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Performance</p>
                    <p className="text-xs text-slate-500">
                      {asset?.type === "MUTUAL_FUND" ? "Mutual fund charts start at 1W" : "NSE/BSE charts include 1D"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                <div className="h-[360px]">
                  {payload?.details.history.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={payload.details.history} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="detailPanelFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00c2a8" stopOpacity={0.36} />
                            <stop offset="95%" stopColor="#00c2a8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#8b95a7", fontSize: 12 }} />
                        <YAxis
                          width={80}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#8b95a7", fontSize: 12 }}
                          tickFormatter={(value) => formatCurrency(Number(value))}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#00c2a8"
                          strokeWidth={3}
                          fill="url(#detailPanelFill)"
                          activeDot={{ r: 5, strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/15 text-sm text-slate-400">
                      Chart data unavailable from provider.
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Transaction history</h3>
                    <p className="text-sm text-slate-400">{transactions.length} entries</p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-white/10">
                  <div className="grid grid-cols-[1fr_1fr_1fr_1fr] border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 md:grid-cols-[1fr_1fr_1fr_1fr_1fr]">
                    <span>Date</span>
                    <span>Type</span>
                    <span className="text-right">Units</span>
                    <span className="hidden text-right md:block">NAV/Price</span>
                    <span className="text-right">Value</span>
                  </div>
                  {transactions.length ? (
                    transactions.map((transaction) => {
                      const isSell = transaction.type === "SELL";
                      return (
                        <div
                          key={transaction.id}
                          className="grid grid-cols-[1fr_1fr_1fr_1fr] items-center border-b border-white/10 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[1fr_1fr_1fr_1fr_1fr]"
                        >
                          <span className="text-white">{transaction.tradeDate}</span>
                          <span className="flex items-center gap-2 text-slate-300">
                            {isSell ? (
                              <ArrowDownLeft className="h-4 w-4 text-rose-300" aria-hidden />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-emerald-300" aria-hidden />
                            )}
                            {transaction.type.replace("_", " ")}
                          </span>
                          <span className="text-right font-medium text-white">{transaction.quantity.toFixed(3)}</span>
                          <span className="hidden text-right text-slate-300 md:block">{formatCurrency(transaction.navOrPrice)}</span>
                          <span className={isSell ? "text-right font-semibold text-rose-200" : "text-right font-semibold text-emerald-200"}>
                            {isSell ? "-" : "+"}
                            {formatCurrency(transaction.amount)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-sm text-slate-400">
                      No transactions saved for this selection.
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function summarizeTransactions(transactions: TransactionRow[], latestPrice: number | null) {
  let units = 0;
  let investedAmount = 0;

  for (const transaction of transactions) {
    if (transaction.type === "SELL") {
      units -= transaction.quantity;
      investedAmount = Math.max(investedAmount - transaction.amount, 0);
    } else {
      units += transaction.quantity;
      investedAmount += calculateNetInvestmentAmount(transaction.amount, transaction.stampDuty);
    }
  }

  const fallbackPrice = latestPrice ?? transactions[0]?.navOrPrice ?? null;
  const currentValue = fallbackPrice ? units * fallbackPrice : 0;
  const gain = currentValue - investedAmount;

  return {
    units: Math.max(units, 0),
    investedAmount,
    currentValue,
    gain,
    gainPercent: investedAmount ? (gain / investedAmount) * 100 : 0,
  };
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
      ? "text-emerald-300"
      : tone === "negative"
        ? "text-rose-300"
        : "text-white";

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-3 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
