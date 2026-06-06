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
  background: "#111827",
  border: "1px solid rgba(148,163,184,0.24)",
  borderRadius: "8px",
  color: "#f8fafc",
};

export function FundDetails({ details }: FundDetailsProps) {
  return (
    <main className="theme-light min-h-screen bg-[#fbfcfd] px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px] space-y-5">
        <header className="glass-panel rounded-lg p-5">
          <Link href="/" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mb-5")}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Dashboard
          </Link>
          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge>{assetTypeLabel(details.type)}</Badge>
                {details.schemeCode ? <Badge variant="muted">{details.schemeCode}</Badge> : null}
              </div>
              <h1 className="max-w-4xl text-3xl font-semibold tracking-normal text-white">
                {details.name}
              </h1>
              <p className="mt-2 text-slate-400">{details.amc ?? details.category}</p>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-sm uppercase tracking-[0.16em] text-slate-500">Current NAV</p>
              <p className="mt-2 text-3xl font-semibold text-white">
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
                        <stop offset="5%" stopColor="#0787e5" stopOpacity={0.14} />
                        <stop offset="95%" stopColor="#0787e5" stopOpacity={0} />
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
                    <Area type="monotone" dataKey="value" stroke="#0787e5" strokeWidth={2.5} fill="url(#fundNavFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/15 text-sm text-slate-400">
                  NAV history unavailable from provider.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-3">
          <ListCard title="Holdings" items={details.holdings?.map((item) => `${item.name} - ${item.weight}%`) ?? []} />
          <ListCard title="Sector Allocation" items={details.sectorAllocation?.map((item) => `${item.name} - ${item.value}%`) ?? []} />
          <ListCard title="Market Cap Allocation" items={details.marketCapAllocation?.map((item) => `${item.name} - ${item.value}%`) ?? []} />
        </div>
      </div>
    </main>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.slice(0, 10).map((item) => (
            <div key={item} className="rounded-md border border-white/10 bg-black/[0.16] p-3 text-sm text-slate-300">
              {item}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">Unavailable from provider.</p>
        )}
      </CardContent>
    </Card>
  );
}
