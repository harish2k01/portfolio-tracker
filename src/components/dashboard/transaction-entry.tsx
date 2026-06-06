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
      setSipSuggestions(payload.sipSuggestions ?? []);
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

  async function confirmSipSuggestion(suggestion: ImportSipSuggestion) {
    setIsConvertingSip(true);
    setError("");

    const response = await fetch("/api/imports/sip-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(suggestion),
    });
    const payload = await response.json();
    setIsConvertingSip(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to create SIP from imported transactions.");
      return;
    }

    setSipSuggestions((current) => current.filter((item) => item.assetId !== suggestion.assetId));
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
          {dashboard ? (
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryMetric label="Invested amount" value={formatCurrency(dashboard.summary.investedAmount)} />
              <SummaryMetric label="Current amount" value={formatCurrency(dashboard.summary.totalValue)} />
              <SummaryMetric
                label="Profit / loss"
                value={`${dashboard.summary.gains >= 0 ? "+" : ""}${formatCurrency(dashboard.summary.gains)}`}
                tone={dashboard.summary.gains >= 0 ? "positive" : "negative"}
              />
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
        open={Boolean(sipSuggestions[0])}
        title={sipSuggestions[0]?.action === "UPDATE" ? "Update SIP from import?" : sipSuggestions[0]?.action === "LINK" ? "Link imported transactions?" : "Create SIP from import?"}
        description={
          sipSuggestions[0]
            ? `${sipSuggestionActionText(sipSuggestions[0])} using ${sipSuggestions[0].referenceMonth} as the latest reference month.`
            : undefined
        }
        confirmLabel={sipSuggestions[0]?.action === "UPDATE" ? "Update SIP" : sipSuggestions[0]?.action === "LINK" ? "Link to SIP" : "Create SIP"}
        cancelLabel="Keep as lumpsum"
        size="large"
        isBusy={isConvertingSip}
        onClose={() => setSipSuggestions((current) => current.slice(1))}
        onConfirm={() => {
          const suggestion = sipSuggestions[0];

          if (suggestion) {
            void confirmSipSuggestion(suggestion);
          }
        }}
      >
        {sipSuggestions[0] ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{sipSuggestions[0].assetName}</p>
                <p className="mt-1 text-xs text-slate-400">
                  All {sipSuggestions[0].totalAvailableTransactions} available buy transactions for this fund will be marked as SIP.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Latest monthly amount</p>
                <p className="mt-1 text-lg font-semibold text-amber-200">{formatCurrency(sipSuggestions[0].amount)}</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-md border border-white/10">
              <div className="grid grid-cols-3 bg-white/[0.05] px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                <span>Date</span>
                <span className="text-right">Units</span>
                <span className="text-right">Amount</span>
              </div>
              {sipSuggestions[0].referenceTransactions.map((transaction) => (
                <div key={transaction.id} className="grid grid-cols-3 border-t border-white/10 px-3 py-2">
                  <span>{transaction.date}</span>
                  <span className="text-right">{transaction.units.toFixed(3)}</span>
                  <span className="text-right font-semibold text-white">{formatCurrency(transaction.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}

function sipSuggestionActionText(suggestion: ImportSipSuggestion) {
  if (suggestion.action === "UPDATE") {
    return `The latest imported month totals ${formatCurrency(suggestion.amount)}, instead of the current SIP amount of ${formatCurrency(suggestion.existingAmount ?? 0)}.`;
  }

  if (suggestion.action === "LINK") {
    return `New transactions match the existing ${formatCurrency(suggestion.amount)} SIP.`;
  }

  return `The latest imported month totals ${formatCurrency(suggestion.amount)} and can be tracked as a SIP.`;
}

function SummaryMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-rose-300" : "text-white";

  return (
    <div className="rounded-lg border border-white/10 bg-black/[0.12] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
