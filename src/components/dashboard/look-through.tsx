"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { formatCurrency } from "@/lib/analytics";
import type { AllocationPoint, HoldingRow } from "@/types/portfolio";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/screens/panel";

const assetClassOrder = ["Equity", "Debt", "Commodities"] as const;
type AssetClassName = (typeof assetClassOrder)[number];

export function normalizeKnownAllocations(data: AllocationPoint[]) {
  const known = data.filter((point) => point.value > 0 && point.name.toLowerCase() !== "unclassified");
  const total = known.reduce((sum, point) => sum + point.value, 0);

  if (!total) {
    return [];
  }

  return known.map((point) => ({
    ...point,
    value: Number(((point.value / total) * 100).toFixed(2)),
  }));
}

export function buildAssetSplit(apiAllocations: AllocationPoint[], holdings: HoldingRow[]) {
  const allApiLabelsAreAssetClasses =
    apiAllocations.length > 0 &&
    apiAllocations.some((point) => point.value > 0 || (point.amount ?? 0) > 0) &&
    apiAllocations.every((point) => assetClassOrder.includes(point.name as AssetClassName));

  if (allApiLabelsAreAssetClasses) {
    return sortAssetClasses(apiAllocations);
  }

  const totals = new Map<AssetClassName, number>(assetClassOrder.map((name) => [name, 0]));

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

/** Horizontal bars for one allocation, each row opening the holdings it came from. */
export function AllocationBars({
  title,
  data,
  emptyText,
  barColor = "var(--accent)",
  limit = 8,
  onSelect,
}: {
  title: string;
  data: AllocationPoint[];
  emptyText: string;
  barColor?: string;
  limit?: number;
  onSelect?: (name: string) => void;
}) {
  const shown = normalizeKnownAllocations(data).sort((a, b) => b.value - a.value).slice(0, limit);
  const max = Math.max(...shown.map((point) => point.value), 1);

  return (
    <Panel>
      <PanelHeader title={title} />
      <div className="px-5 pb-5">
        {shown.length ? (
          <ul className="space-y-1">
            {shown.map((point) => (
              <li key={point.name}>
                <button
                  type="button"
                  className="grid min-h-10 w-full grid-cols-[minmax(0,120px)_minmax(0,1fr)_52px] items-center gap-3 rounded-lg px-2 text-left text-sm transition hover:bg-[var(--row-hover)] disabled:cursor-default"
                  onClick={onSelect ? () => onSelect(point.name) : undefined}
                  disabled={!onSelect}
                >
                  <span className="truncate text-[var(--muted)]">{point.name}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-[var(--panel-soft)]">
                    <span className="block h-2 rounded-full" style={{ width: `${(point.value / max) * 100}%`, background: barColor }} />
                  </span>
                  <span className="text-right font-semibold">{point.value.toFixed(point.value >= 10 ? 0 : 1)}%</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-[var(--panel-soft)] p-4 text-sm text-[var(--muted)]">{emptyText}</p>
        )}
      </div>
    </Panel>
  );
}

export function StockConcentration({ data }: { data: AllocationPoint[] }) {
  const [showOtherStocks, setShowOtherStocks] = useState(false);
  const knownStocks = data.filter((point) => point.value > 0);
  const topStocks = knownStocks.slice(0, 6);
  const otherStocks = knownStocks.slice(6);
  const otherValue = Number(otherStocks.reduce((sum, point) => sum + point.value, 0).toFixed(2));
  // Scale to the largest single stock; the "other" bucket would otherwise flatten every row.
  const maxValue = Math.max(...topStocks.map((point) => point.value), 1);
  const otherMaxValue = Math.max(...otherStocks.map((point) => point.value), 1);

  return (
    <>
      <Panel>
        <PanelHeader
          title="Biggest stock exposures"
          description={
            knownStocks.length
              ? `${knownStocks.length} stocks across direct holdings and fund portfolios`
              : undefined
          }
        />
        <div className="px-5 pb-5">
          {topStocks.length ? (
            <ul className="space-y-1">
              {topStocks.map((point) => (
                <li
                  key={point.name}
                  className="grid min-h-10 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_56px] items-center gap-3 px-2 text-sm"
                >
                  <span className="truncate">{point.name}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-[var(--panel-soft)]">
                    <span className="block h-2 rounded-full bg-[var(--chart-4)]" style={{ width: `${(point.value / maxValue) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold">{point.value.toFixed(1)}%</span>
                </li>
              ))}
              {otherStocks.length ? (
                <li>
                  <button
                    type="button"
                    className="grid min-h-10 w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_56px] items-center gap-3 rounded-lg px-2 text-left text-sm transition hover:bg-[var(--row-hover)]"
                    onClick={() => setShowOtherStocks(true)}
                  >
                    <span className="truncate text-[var(--muted)] underline decoration-dotted underline-offset-4">
                      {otherStocks.length} other stocks
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-[var(--panel-soft)]">
                      <span className="block h-2 rounded-full bg-[var(--chart-5)]" style={{ width: `${Math.min((otherValue / maxValue) * 100, 100)}%` }} />
                    </span>
                    <span className="text-right font-semibold">{otherValue.toFixed(1)}%</span>
                  </button>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="rounded-lg bg-[var(--panel-soft)] p-4 text-sm text-[var(--muted)]">
              Underlying stock holdings are unavailable from providers for the current portfolio.
            </p>
          )}
        </div>
      </Panel>

      {showOtherStocks ? (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm animate-fade" role="dialog" aria-modal="true" aria-labelledby="other-stocks-title">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close other stocks"
            onClick={() => setShowOtherStocks(false)}
          />
          <div className="modal-panel absolute left-1/2 top-1/2 flex max-h-[82vh] w-[min(92vw,760px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-5">
              <div>
                <h3 id="other-stocks-title" className="text-lg font-semibold">Other stock exposures</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {otherStocks.length} stocks making up {otherValue.toFixed(2)}% of stock exposure
                </p>
              </div>
              <Button type="button" size="icon" variant="secondary" aria-label="Close other stocks" onClick={() => setShowOtherStocks(false)}>
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-5">
              {otherStocks.map((point) => (
                <li key={point.name} className="grid min-h-11 grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_56px] items-center gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{point.name}</span>
                    {point.amount ? <span className="block text-xs text-[var(--muted)]">{formatCurrency(point.amount)} exposure</span> : null}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-[var(--panel-soft)]">
                    <span className="block h-2 rounded-full bg-[var(--chart-4)]" style={{ width: `${(point.value / otherMaxValue) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold">{point.value.toFixed(2)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
