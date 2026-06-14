"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowUpRight, FileSpreadsheet, Trash2, Upload, WalletCards } from "lucide-react";
import { formatCurrency, formatNav } from "@/lib/analytics";
import { assetTypeLabel, transactionTypeLabel } from "@/lib/labels";
import type { PortfolioDashboard, TransactionRow } from "@/types/portfolio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";

type ImportSummary = {
  parsed: number;
  imported: number;
  skipped: number;
  failed: number;
  taggedSipTransactions: number;
  sipSuggestions?: ImportSipSuggestion[];
};

type ImportSipSuggestion = {
  assetId: string;
  assetName: string;
  amount: number;
  importedAmount: number;
  referenceMonth: string;
  action: "CREATE" | "UPDATE" | "LINK";
  existingAmount: number | null;
  totalAvailableTransactions: number;
  referenceTransactions: Array<{
    id: string;
    date: string;
    amount: number;
    units: number;
  }>;
};

export function TransactionEntry({
  dashboard,
  onChanged,
  onOpenAsset,
}: {
  dashboard: PortfolioDashboard | null;
  onChanged: () => Promise<void>;
  onOpenAsset: (assetId: string) => void;
}) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isConvertingSip, setIsConvertingSip] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [sipSuggestions, setSipSuggestions] = useState<ImportSipSuggestion[]>([]);
  const [selectedSipAssetIds, setSelectedSipAssetIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<TransactionRow | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function loadTransactions() {
    const response = await fetch("/api/transactions", { cache: "no-store" });

    if (response.ok) {
      setTransactions(await response.json());
    }
  }

  useEffect(() => {
    void loadTransactions();
  }, []);

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) {
      return;
    }

    setError("");
    setImportSummary(null);
    setIsImporting(true);

    const body = new FormData();
    files.forEach((file) => body.append("files", file));

    try {
      const response = await fetch("/api/imports/trades", {
        method: "POST",
        body,
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Unable to import trades.");
        return;
      }

      setImportSummary(payload);
      const suggestions = (payload.sipSuggestions ?? []) as ImportSipSuggestion[];
      setSipSuggestions(suggestions);
      setSelectedSipAssetIds(suggestions.map((suggestion) => suggestion.assetId));
      await loadTransactions();
      await onChanged();
    } catch {
      setError("Unable to import trades.");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    const response = await fetch(`/api/transactions?id=${encodeURIComponent(deleteTarget.id)}`, {
      method: "DELETE",
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete transaction.");
      return;
    }

    setDeleteTarget(null);
    await loadTransactions();
    await onChanged();
  }

  async function confirmSelectedSipSuggestions() {
    const selectedSuggestions = sipSuggestions.filter((suggestion) =>
      selectedSipAssetIds.includes(suggestion.assetId),
    );

    if (!selectedSuggestions.length) {
      return;
    }

    setIsConvertingSip(true);
    setError("");

    const response = await fetch("/api/imports/sip-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suggestions: selectedSuggestions.map(({ assetId, amount }) => ({ assetId, amount })),
      }),
    });
    const payload = await response.json();
    setIsConvertingSip(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to create SIP from imported transactions.");
      return;
    }

    setSipSuggestions([]);
    setSelectedSipAssetIds([]);
    setImportSummary((current) =>
      current
        ? {
            ...current,
            taggedSipTransactions: current.taggedSipTransactions + payload.converted,
          }
        : current,
    );
    await loadTransactions();
    await onChanged();
  }

  function toggleSipSuggestion(assetId: string) {
    setSelectedSipAssetIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId],
    );
  }

  function toggleAllSipSuggestions() {
    setSelectedSipAssetIds((current) =>
      current.length === sipSuggestions.length
        ? []
        : sipSuggestions.map((suggestion) => suggestion.assetId),
    );
  }

  function updateSipSuggestionAmount(assetId: string, amount: number) {
    setSipSuggestions((current) =>
      current.map((suggestion) =>
        suggestion.assetId === assetId
          ? { ...suggestion, amount: Number.isFinite(amount) ? Math.max(amount, 0) : 0 }
          : suggestion,
      ),
    );
  }

  function closeSipSuggestions() {
    setSipSuggestions([]);
    setSelectedSipAssetIds([]);
  }

  function openTransactionFromKeyboard(event: KeyboardEvent<HTMLDivElement>, assetId: string) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onOpenAsset(assetId);
  }

  return (
    <section className="space-y-5">
      <Card className="glass-panel animate-in">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              {transactions.length} saved transactions. Import Groww/Zerodha Excel files without duplicating rows.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              className="hidden"
              type="file"
              accept=".xlsx"
              multiple
              onChange={handleImport}
            />
            <Button type="button" onClick={() => inputRef.current?.click()} disabled={isImporting}>
              <Upload className="h-4 w-4" aria-hidden />
              {isImporting ? "Importing" : "Import Excel"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          {importSummary ? (
            <div className="grid gap-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-50 sm:grid-cols-5">
              <span>Parsed {importSummary.parsed}</span>
              <span>Added {importSummary.imported}</span>
              <span>Skipped {importSummary.skipped}</span>
              <span>Failed {importSummary.failed}</span>
              <span>Tagged SIP {importSummary.taggedSipTransactions}</span>
            </div>
          ) : null}
          {transactions.length ? (
            <div className="overflow-hidden rounded-lg border border-white/10 bg-black/[0.12]">
              <div className="hidden grid-cols-[0.7fr_minmax(0,1.5fr)_0.65fr_0.65fr_0.7fr_0.8fr_0.8fr_0.8fr_5rem] border-b border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 xl:grid">
                <span>Date</span>
                <span>Investment</span>
                <span>Type</span>
                <span className="text-right">Units</span>
                <span className="text-right">NAV</span>
                <span className="text-right">Invested amount</span>
                <span className="text-right">Current amount</span>
                <span className="text-right">Profit / loss</span>
                <span className="text-right">Actions</span>
              </div>
              {transactions.map((transaction) => {
                const holding = dashboard?.holdings.find((item) => item.assetId === transaction.asset.id);
                const isSell = transaction.type === "SELL";
                const currentAmount =
                  isSell || !holding
                    ? null
                    : transaction.quantity * (holding.currentPrice ?? transaction.navOrPrice);
                const profitLoss = currentAmount === null ? null : currentAmount - transaction.amount;

                return (
                  <div
                    key={transaction.id}
                    role="button"
                    tabIndex={0}
                    className="grid cursor-pointer gap-3 border-b border-white/10 px-4 py-3 text-left transition duration-200 last:border-b-0 hover:bg-white/[0.06] xl:grid-cols-[0.7fr_minmax(0,1.5fr)_0.65fr_0.65fr_0.7fr_0.8fr_0.8fr_0.8fr_5rem] xl:items-center"
                    onClick={() => onOpenAsset(transaction.asset.id)}
                    onKeyDown={(event) => openTransactionFromKeyboard(event, transaction.asset.id)}
                  >
                  <p className="text-sm font-semibold text-white">{transaction.tradeDate}</p>
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold text-white">{transaction.asset.name}</h4>
                    <p className="mt-1 text-xs text-slate-500">{assetTypeLabel(transaction.asset.type)}</p>
                  </div>
                  <div>
                    <Badge variant="muted">
                      {transactionTypeLabel(transaction.type, transaction.asset.type)}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-white xl:text-right">{transaction.quantity.toFixed(3)}</p>
                  <p className="text-sm font-semibold text-white xl:text-right">{formatNav(transaction.navOrPrice)}</p>
                  <div className="xl:text-right">
                    <p className="text-sm font-semibold text-white">{formatCurrency(transaction.amount)}</p>
                  </div>
                  <p className="text-sm font-semibold text-white xl:text-right">
                    {currentAmount === null ? "-" : formatCurrency(currentAmount)}
                  </p>
                  <p className={`text-sm font-semibold xl:text-right ${profitLoss === null ? "text-slate-500" : profitLoss >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {profitLoss === null ? "-" : `${profitLoss >= 0 ? "+" : ""}${formatCurrency(profitLoss)}`}
                  </p>
                  <div className="flex items-center gap-2 xl:justify-end">
                    <Button
                      type="button"
                      size="icon"
                      variant="danger"
                      aria-label="Delete transaction"
                      title="Delete transaction"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(transaction);
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                    <span className="hidden items-center gap-1 text-slate-500 xl:flex">
                      <WalletCards className="h-5 w-5" aria-hidden />
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
              <FileSpreadsheet className="mx-auto mb-3 h-7 w-7 text-slate-500" aria-hidden />
              Import an Excel tradebook or add investments from Search.
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete transaction?"
        description={
          deleteTarget
            ? `This removes the ${transactionTypeLabel(deleteTarget.type, deleteTarget.asset.type).toLowerCase()} entry for ${deleteTarget.asset.name}.`
            : undefined
        }
        confirmLabel="Delete"
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
      <ConfirmDialog
        open={sipSuggestions.length > 0}
        title="Review identified SIPs"
        description="Select the detected monthly investments to create, update, or link as SIPs. SIP debit amounts are inferred after 0.005% stamp duty."
        confirmLabel={`Apply selected (${selectedSipAssetIds.length})`}
        cancelLabel="Keep all as lumpsum"
        size="large"
        isBusy={isConvertingSip}
        confirmDisabled={!selectedSipAssetIds.length}
        onClose={closeSipSuggestions}
        onConfirm={() => void confirmSelectedSipSuggestions()}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              All available buy transactions for each selected fund will be marked as SIP.
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-white">
              <input
                type="checkbox"
                checked={selectedSipAssetIds.length === sipSuggestions.length}
                onChange={toggleAllSipSuggestions}
              />
              Select all
            </label>
          </div>
          <div className="overflow-x-auto rounded-md border border-white/10">
            <div className="min-w-[1040px]">
              <div className="grid grid-cols-[2.5rem_minmax(320px,2fr)_6rem_8rem_9rem_10rem_6rem] items-center gap-3 bg-white/[0.05] px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                <span />
                <span>Fund</span>
                <span>Action</span>
                <span>Reference</span>
                <span className="text-right">Allocated value</span>
                <span className="text-right">SIP debit (editable)</span>
                <span className="text-right">Transactions</span>
              </div>
              {sipSuggestions.map((suggestion) => (
                <div
                  key={suggestion.assetId}
                  className="grid grid-cols-[2.5rem_minmax(320px,2fr)_6rem_8rem_9rem_10rem_6rem] items-center gap-3 border-t border-white/10 px-3 py-3 hover:bg-white/[0.04]"
                >
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={selectedSipAssetIds.includes(suggestion.assetId)}
                    onChange={() => toggleSipSuggestion(suggestion.assetId)}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{suggestion.assetName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {suggestion.referenceTransactions.length} transactions in latest month
                    </p>
                  </div>
                  <Badge
                    className="w-fit justify-self-start whitespace-nowrap"
                    variant={suggestion.action === "CREATE" ? "default" : "muted"}
                  >
                    {suggestion.action === "CREATE"
                      ? "Create"
                      : suggestion.action === "UPDATE"
                        ? "Update"
                        : "Link"}
                  </Badge>
                  <span className="whitespace-nowrap text-slate-300">{suggestion.referenceMonth}</span>
                  <span className="whitespace-nowrap text-right text-slate-300">
                    {formatCurrency(suggestion.importedAmount, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={suggestion.amount}
                    className="h-9 text-right font-semibold"
                    aria-label={`SIP debit for ${suggestion.assetName}`}
                    onChange={(event) =>
                      updateSipSuggestionAmount(suggestion.assetId, Number(event.target.value))
                    }
                  />
                  <span className="text-right font-semibold text-white">
                    {suggestion.totalAvailableTransactions}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </section>
  );
}
