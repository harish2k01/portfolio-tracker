"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { useApp } from "@/components/app/app-shell";
import { PageHeader } from "@/components/screens/page-header";
import { Panel, StatTile, signed } from "@/components/screens/panel";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, formatNav } from "@/lib/analytics";
import { chartPalette } from "@/lib/chart-colors";
import { assetTypeLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { HoldingRow } from "@/types/portfolio";

type TypeFilter = "ALL" | "MUTUAL_FUND" | "STOCK" | "ETF";

const typeFilters: Array<{ id: TypeFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "MUTUAL_FUND", label: "Mutual funds" },
  { id: "STOCK", label: "Stocks" },
  { id: "ETF", label: "ETFs" },
];
const classOrder: HoldingRow["assetClass"][] = ["Equity", "Debt", "Commodities"];

function matchesAllocation(holding: HoldingRow, filter: string) {
  return (
    holding.assetClass === filter ||
    (holding.category ?? "") === filter ||
    Boolean(holding.assetAllocation?.some((point) => point.name === filter)) ||
    Boolean(holding.sectorAllocation?.some((point) => point.name === filter)) ||
    Boolean(holding.marketCapAllocation?.some((point) => point.name === filter))
  );
}

function sum(rows: HoldingRow[], key: "currentValue" | "investedAmount" | "gain") {
  return rows.reduce((total, row) => total + row[key], 0);
}

function percentText(value: number) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

export function HoldingsScreen({ filter }: { filter: string | null }) {
  const { dashboard, openAsset } = useApp();
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const holdings = useMemo(() => dashboard?.holdings ?? [], [dashboard?.holdings]);
  const allocationFiltered = useMemo(
    () => (filter ? holdings.filter((holding) => matchesAllocation(holding, filter)) : holdings),
    [filter, holdings],
  );
  const visible = useMemo(
    () => allocationFiltered.filter((holding) => typeFilter === "ALL" || holding.type === typeFilter),
    [allocationFiltered, typeFilter],
  );
  const groups = useMemo(
    () =>
      classOrder
        .map((assetClass) => ({
          assetClass,
          rows: visible.filter((row) => row.assetClass === assetClass).sort((a, b) => b.currentValue - a.currentValue),
        }))
        .filter((group) => group.rows.length),
    [visible],
  );

  if (!dashboard) {
    return null;
  }

  const total = sum(holdings, "currentValue");
  const invested = sum(holdings, "investedAmount");
  const gain = sum(holdings, "gain");
  const visibleTotal = sum(visible, "currentValue") || 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Holdings"
        description={`${holdings.length} ${holdings.length === 1 ? "position" : "positions"} in funds, stocks and ETFs`}
        actions={
          <Link href="/activity" className={cn(buttonVariants(), "h-11")}>
            <Plus className="h-4 w-4" aria-hidden />
            Add transaction
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Current value" value={formatCurrency(total)} />
        <StatTile label="Invested" value={formatCurrency(invested)} />
        <StatTile
          label="Unrealised gain"
          value={signed(gain, formatCurrency)}
          helper={invested ? percentText((gain / invested) * 100) : undefined}
          tone={gain >= 0 ? "positive" : "negative"}
        />
        <StatTile label="Realised gain" value={signed(dashboard.summary.realizedGain, formatCurrency)} helper="From sells and redemptions" />
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by type">
        {typeFilters.map((item) => {
          const count = item.id === "ALL" ? allocationFiltered.length : allocationFiltered.filter((row) => row.type === item.id).length;
          const active = typeFilter === item.id;

          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              className={cn(
                "h-10 rounded-full border px-4 text-sm font-medium transition",
                active
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--line-strong)]",
              )}
              onClick={() => setTypeFilter(item.id)}
            >
              {item.label}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          );
        })}
        {filter ? (
          <button
            type="button"
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--accent)] px-4 text-sm font-medium text-[var(--accent)]"
            onClick={() => router.replace("/holdings")}
          >
            Holds {filter}
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">Clear filter</span>
          </button>
        ) : null}
      </div>

      <Panel aria-label="Holdings">
        {groups.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead>
                <tr className="text-right text-xs text-[var(--muted)]">
                  <th scope="col" className="px-5 py-3 text-left font-medium">Holding</th>
                  <th scope="col" className="px-3 py-3 font-medium">Units</th>
                  <th scope="col" className="px-3 py-3 font-medium">Avg cost</th>
                  <th scope="col" className="px-3 py-3 font-medium">Price</th>
                  <th scope="col" className="px-3 py-3 font-medium">Value</th>
                  <th scope="col" className="px-3 py-3 font-medium">Gain</th>
                  <th scope="col" className="px-5 py-3 font-medium">Weight</th>
                </tr>
              </thead>
              {groups.map((group, index) => {
                const groupValue = sum(group.rows, "currentValue");
                const groupGain = sum(group.rows, "gain");

                return (
                  <tbody key={group.assetClass}>
                    <tr className="bg-[var(--row-hover)]">
                      <th scope="rowgroup" colSpan={4} className="border-t border-[var(--line)] px-5 py-2.5 text-left font-semibold">
                        <span className="inline-flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: chartPalette[index] }} aria-hidden />
                          {group.assetClass}
                          <span className="font-normal text-[var(--muted)]">
                            {group.rows.length} · {((groupValue / visibleTotal) * 100).toFixed(0)}%
                          </span>
                        </span>
                      </th>
                      <td className="border-t border-[var(--line)] px-3 py-2.5 text-right font-semibold">{formatCurrency(groupValue)}</td>
                      <td
                        className={cn(
                          "border-t border-[var(--line)] px-3 py-2.5 text-right font-semibold",
                          groupGain >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]",
                        )}
                      >
                        {signed(groupGain, formatCurrency)}
                      </td>
                      <td className="border-t border-[var(--line)] px-5 py-2.5" />
                    </tr>
                    {group.rows.map((holding) => {
                      const weight = (holding.currentValue / visibleTotal) * 100;
                      const averageCost = holding.quantity ? holding.investedAmount / holding.quantity : null;

                      return (
                        <tr key={holding.assetId} className="text-right transition hover:bg-[var(--row-hover)]">
                          <td className="border-t border-[var(--line)] px-5 py-3 text-left">
                            <button type="button" className="text-left" onClick={() => openAsset(holding.assetId)}>
                              <span className="block font-medium hover:underline">{holding.name}</span>
                              <span className="block text-xs text-[var(--muted)]">
                                {[assetTypeLabel(holding.type), holding.category, holding.symbol].filter(Boolean).join(" · ")}
                              </span>
                            </button>
                          </td>
                          <td className="border-t border-[var(--line)] px-3 py-3 text-[var(--muted)]">
                            {holding.quantity.toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                          </td>
                          <td className="border-t border-[var(--line)] px-3 py-3 text-[var(--muted)]">
                            {averageCost === null ? "—" : formatNav(averageCost)}
                          </td>
                          <td className="border-t border-[var(--line)] px-3 py-3">
                            {holding.currentPrice === null ? "—" : formatNav(holding.currentPrice)}
                          </td>
                          <td className="border-t border-[var(--line)] px-3 py-3 font-medium">{formatCurrency(holding.currentValue)}</td>
                          <td
                            className={cn(
                              "border-t border-[var(--line)] px-3 py-3",
                              holding.gain >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]",
                            )}
                          >
                            {signed(holding.gain, formatCurrency)}
                            <span className="block text-xs">{percentText(holding.gainPercent)}</span>
                          </td>
                          <td className="border-t border-[var(--line)] px-5 py-3">
                            <span className="inline-flex items-center gap-2.5">
                              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--panel-soft)]">
                                <span className="block h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(weight, 100)}%` }} />
                              </span>
                              {weight.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-[var(--muted)]">
              {holdings.length ? "No holdings match these filters." : "Add a transaction or import a statement to see your holdings here."}
            </p>
            {holdings.length ? null : (
              <Link href="/activity" className={cn(buttonVariants(), "mt-4")}>
                Add your first investment
              </Link>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
