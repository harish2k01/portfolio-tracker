"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft } from "lucide-react";
import { formatNav } from "@/lib/analytics";
import { assetTypeLabel } from "@/lib/labels";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestmentIcon } from "@/components/ui/investment-icon";
import { cn } from "@/lib/utils";

type FundDetailsProps = {
  details: {
    name: string;
    type: string;
    schemeCode?: string;
    amc?: string;
    category?: string;
    value: number | null;
    changePercent: number | null;
    history: Array<{ date: string; value: number }>;
    holdings?: Array<{ name: string; weight: number }>;
    sectorAllocation?: Array<{ name: string; value: number }>;
    marketCapAllocation?: Array<{ name: string; value: number }>;
  };
};

const tooltipStyle = {
  background: "var(--panel)",
  border: "1px solid var(--line)",
  borderRadius: "8px",
  color: "var(--foreground)",
};

export function FundDetails({ details }: FundDetailsProps) {
  return (
    <main className="theme-light min-h-screen bg-[var(--background)] px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px] space-y-5">
        <header className="glass-panel rounded-xl p-6">
          <Link href="/" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mb-5")}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Dashboard
          </Link>
          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <InvestmentIcon name={details.name} type="MUTUAL_FUND" amc={details.amc} size="lg" />
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge>{assetTypeLabel(details.type)}</Badge>
                  {details.schemeCode ? <Badge variant="muted">{details.schemeCode}</Badge> : null}
                </div>
                <h1 className="max-w-4xl text-3xl font-semibold tracking-normal text-[var(--foreground)]">
                  {details.name}
                </h1>
                <p className="mt-2 text-[var(--muted)]">{details.amc ?? details.category}</p>
              </div>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">Current NAV</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
                {details.value !== null ? formatNav(details.value) : "Unavailable"}
              </p>
            </div>
          </div>
        </header>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Historical Performance</CardTitle>
            <CardDescription>Mutual fund ranges start at 1W</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[360px]">
              {details.history.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={details.history} margin={{ left: 0, right: 12, top: 10 }}>
                    <defs>
                      <linearGradient id="fundNavFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.14} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(value) => formatNav(Number(value))}
                    />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatNav(Number(value))} />
                    <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} fill="url(#fundNavFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-[var(--line)] text-sm text-[var(--muted)]">
                  NAV history unavailable from provider.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-3">
          <ListCard
            title="Holdings"
            items={details.holdings?.map((item) => ({ name: item.name, value: `${item.weight}%` })) ?? []}
            showInvestmentIcons
          />
          <ListCard title="Sector Allocation" items={details.sectorAllocation?.map((item) => `${item.name} - ${item.value}%`) ?? []} />
          <ListCard title="Market Cap Allocation" items={details.marketCapAllocation?.map((item) => `${item.name} - ${item.value}%`) ?? []} />
        </div>
      </div>
    </main>
  );
}

function ListCard({
  title,
  items,
  showInvestmentIcons = false,
}: {
  title: string;
  items: Array<string | { name: string; value: string }>;
  showInvestmentIcons?: boolean;
}) {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.slice(0, 10).map((item) => {
            const key = typeof item === "string" ? item : `${item.name}:${item.value}`;

            return (
              <div key={key} className="rounded-lg border border-[var(--line)] bg-[var(--panel-soft)] p-3 text-sm text-[var(--foreground)]">
                {showInvestmentIcons && typeof item !== "string" ? (
                  <span className="flex min-w-0 items-center gap-3">
                    <InvestmentIcon name={item.name} type="STOCK" />
                    <span className="min-w-0 truncate font-semibold">{item.name}</span>
                    <span className="ml-auto shrink-0 text-[var(--muted)]">{item.value}</span>
                  </span>
                ) : (
                  <span>{typeof item === "string" ? item : `${item.name} - ${item.value}`}</span>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-[var(--muted)]">Unavailable from provider.</p>
        )}
      </CardContent>
    </Card>
  );
}
