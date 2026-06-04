"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { ArrowUpRight, Pencil, Plus, Search, Trash2, WalletCards, X } from "lucide-react";
import {
  calculateNetInvestmentAmount,
  calculateStampDuty,
  calculateUnits,
  formatCurrency,
} from "@/lib/analytics";
import type {
  InvestmentSearchResult,
  SerializedAsset,
  SipRow,
  TransactionRow,
  TransactionType,
} from "@/types/portfolio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15";

type SelectedAsset = InvestmentSearchResult & { id?: string };

export type PendingSipEntry = {
  sipId: string;
  asset: SerializedAsset;
  amount: number;
  tradeDate: string;
};

function fromSerialized(asset: SerializedAsset): SelectedAsset {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    symbol: asset.symbol ?? undefined,
    schemeCode: asset.schemeCode ?? undefined,
    exchange: asset.exchange ?? undefined,
    category: asset.category ?? undefined,
    amc: asset.amc ?? undefined,
  };
}

export function TransactionEntry({
  sips,
  pendingSipEntry,
  onPendingSipConsumed,
  onChanged,
  onOpenAsset,
}: {
  sips: SipRow[];
  pendingSipEntry: PendingSipEntry | null;
  onPendingSipConsumed: () => void;
  onChanged: () => Promise<void>;
  onOpenAsset: (assetId: string) => void;
}) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<InvestmentSearchResult[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
  const [type, setType] = useState<TransactionType>("BUY");
  const [amount, setAmount] = useState(50000);
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("");
  const [navOrPrice, setNavOrPrice] = useState<number | null>(null);
  const [linkedSipId, setLinkedSipId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const stampDuty = selectedAsset ? calculateStampDuty(amount, selectedAsset.type, type) : 0;
  const netInvestmentAmount = calculateNetInvestmentAmount(amount, stampDuty);
  const calculatedUnits =
    type === "SELL"
      ? Number(Number(quantity || 0).toFixed(3))
      : quantity.trim()
        ? Number(Number(quantity).toFixed(3))
        : navOrPrice
          ? calculateUnits(amount, navOrPrice, stampDuty, 3)
          : 0;
  const searchText = query.trim().toLowerCase();
  const matchingSips =
    searchText.length >= 2
      ? sips.filter((sip) => {
          return (
            sip.asset.name.toLowerCase().includes(searchText) ||
            sip.asset.schemeCode?.toLowerCase().includes(searchText)
          );
        })
      : [];
  const marketSuggestions = suggestions.filter((asset) => {
    return !matchingSips.some((sip) => {
      return (
        (asset.schemeCode && asset.schemeCode === sip.asset.schemeCode) ||
        (asset.symbol && asset.symbol === sip.asset.symbol)
      );
    });
  });

  async function loadTransactions() {
    const response = await fetch("/api/transactions", { cache: "no-store" });

    if (response.ok) {
      setTransactions(await response.json());
    }
  }

  useEffect(() => {
    void loadTransactions();
  }, []);

  useEffect(() => {
    if (pendingSipEntry) {
      setEditingTransaction(null);
      setSelectedAsset(fromSerialized(pendingSipEntry.asset));
      setQuery(pendingSipEntry.asset.name);
      setAmount(pendingSipEntry.amount);
      setTradeDate(pendingSipEntry.tradeDate);
      setType("SIP_INSTALLMENT");
      setQuantity("");
      setLinkedSipId(pendingSipEntry.sipId);
      onPendingSipConsumed();
    }
  }, [onPendingSipConsumed, pendingSipEntry]);

  useEffect(() => {
    const controller = new AbortController();

    async function search() {
      if (query.trim().length < 2 || selectedAsset?.name === query) {
        setSuggestions([]);
        return;
      }

      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });

      if (response.ok) {
        setSuggestions(await response.json());
      }
    }

    void search();
    return () => controller.abort();
  }, [query, selectedAsset?.name]);

  useEffect(() => {
    async function fetchPrice() {
      setNavOrPrice(null);
      setError("");

      if (!selectedAsset || !tradeDate) {
        return;
      }

      const params = new URLSearchParams({
        type: selectedAsset.type,
        date: tradeDate,
      });

      if (selectedAsset.schemeCode) {
        params.set("schemeCode", selectedAsset.schemeCode);
      }

      if (selectedAsset.symbol) {
        params.set("symbol", selectedAsset.symbol);
      }

      const response = await fetch(`/api/price?${params.toString()}`);
      const payload = await response.json();

      if (response.ok) {
        setNavOrPrice(payload.value);
      } else {
        setError(payload.error ?? "Price unavailable for this date.");
      }
    }

    void fetchPrice();
  }, [selectedAsset, tradeDate]);

  function selectAsset(asset: SelectedAsset, sipId?: string) {
    setSelectedAsset(asset);
    setQuery(asset.name);
    setLinkedSipId(sipId ?? null);
    setSuggestions([]);
  }

  function resetForm() {
    setEditingTransaction(null);
    setSelectedAsset(null);
    setQuery("");
    setType("BUY");
    setAmount(50000);
    setTradeDate(new Date().toISOString().slice(0, 10));
    setQuantity("");
    setNavOrPrice(null);
    setLinkedSipId(null);
    setSuggestions([]);
    setError("");
  }

  function startEdit(transaction: TransactionRow) {
    setEditingTransaction(transaction);
    setSelectedAsset(fromSerialized(transaction.asset));
    setQuery(transaction.asset.name);
    setType(transaction.type);
    setAmount(transaction.amount);
    setTradeDate(transaction.tradeDate);
    setQuantity(transaction.quantity.toFixed(3));
    setNavOrPrice(transaction.navOrPrice);
    setLinkedSipId(transaction.sipId ?? null);
    setSuggestions([]);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedAsset || !navOrPrice) {
      setError("Select an asset and wait for live NAV/price.");
      return;
    }

    setIsSaving(true);

    const response = await fetch("/api/transactions", {
      method: editingTransaction ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingTransaction?.id,
        asset: selectedAsset.id ? undefined : selectedAsset,
        assetId: selectedAsset.id,
        sipId: linkedSipId,
        type,
        amount,
        tradeDate,
        quantity: quantity.trim() ? Number(Number(quantity).toFixed(3)) : undefined,
        navOrPrice,
      }),
    });
    const payload = await response.json();
    setIsSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to save entry.");
      return;
    }

    resetForm();
    await loadTransactions();
    await onChanged();
  }

  async function handleDelete(transaction: TransactionRow) {
    const confirmed = window.confirm(`Delete this ${transaction.type.replace("_", " ").toLowerCase()} entry?`);

    if (!confirmed) {
      return;
    }

    setError("");
    const response = await fetch(`/api/transactions?id=${encodeURIComponent(transaction.id)}`, {
      method: "DELETE",
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete entry.");
      return;
    }

    if (editingTransaction?.id === transaction.id) {
      resetForm();
    }

    await loadTransactions();
    await onChanged();
  }

  function openTransactionFromKeyboard(event: KeyboardEvent<HTMLDivElement>, assetId: string) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onOpenAsset(assetId);
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[0.95fr_1.35fr]">
      <Card className="glass-panel animate-in">
        <CardHeader>
          <CardTitle>{editingTransaction ? "Edit Entry" : "Manual Entry"}</CardTitle>
          <CardDescription>Existing SIPs appear first, followed by live India-only market results</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {editingTransaction ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-50">
                <span>Editing saved transaction</span>
                <Button type="button" size="sm" variant="secondary" onClick={resetForm}>
                  <X className="h-4 w-4" aria-hidden />
                  Cancel
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="asset-search">Asset</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="asset-search"
                  className="pl-9"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedAsset(null);
                    setLinkedSipId(null);
                  }}
                  placeholder="Search Indian stock, ETF, or mutual fund"
                />
              </div>
              {matchingSips.length || marketSuggestions.length ? (
                <div className="overflow-hidden rounded-md border border-white/10 bg-[#0a0d12] shadow-2xl shadow-black/30">
                  {matchingSips.length ? (
                    <div className="border-b border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                      Existing SIPs
                    </div>
                  ) : null}
                  {matchingSips.map((sip) => (
                    <button
                      key={`sip-${sip.id}`}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-slate-300 transition hover:bg-cyan-300/[0.08]"
                      onClick={() => {
                        setEditingTransaction(null);
                        setType("SIP_INSTALLMENT");
                        setAmount(sip.amount);
                        selectAsset(fromSerialized(sip.asset), sip.id);
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-white">{sip.asset.name}</span>
                        <span className="text-xs text-slate-500">
                          {formatCurrency(sip.amount)} {sip.frequency.toLowerCase()}
                        </span>
                      </span>
                      <Badge>Existing SIP</Badge>
                    </button>
                  ))}
                  {marketSuggestions.length ? (
                    <div className="border-y border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Market results
                    </div>
                  ) : null}
                  {marketSuggestions.map((asset) => (
                    <button
                      key={asset.schemeCode ?? asset.symbol}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-slate-300 transition hover:bg-white/[0.06]"
                      onClick={() => selectAsset(asset)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-white">{asset.name}</span>
                        <span className="text-xs text-slate-500">{asset.symbol ?? asset.schemeCode}</span>
                      </span>
                      <Badge variant="muted">{asset.type}</Badge>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tx-type">Type</Label>
                <select
                  id="tx-type"
                  className={selectClass}
                  value={type}
                  onChange={(event) => setType(event.target.value as TransactionType)}
                >
                  <option value="BUY" className="bg-slate-950">Buy</option>
                  <option value="LUMPSUM" className="bg-slate-950">Lumpsum</option>
                  <option value="SIP_INSTALLMENT" className="bg-slate-950">SIP installment</option>
                  <option value="SELL" className="bg-slate-950">Sell</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tx-date">Trade date</Label>
                <Input
                  id="tx-date"
                  type="date"
                  value={tradeDate}
                  onChange={(event) => setTradeDate(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tx-amount">Amount</Label>
                <Input
                  id="tx-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  disabled={type === "SELL"}
                  onChange={(event) => setAmount(Number(event.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tx-quantity">Quantity</Label>
                <Input
                  id="tx-quantity"
                  type="number"
                  min={0}
                  step="0.001"
                  placeholder={type === "SELL" ? "Required" : "Auto"}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 rounded-lg border border-white/10 bg-black/[0.16] p-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-slate-500">NAV/price</p>
                <p className="font-semibold text-white">
                  {navOrPrice ? formatCurrency(navOrPrice) : "Loading"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Stamp duty</p>
                <p className="font-semibold text-white">{formatCurrency(stampDuty)}</p>
              </div>
              <div>
                <p className="text-slate-500">Net investment</p>
                <p className="font-semibold text-white">
                  {type === "SELL" ? "N/A" : formatCurrency(netInvestmentAmount)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Units</p>
                <p className="font-semibold text-white">{calculatedUnits.toFixed(3)}</p>
              </div>
            </div>
            {error ? <p className="text-sm text-rose-200">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isSaving}>
                {editingTransaction ? <Pencil className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                {isSaving ? "Saving" : editingTransaction ? "Save Entry" : "Add Entry"}
              </Button>
              {editingTransaction ? (
                <Button type="button" variant="secondary" onClick={resetForm}>
                  <X className="h-4 w-4" aria-hidden />
                  Cancel Edit
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="glass-panel animate-in">
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>{transactions.length} entries. Click any row for full asset history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {transactions.length ? (
            transactions.map((transaction) => (
              <div
                key={transaction.id}
                role="button"
                tabIndex={0}
                className="grid cursor-pointer gap-4 rounded-lg border border-white/10 bg-black/[0.16] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.06] lg:grid-cols-[1.35fr_0.72fr_0.72fr_auto]"
                onClick={() => onOpenAsset(transaction.asset.id)}
                onKeyDown={(event) => openTransactionFromKeyboard(event, transaction.asset.id)}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-sm font-semibold text-white">
                      {transaction.asset.name}
                    </h4>
                    <Badge variant="muted">{transaction.type}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{transaction.tradeDate}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Amount</p>
                  <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(transaction.amount)}</p>
                  <p className="text-xs text-slate-500">{transaction.quantity.toFixed(3)} units</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">NAV/price</p>
                  <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(transaction.navOrPrice)}</p>
                  <p className="text-xs text-slate-500">Stamp duty {formatCurrency(transaction.stampDuty)}</p>
                </div>
                <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    aria-label="Edit transaction"
                    onClick={(event) => {
                      event.stopPropagation();
                      startEdit(transaction);
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    aria-label="Delete transaction"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDelete(transaction);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Delete
                  </Button>
                  <span className="flex items-center gap-1 text-slate-500">
                    <WalletCards className="h-5 w-5" aria-hidden />
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
              Add real buy, sell, lumpsum, or SIP entries.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
