"use client";

import { FormEvent, useMemo, useState } from "react";
import { Edit3, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TablePagination, usePagination } from "@/components/ui/pagination";
import { formatCurrency } from "@/lib/analytics";
import type { NetWorthAssetRow, NetWorthAssetType } from "@/types/portfolio";

const assetTypes: Array<{ value: NetWorthAssetType; label: string }> = [
  { value: "BANK_ACCOUNT", label: "Bank account" },
  { value: "FIXED_DEPOSIT", label: "Fixed deposit" },
  { value: "EPF", label: "EPF" },
  { value: "GOLD", label: "Gold" },
  { value: "PPF", label: "PPF" },
  { value: "NPS", label: "NPS" },
  { value: "OTHER", label: "Other asset" },
];

const selectClass =
  "h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--foreground)] outline-none transition hover:border-[var(--line-strong)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--focus)]";

type AssetForm = {
  id?: string;
  name: string;
  type: NetWorthAssetType;
  institution: string;
  currentValue: string;
  investedAmount: string;
  accountReference: string;
  interestRate: string;
  maturityDate: string;
  quantity: string;
  unitPrice: string;
  notes: string;
  asOfDate: string;
};

function emptyForm(): AssetForm {
  return {
    name: "",
    type: "BANK_ACCOUNT",
    institution: "",
    currentValue: "",
    investedAmount: "",
    accountReference: "",
    interestRate: "",
    maturityDate: "",
    quantity: "",
    unitPrice: "",
    notes: "",
    asOfDate: new Date().toISOString().slice(0, 10),
  };
}

export function NetWorthAssets({
  assets,
  onChanged,
}: {
  assets: NetWorthAssetRow[];
  onChanged: () => Promise<void> | void;
}) {
  const [form, setForm] = useState<AssetForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NetWorthAssetRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const pagination = usePagination(assets);
  const totalValue = assets.reduce((sum, asset) => sum + asset.currentValue, 0);
  const groupedAssets = useMemo(() => {
    const groups = new Map<NetWorthAssetType, number>();

    for (const asset of assets) {
      groups.set(asset.type, (groups.get(asset.type) ?? 0) + asset.currentValue);
    }

    return assetTypes
      .map((type) => ({
        ...type,
        value: groups.get(type.value) ?? 0,
      }))
      .filter((type) => type.value > 0)
      .sort((left, right) => right.value - left.value);
  }, [assets]);

  function openCreate() {
    setError("");
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(asset: NetWorthAssetRow) {
    setError("");
    setForm({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      institution: asset.institution ?? "",
      currentValue: String(asset.currentValue),
      investedAmount: asset.investedAmount === null ? "" : String(asset.investedAmount),
      accountReference: asset.accountReference ?? "",
      interestRate: asset.interestRate === null ? "" : String(asset.interestRate),
      maturityDate: asset.maturityDate ?? "",
      quantity: asset.quantity === null ? "" : String(asset.quantity),
      unitPrice: asset.unitPrice === null ? "" : String(asset.unitPrice),
      notes: asset.notes ?? "",
      asOfDate: new Date().toISOString().slice(0, 10),
    });
    setFormOpen(true);
  }

  async function saveAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/net-worth-assets", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          name: form.name,
          type: form.type,
          institution: form.institution || null,
          currentValue: optionalNumber(form.currentValue),
          investedAmount: optionalNumber(form.investedAmount),
          accountReference: form.accountReference || null,
          interestRate: optionalNumber(form.interestRate),
          maturityDate: form.maturityDate || null,
          quantity: optionalNumber(form.quantity),
          unitPrice: optionalNumber(form.unitPrice),
          notes: form.notes || null,
          asOfDate: form.asOfDate,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save asset.");
      }

      setFormOpen(false);
      setForm(emptyForm());
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save asset.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteAsset() {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/net-worth-assets?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete asset.");
      }

      setDeleteTarget(null);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete asset.");
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="space-y-5">
      <Card className="glass-panel">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-2xl">Assets & accounts</CardTitle>
            <CardDescription>
              Track balances outside your market portfolio and keep dated snapshots for net-worth history.
            </CardDescription>
          </div>
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Add asset
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-soft)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Total tracked value
              </p>
              <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
                {formatCurrency(totalValue)}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {assets.length} {assets.length === 1 ? "asset" : "assets"} outside stocks, ETFs, and mutual funds
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groupedAssets.length ? (
                groupedAssets.map((group) => (
                  <div key={group.value + group.label} className="rounded-lg border border-[var(--line)] p-4">
                    <p className="text-sm text-[var(--muted)]">{group.label}</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                      {formatCurrency(group.value)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="col-span-full flex min-h-28 items-center justify-center rounded-lg border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--muted)]">
                  Add a bank balance, deposit, retirement account, gold holding, or another asset.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && !formOpen ? (
        <div className="rounded-lg border border-[var(--negative)]/30 bg-[var(--negative-soft)] p-4 text-sm text-[var(--negative)]">
          {error}
        </div>
      ) : null}

      <Card className="glass-panel overflow-hidden">
        <CardHeader>
          <CardTitle>Tracked assets</CardTitle>
          <CardDescription>Update an asset whenever its balance or valuation changes.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {assets.length ? (
            <>
              <div className="hidden grid-cols-[1.2fr_0.8fr_0.75fr_0.75fr_0.7fr_auto] gap-4 border-y border-[var(--line)] bg-[var(--panel-soft)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)] lg:grid">
                <span>Asset</span>
                <span>Type</span>
                <span className="text-right">Current value</span>
                <span className="text-right">Cost / contribution</span>
                <span>As of</span>
                <span className="text-right">Actions</span>
              </div>
              <div>
                {pagination.items.map((asset) => (
                  <div
                    key={asset.id}
                    className="grid gap-3 border-b border-[var(--line)] px-5 py-4 last:border-b-0 lg:grid-cols-[1.2fr_0.8fr_0.75fr_0.75fr_0.7fr_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">{asset.name}</p>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">
                        {asset.institution || asset.accountReference || "No institution specified"}
                      </p>
                    </div>
                    <p className="text-sm text-[var(--foreground)]">{assetTypeLabel(asset.type)}</p>
                    <p className="text-sm font-semibold text-[var(--foreground)] lg:text-right">
                      {formatCurrency(asset.currentValue)}
                    </p>
                    <p className="text-sm text-[var(--muted)] lg:text-right">
                      {asset.investedAmount === null ? "—" : formatCurrency(asset.investedAmount)}
                    </p>
                    <p className="text-sm text-[var(--muted)]">{asset.asOfDate}</p>
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" size="icon" variant="secondary" aria-label={`Edit ${asset.name}`} onClick={() => openEdit(asset)}>
                        <Edit3 className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button type="button" size="icon" variant="danger" aria-label={`Delete ${asset.name}`} onClick={() => setDeleteTarget(asset)}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <TablePagination
                {...pagination}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
              />
            </>
          ) : (
            <div className="m-5 rounded-lg border border-dashed border-[var(--line)] bg-[var(--panel-soft)] p-10 text-center">
              <p className="text-sm text-[var(--muted)]">No non-market assets are tracked yet.</p>
              <Button type="button" className="mt-4" onClick={openCreate}>
                Add first asset
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {formOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm animate-fade" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Close asset form" onClick={() => setFormOpen(false)} />
          <form
            className="modal-panel relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl"
            onSubmit={saveAsset}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--line)] bg-[var(--panel)] px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">
                  {form.id ? "Update asset" : "Add asset"}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  The value is saved as a dated snapshot for the net-worth graph.
                </p>
              </div>
              <Button type="button" size="icon" variant="secondary" aria-label="Close asset form" onClick={() => setFormOpen(false)}>
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <Field label="Asset type" htmlFor="asset-type">
                <select
                  id="asset-type"
                  className={selectClass}
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as NetWorthAssetType }))}
                >
                  {assetTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Name" htmlFor="asset-name">
                <Input
                  id="asset-name"
                  value={form.name}
                  placeholder={namePlaceholder(form.type)}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </Field>
              <Field label="Institution" htmlFor="asset-institution">
                <Input
                  id="asset-institution"
                  value={form.institution}
                  placeholder="Bank, employer, provider, or issuer"
                  onChange={(event) => setForm((current) => ({ ...current, institution: event.target.value }))}
                />
              </Field>
              <Field label="Account reference" htmlFor="asset-reference">
                <Input
                  id="asset-reference"
                  value={form.accountReference}
                  placeholder="Optional masked account or folio"
                  onChange={(event) => setForm((current) => ({ ...current, accountReference: event.target.value }))}
                />
              </Field>
              <Field label="Current value" htmlFor="asset-current-value" hint={form.type === "GOLD" ? "Optional when quantity and unit price are entered" : undefined}>
                <Input
                  id="asset-current-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.currentValue}
                  onChange={(event) => setForm((current) => ({ ...current, currentValue: event.target.value }))}
                  required={form.type !== "GOLD" || !form.quantity || !form.unitPrice}
                />
              </Field>
              {form.type !== "BANK_ACCOUNT" ? (
                <Field label={costLabel(form.type)} htmlFor="asset-invested">
                  <Input
                    id="asset-invested"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.investedAmount}
                    onChange={(event) => setForm((current) => ({ ...current, investedAmount: event.target.value }))}
                  />
                </Field>
              ) : null}
              {form.type === "GOLD" ? (
                <>
                  <Field label="Quantity" htmlFor="asset-quantity">
                    <Input
                      id="asset-quantity"
                      type="number"
                      min="0"
                      step="0.000001"
                      value={form.quantity}
                      onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                    />
                  </Field>
                  <Field label="Price per unit" htmlFor="asset-unit-price">
                    <Input
                      id="asset-unit-price"
                      type="number"
                      min="0"
                      step="0.000001"
                      value={form.unitPrice}
                      onChange={(event) => setForm((current) => ({ ...current, unitPrice: event.target.value }))}
                    />
                  </Field>
                </>
              ) : null}
              {form.type === "FIXED_DEPOSIT" ? (
                <>
                  <Field label="Interest rate" htmlFor="asset-interest-rate">
                    <Input
                      id="asset-interest-rate"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={form.interestRate}
                      onChange={(event) => setForm((current) => ({ ...current, interestRate: event.target.value }))}
                    />
                  </Field>
                  <Field label="Maturity date" htmlFor="asset-maturity-date">
                    <Input
                      id="asset-maturity-date"
                      type="date"
                      value={form.maturityDate}
                      onChange={(event) => setForm((current) => ({ ...current, maturityDate: event.target.value }))}
                    />
                  </Field>
                </>
              ) : null}
              <Field label="Value as of" htmlFor="asset-as-of-date">
                <Input
                  id="asset-as-of-date"
                  type="date"
                  value={form.asOfDate}
                  onChange={(event) => setForm((current) => ({ ...current, asOfDate: event.target.value }))}
                  required
                />
              </Field>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="asset-notes">Notes</Label>
                <textarea
                  id="asset-notes"
                  className="min-h-24 w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] hover:border-[var(--line-strong)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--focus)]"
                  value={form.notes}
                  placeholder="Optional context about this asset"
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </div>
              {error ? (
                <div className="rounded-lg border border-[var(--negative)]/30 bg-[var(--negative-soft)] p-3 text-sm text-[var(--negative)] sm:col-span-2">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--panel)] px-6 py-4">
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving" : form.id ? "Update asset" : "Add asset"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete tracked asset?"
        description={deleteTarget ? `${deleteTarget.name} and its saved value history will be removed.` : undefined}
        confirmLabel="Delete asset"
        tone="danger"
        isBusy={isDeleting}
        onConfirm={() => void deleteAsset()}
        onClose={() => setDeleteTarget(null)}
      />
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

function optionalNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function assetTypeLabel(type: NetWorthAssetType) {
  return assetTypes.find((option) => option.value === type)?.label ?? "Other asset";
}

function namePlaceholder(type: NetWorthAssetType) {
  const placeholders: Record<NetWorthAssetType, string> = {
    BANK_ACCOUNT: "Salary account",
    FIXED_DEPOSIT: "12-month fixed deposit",
    EPF: "Employee provident fund",
    GOLD: "Physical gold",
    PPF: "Public provident fund",
    NPS: "National Pension System",
    OTHER: "Property, cash, or another asset",
  };

  return placeholders[type];
}

function costLabel(type: NetWorthAssetType) {
  if (type === "FIXED_DEPOSIT") {
    return "Principal";
  }

  if (type === "EPF" || type === "PPF" || type === "NPS") {
    return "Total contributions";
  }

  return "Cost / invested amount";
}
