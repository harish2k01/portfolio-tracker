"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type WatchlistItem = {
  id: string;
  asset: {
    name: string;
    type: string;
    symbol: string | null;
    schemeCode: string | null;
  };
  aboveThreshold: number | null;
  belowThreshold: number | null;
  latestValue: number | null;
  changePercent: number | null;
  alert: boolean;
};

export function WatchlistPanel({ onChanged }: { onChanged: () => Promise<void> }) {
  const [items, setItems] = useState<WatchlistItem[]>([]);

  async function load() {
    const response = await fetch("/api/watchlist", { cache: "no-store" });

    if (response.ok) {
      setItems(await response.json());
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string) {
    await fetch(`/api/watchlist?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
    await onChanged();
  }

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle>Watchlist Alerts</CardTitle>
        <CardDescription>Add investments from Search, then track live levels here</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.id}
              className="grid gap-4 rounded-lg border border-white/10 bg-black/[0.16] p-4 md:grid-cols-[1fr_auto_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-white">{item.asset.name}</p>
                  <Badge variant={item.alert ? "warning" : "muted"}>
                    {item.asset.type}
                  </Badge>
                  {item.alert ? <AlertTriangle className="h-4 w-4 text-amber-200" /> : null}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {item.asset.symbol ?? item.asset.schemeCode}
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-sm font-semibold text-white">
                  {item.latestValue ? formatCurrency(item.latestValue) : "Unavailable"}
                </p>
                <p className={item.changePercent && item.changePercent >= 0 ? "text-xs text-emerald-300" : "text-xs text-rose-300"}>
                  {item.changePercent !== null ? `${item.changePercent >= 0 ? "+" : ""}${item.changePercent.toFixed(2)}%` : "No change"}
                </p>
              </div>
              <Button type="button" size="icon" variant="danger" onClick={() => remove(item.id)} aria-label="Remove watchlist item">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
            No watchlist items. Add them from Search.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
