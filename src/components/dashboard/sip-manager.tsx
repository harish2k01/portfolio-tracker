"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bell, CalendarDays, Pause, Play, Plus, Search, Trash2 } from "lucide-react";
import { formatCurrency, monthlyEquivalent } from "@/lib/analytics";
import type { DueSip, InvestmentSearchResult, SipFrequency, SipRow } from "@/types/portfolio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PendingSipEntry } from "@/components/dashboard/transaction-entry";

const selectClass =
  "h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15";

export function SipManager({
  sips,
  dueSips,
  onChanged,
  onCreateEntry,
  onOpenSip,
}: {
  sips: SipRow[];
  dueSips: DueSip[];
  onChanged: () => Promise<void>;
  onCreateEntry: (entry: PendingSipEntry) => void;
  onOpenSip: (sipId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<InvestmentSearchResult[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<InvestmentSearchResult | null>(null);
  const [amount, setAmount] = useState(10000);
  const [frequency, setFrequency] = useState<SipFrequency>("MONTHLY");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const activeMonthlySip = sips
    .filter((sip) => sip.status === "ACTIVE")
    .reduce((sum, sip) => sum + monthlyEquivalent(sip.amount, sip.frequency), 0);

  useEffect(() => {
    const controller = new AbortController();

    async function search() {
      if (query.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });

      if (response.ok) {
        const data = (await response.json()) as InvestmentSearchResult[];
        setSuggestions(data.filter((asset) => asset.type === "MUTUAL_FUND"));
      }
    }

    void search();
    return () => controller.abort();
  }, [query]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedAsset) {
      setError("Select a mutual fund from live search results.");
      return;
    }

    const response = await fetch("/api/sips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset: selectedAsset, amount, frequency, startDate }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to save SIP.");
      return;
    }

    setQuery("");
    setSelectedAsset(null);
    setAmount(10000);
    await onChanged();
  }

  async function updateSip(id: string, status: "ACTIVE" | "PAUSED") {
    await fetch("/api/sips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await onChanged();
  }

  async function deleteSip(id: string) {
    await fetch(`/api/sips?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await onChanged();
  }

  async function dismissDue(sip: DueSip) {
    await fetch("/api/sips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sip.id, dismissedDueDate: sip.dueDate }),
    });
    await onChanged();
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
      <div className="space-y-5">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Add SIP</CardTitle>
            <CardDescription>{formatCurrency(activeMonthlySip)} active monthly run-rate</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="sip-search">Mutual fund</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input
                    id="sip-search"
                    className="pl-9"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setSelectedAsset(null);
                    }}
                    placeholder="Search any Indian mutual fund"
                  />
                </div>
                {suggestions.length ? (
                  <div className="overflow-hidden rounded-md border border-white/10 bg-black/20">
                    {suggestions.map((asset) => (
                      <button
                        key={asset.schemeCode}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/[0.06]"
                        onClick={() => {
                          setSelectedAsset(asset);
                          setQuery(asset.name);
                          setSuggestions([]);
                        }}
                      >
                        <span className="block truncate text-white">{asset.name}</span>
                        <span className="text-xs text-slate-500">{asset.schemeCode}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sip-amount">SIP amount</Label>
                  <Input
                    id="sip-amount"
                    type="number"
                    min={100}
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(Number(event.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sip-frequency">Frequency</Label>
                  <select
                    id="sip-frequency"
                    className={selectClass}
                    value={frequency}
                    onChange={(event) => setFrequency(event.target.value as SipFrequency)}
                  >
                    <option value="WEEKLY" className="bg-slate-950">
                      Weekly
                    </option>
                    <option value="MONTHLY" className="bg-slate-950">
                      Monthly
                    </option>
                    <option value="QUARTERLY" className="bg-slate-950">
                      Quarterly
                    </option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sip-start">Start date</Label>
                <Input
                  id="sip-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-rose-200">{error}</p> : null}
              <Button type="submit">
                <Plus className="h-4 w-4" aria-hidden />
                Add SIP
              </Button>
            </form>
          </CardContent>
        </Card>

        {dueSips.length ? (
          <Card className="border-amber-300/20 bg-amber-300/10">
            <CardHeader>
              <CardTitle>Due SIPs</CardTitle>
              <CardDescription>Create manual entries for due installments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dueSips.map((sip) => (
                <div key={sip.id} className="rounded-lg border border-amber-300/20 bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{sip.asset.name}</p>
                      <p className="text-xs text-amber-100">Due {sip.dueDate}</p>
                    </div>
                    <Bell className="h-4 w-4 text-amber-200" aria-hidden />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        onCreateEntry({
                          sipId: sip.id,
                          asset: sip.asset,
                          amount: sip.amount,
                          tradeDate: sip.dueDate,
                        })
                      }
                    >
                      Create Entry
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => dismissDue(sip)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>SIP Mandates</CardTitle>
          <CardDescription>{sips.length} recurring investments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sips.length ? (
            sips.map((sip) => (
              <div
                key={sip.id}
                role="button"
                tabIndex={0}
                className="grid w-full cursor-pointer gap-4 rounded-lg border border-white/10 bg-black/[0.16] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.06] lg:grid-cols-[1.4fr_0.8fr_0.8fr_auto]"
                onClick={() => onOpenSip(sip.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenSip(sip.id);
                  }
                }}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-sm font-semibold text-white">{sip.asset.name}</h4>
                    <Badge variant={sip.status === "ACTIVE" ? "success" : "warning"}>
                      {sip.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                    <CalendarDays className="h-4 w-4" aria-hidden />
                    <span>Started {sip.startDate}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Amount</p>
                  <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(sip.amount)}</p>
                  <p className="text-xs text-slate-500">{sip.frequency}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Next due</p>
                  <p className="mt-2 text-sm font-semibold text-white">{sip.nextDueDate ?? "NA"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    aria-label={sip.status === "ACTIVE" ? "Pause SIP" : "Resume SIP"}
                    title={sip.status === "ACTIVE" ? "Pause SIP" : "Resume SIP"}
                    onClick={(event) => {
                      event.stopPropagation();
                      void updateSip(sip.id, sip.status === "ACTIVE" ? "PAUSED" : "ACTIVE");
                    }}
                  >
                    {sip.status === "ACTIVE" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="danger"
                    aria-label="Delete SIP"
                    title="Delete SIP"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteSip(sip.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
              Add a mutual fund SIP from live search.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
