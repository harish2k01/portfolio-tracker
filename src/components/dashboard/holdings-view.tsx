"use client";

import { useMemo, useState } from "react";
import { assetTypeLabel } from "@/lib/labels";
import type { HoldingRow, PortfolioDashboard } from "@/types/portfolio";
import { formatCurrency } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestmentIdentity } from "@/components/ui/investment-icon";
import { TablePagination, usePagination } from "@/components/ui/pagination";

type HoldingView = "ALL" | "MF" | "STOCKS";

function EmptyState({ title, action }: { title: string; action?: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--panel-soft)] p-8 text-center">
      <p className="text-sm text-[var(--muted)]">{title}</p>
      {action ? (
        <Button type="button" className="mt-4" onClick={action}>
          Add investments
        </Button>
      ) : null}
    </div>
  );
}

export function HoldingsView({
  dashboard,
  filter,
  onFilterChange,
  onOpenAsset,
  onOpenTransactions,
}: {
  dashboard: PortfolioDashboard | null;
  filter: string | null;
  onFilterChange: (filter: string | null) => void;
  onOpenAsset: (assetId: string) => void;
  onOpenTransactions: () => void;
}) {
  const [holdingView, setHoldingView] = useState<HoldingView>("ALL");
  const holdings = useMemo(() => dashboard?.holdings ?? [], [dashboard?.holdings]);
  const typeFilteredHoldings = useMemo(
    () =>
      holdings.filter((holding) => {
        if (holdingView === "MF") {
          return holding.type === "MUTUAL_FUND";
        }

        if (holdingView === "STOCKS") {
          return holding.type === "STOCK" || holding.type === "ETF";
        }

        return true;
      }),
    [holdingView, holdings],
  );
  const filteredHoldings = useMemo(
    () =>
      filter
        ? typeFilteredHoldings.filter(
            (holding) =>
              holding.assetClass === filter ||
              (holding.category ?? "") === filter ||
              holding.assetAllocation?.some((point) => point.name === filter) ||
              holding.sectorAllocation?.some((point) => point.name === filter) ||
              holding.marketCapAllocation?.some((point) => point.name === filter),
          )
        : typeFilteredHoldings,
    [filter, typeFilteredHoldings],
  );
  const holdingsPagination = usePagination(filteredHoldings);

  if (!dashboard) {
    return <EmptyState title="Loading holdings..." />;
  }

  return (
    <section className="space-y-5">
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
                onClick={() => {
                  setHoldingView(item);
                  holdingsPagination.setPage(1);
                }}
              >
                {item === "ALL" ? "All" : item === "MF" ? "MF" : "Stocks"}
              </Button>
            ))}
            {filter ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  onFilterChange(null);
                  holdingsPagination.setPage(1);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {filteredHoldings.length ? (
            <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
              <div className="hidden grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.7fr] border-b border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)] lg:grid">
                <span>Holding</span>
                <span className="text-right">Units</span>
                <span className="text-right">Invested</span>
                <span className="text-right">Current</span>
                <span className="text-right">Returns</span>
              </div>
              {holdingsPagination.items.map((holding: HoldingRow) => (
                <button
                  key={holding.assetId}
                  type="button"
                  className="grid w-full gap-3 border-b border-[var(--line)] px-4 py-4 text-left transition duration-200 last:border-b-0 hover:bg-[var(--row-hover)] lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.7fr] lg:items-center"
                  onClick={() => onOpenAsset(holding.assetId)}
                >
                  <InvestmentIdentity
                    name={holding.name}
                    type={holding.type}
                    symbol={holding.symbol}
                    isin={holding.isin}
                    logoUrl={holding.logoUrl}
                    subtitle={`${holding.assetClass} / ${assetTypeLabel(holding.type)}`}
                  />
                  <p className="text-sm font-semibold text-[var(--foreground)] lg:text-right">{holding.quantity.toFixed(3)}</p>
                  <p className="text-sm font-semibold text-[var(--foreground)] lg:text-right">
                    {formatCurrency(holding.investedAmount)}
                  </p>
                  <p className="text-sm font-semibold text-[var(--foreground)] lg:text-right">
                    {formatCurrency(holding.currentValue)}
                  </p>
                  <div className="lg:text-right">
                    <p
                      className={
                        holding.gain >= 0
                          ? "text-sm font-semibold text-[var(--positive)]"
                          : "text-sm font-semibold text-[var(--negative)]"
                      }
                    >
                      {holding.gain >= 0 ? "+" : ""}
                      {formatCurrency(holding.gain)}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{holding.gainPercent.toFixed(2)}%</p>
                  </div>
                </button>
              ))}
              <TablePagination
                {...holdingsPagination}
                onPageChange={holdingsPagination.setPage}
                onPageSizeChange={holdingsPagination.setPageSize}
              />
            </div>
          ) : (
            <EmptyState
              title={filter ? "No holdings match this allocation." : "Add transactions to see holdings here."}
              action={filter ? undefined : onOpenTransactions}
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
