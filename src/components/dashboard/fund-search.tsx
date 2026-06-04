"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Search, Star } from "lucide-react";
import { formatCurrency } from "@/lib/analytics";
import type { ChartRange, InvestmentSearchResult } from "@/types/portfolio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const stockRanges: ChartRange[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "ALL"];
const fundRanges: ChartRange[] = ["1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "ALL"];
const tooltipStyle = {
  background: "#0f1319",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  color: "#f8fafc",
};

type Detail = {
  name: string;
  value: number | null;
  changePercent: number | null;
  category?: string;
  amc?: string;
  exchange?: string;
  history: Array<{ date: string; value: number }>;
  holdings?: Array<{ name: string; weight: number }>;
  sectorAllocation?: Array<{ name: string; value: number }>;
  marketCapAllocation?: Array<{ name: string; value: number }>;
};

export function FundSearch({ onChanged }: { onChanged: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InvestmentSearchResult[]>([]);
  const [selected, setSelected] = useState<InvestmentSearchResult | null>(null);
  const [range, setRange] = useState<ChartRange>("1Y");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function search() {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });

      if (response.ok) {
        setResults(await response.json());
      }
    }

    void search();
    return () => controller.abort();
  }, [query]);

  useEffect(() => {
    async function loadDetail() {
      setDetail(null);
      setError("");

      if (!selected) {
        return;
      }

      const effectiveRange = selected.type === "MUTUAL_FUND" && range === "1D" ? "1W" : range;
      const url =
        selected.type === "MUTUAL_FUND"
          ? `/api/funds/${selected.schemeCode}?range=${effectiveRange}`
          : `/api/quotes/${encodeURIComponent(selected.symbol ?? "")}?type=${selected.type}&range=${effectiveRange}`;
      const response = await fetch(url);
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Investment data unavailable.");
        return;
      }

      setDetail(payload);
    }

    void loadDetail();
  }, [range, selected]);

  async function addToWatchlist() {
    if (!selected) {
      return;
    }

    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset: selected }),
    });
    await onChanged();
  }

  const ranges = selected?.type === "MUTUAL_FUND" ? fundRanges : stockRanges;

  return (
    <section className="grid gap-5 xl:grid-cols-[0.95fr_1.35fr]">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>Indian mutual funds, NSE/BSE stocks, and ETFs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type Reliance, NiftyBees, Parag..."
            />
          </div>
          <div className="overflow-hidden rounded-md border border-white/10 bg-black/20">
            {results.map((asset) => (
              <button
                key={asset.schemeCode ?? asset.symbol}
                type="button"
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-3 py-3 text-left transition hover:bg-white/[0.06]"
                onClick={() => {
                  setSelected(asset);
                  setRange(asset.type === "MUTUAL_FUND" ? "1W" : "1D");
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">{asset.name}</span>
                  <span className="block truncate text-xs text-slate-500">{asset.symbol ?? asset.schemeCode}</span>
                </span>
                <Badge variant="muted">{asset.type}</Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>{detail?.name ?? selected?.name ?? "Select an investment"}</CardTitle>
              <CardDescription>
                {detail?.category ?? detail?.exchange ?? selected?.category ?? "Live detail appears here"}
              </CardDescription>
            </div>
            {selected ? (
              <Button type="button" variant="secondary" onClick={addToWatchlist}>
                <Star className="h-4 w-4" aria-hidden />
                Watch
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {selected ? (
            <>
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
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-black/[0.16] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {selected.type === "MUTUAL_FUND" ? "NAV" : "Price"}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {detail?.value ? formatCurrency(detail.value) : "Unavailable"}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/[0.16] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Change</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {detail?.changePercent !== null && detail?.changePercent !== undefined
                      ? `${detail.changePercent >= 0 ? "+" : ""}${detail.changePercent.toFixed(2)}%`
                      : "Unavailable"}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/[0.16] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Type</p>
                  <p className="mt-2 text-xl font-semibold text-white">{selected.type}</p>
                </div>
              </div>
              <div className="h-[340px]">
                {detail?.history?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={detail.history} margin={{ left: 0, right: 12, top: 10 }}>
                      <defs>
                        <linearGradient id="detailFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                      <Area type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={3} fill="url(#detailFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/15 text-sm text-slate-400">
                    {error || "Chart data unavailable from provider."}
                  </div>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <DetailList title="Holdings" items={detail?.holdings?.map((item) => `${item.name} · ${item.weight}%`) ?? []} />
                <DetailList
                  title="Sector / Market Cap"
                  items={[
                    ...(detail?.sectorAllocation?.map((item) => `${item.name} · ${item.value}%`) ?? []),
                    ...(detail?.marketCapAllocation?.map((item) => `${item.name} · ${item.value}%`) ?? []),
                  ]}
                />
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
              Search and select an investment to view live details.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/[0.16] p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-4 space-y-2">
        {items.length ? (
          items.slice(0, 8).map((item) => (
            <p key={item} className="truncate text-sm text-slate-300">
              {item}
            </p>
          ))
        ) : (
          <p className="text-sm text-slate-500">Unavailable from provider.</p>
        )}
      </div>
    </div>
  );
}
