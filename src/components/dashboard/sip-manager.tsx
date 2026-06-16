"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { CalendarDays, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatCurrency, monthlyEquivalent } from "@/lib/analytics";
import { aggregateWeightedAllocation } from "@/lib/allocation-metadata";
import type { SipFrequency, SipRow, SipStatus } from "@/types/portfolio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TablePagination, usePagination } from "@/components/ui/pagination";

const colors = ["#1277d3", "#536dfe", "#f0a62a", "#20a4c8", "#7c8fa6", "#8b6f47"];
const marketCapColors = ["#5b4bda", "#1277d3", "#20a4c8", "#f0a62a"];
const selectClass =
  "h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--foreground)] outline-none transition hover:border-[var(--line-strong)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--focus)]";

export function SipManager({
  sips,
  onChanged,
  onOpenSip,
}: {
  sips: SipRow[];
  onChanged: () => Promise<void>;
  onOpenSip: (sipId: string) => void;
}) {
  const [editingSip, setEditingSip] = useState<SipRow | null>(null);
  const [amount, setAmount] = useState(0);
  const [frequency, setFrequency] = useState<SipFrequency>("MONTHLY");
  const [startDate, setStartDate] = useState("");
  const [status, setStatus] = useState<SipStatus>("ACTIVE");
  const [deleteTarget, setDeleteTarget] = useState<SipRow | null>(null);
  const [activeChartId, setActiveChartId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const activeSips = useMemo(() => sips.filter((sip) => sip.status === "ACTIVE"), [sips]);
  const chartData = useMemo(
    () =>
      activeSips.map((sip) => ({
        id: sip.id,
        name: compactFundName(sip.asset.name),
        amount: monthlyEquivalent(sip.amount, sip.frequency),
      })),
    [activeSips],
  );
  const marketCapData = useMemo(
    () =>
      aggregateWeightedAllocation(
        activeSips.map((sip) => ({
          amount: monthlyEquivalent(sip.amount, sip.frequency),
          allocation: sip.asset.marketCapAllocation?.map((point) => ({
            name: normalizeMarketCapName(point.name),
            value: point.value,
          })),
        })),
      ),
    [activeSips],
  );
  const totalMonthly = chartData.reduce((sum, item) => sum + item.amount, 0);
  const sipPagination = usePagination(sips);

  async function updateSip(id: string, nextStatus: SipStatus) {
    await fetch("/api/sips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: nextStatus }),
    });
    await onChanged();
  }

  async function deleteSip() {
    if (!deleteTarget) {
      return;
    }

    await fetch(`/api/sips?id=${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
    setDeleteTarget(null);
    await onChanged();
  }

  function openEdit(sip: SipRow) {
    setEditingSip(sip);
    setAmount(sip.amount);
    setFrequency(sip.frequency);
    setStartDate(sip.startDate);
    setStatus(sip.status);
    setError("");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingSip) {
      return;
    }

    setError("");
    const response = await fetch("/api/sips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingSip.id,
        amount,
        frequency,
        startDate,
        status,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to update SIP.");
      return;
    }

    setEditingSip(null);
    await onChanged();
  }

  function openSipFromKeyboard(event: KeyboardEvent<HTMLDivElement>, sipId: string) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onOpenSip(sipId);
  }

  return (
    <section className="space-y-5">
      <Card className="glass-panel overflow-hidden">
        <CardHeader>
          <CardTitle>Current SIP Portfolio</CardTitle>
          <CardDescription>Total SIP: {formatCurrency(totalMonthly)} / month</CardDescription>
        </CardHeader>
        <CardContent>
          {activeSips.length ? (
            <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(420px,1.1fr)]">
              <div className="flex min-h-[520px] items-center justify-center overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-5">
                <div className="relative h-[390px] w-full max-w-[430px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="amount"
                        nameKey="name"
                        innerRadius="58%"
                        outerRadius="82%"
                        paddingAngle={chartData.length > 1 ? 3 : 0}
                        cornerRadius={chartData.length > 1 ? 8 : 0}
                        stroke="#101827"
                        strokeWidth={4}
                        onMouseEnter={(_, index) => setActiveChartId(chartData[index]?.id ?? null)}
                        onMouseLeave={() => setActiveChartId(null)}
                      >
                        {chartData.map((item, index) => (
                          <Cell
                            key={item.id}
                            fill={colors[index % colors.length]}
                            opacity={!activeChartId || activeChartId === item.id ? 1 : 0.18}
                            className="cursor-pointer transition-opacity"
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Monthly</p>
                      <p className="text-xl font-semibold text-[var(--foreground)]">{formatCurrency(totalMonthly)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex min-h-[520px] flex-col rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">Allocation</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{chartData.length} active SIPs</p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{formatCurrency(totalMonthly)} / month</p>
                </div>
                <div className="mt-5 grid flex-1 content-center gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {chartData.map((item, index) => {
                    const percentage = totalMonthly ? (item.amount / totalMonthly) * 100 : 0;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          "cursor-pointer space-y-2 rounded-lg border border-transparent p-3 text-left transition hover:border-[var(--line)] hover:bg-[var(--row-hover)]",
                          activeChartId === item.id
                            ? "border-[var(--line)] bg-[var(--panel)]"
                            : activeChartId
                              ? "opacity-35"
                              : "",
                        )}
                        onClick={() => onOpenSip(item.id)}
                        onMouseEnter={() => setActiveChartId(item.id)}
                        onMouseLeave={() => setActiveChartId(null)}
                      >
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate font-semibold text-[var(--foreground)]">{item.name}</span>
                          <span className="shrink-0 font-semibold text-[var(--foreground)]">{percentage.toFixed(0)}%</span>
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          <span>{formatCurrency(item.amount)} monthly</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]">
                          <span
                            className="block h-full"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: colors[index % colors.length],
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-5 xl:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">Market cap split</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">Weighted by active SIP monthly amount</p>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    {marketCapData.length ? `${marketCapData.length} groups` : "Unavailable"}
                  </p>
                </div>
                {marketCapData.length ? (
                  <>
                    <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-[var(--panel)]">
                      {marketCapData.map((item, index) => (
                        <span
                          key={item.name}
                          className="h-full"
                          style={{
                            width: `${item.value}%`,
                            backgroundColor: marketCapColors[index % marketCapColors.length],
                          }}
                        />
                      ))}
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      {marketCapData.map((item, index) => (
                        <div key={item.name} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: marketCapColors[index % marketCapColors.length] }}
                              />
                              <span className="truncate text-sm font-semibold text-[var(--foreground)]">{item.name}</span>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-[var(--foreground)]">
                              {item.value.toFixed(2)}%
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-[var(--muted)]">
                            {formatCurrency(item.amount ?? 0)} monthly exposure
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted)]">
                    Market-cap metadata is unavailable for the active SIP funds.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">
              Start SIPs from Search to build this allocation.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>SIP Mandates</CardTitle>
          <CardDescription>{sips.length} recurring investments</CardDescription>
        </CardHeader>
        <CardContent>
          {sips.length ? (
            <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
              <div className="hidden grid-cols-[minmax(280px,1.6fr)_minmax(110px,0.65fr)_minmax(125px,0.65fr)_minmax(100px,0.6fr)_auto] gap-4 border-b border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)] lg:grid">
                <span>Fund</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Next due</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>
              {sipPagination.items.map((sip) => (
                <div
                  key={sip.id}
                  role="button"
                  tabIndex={0}
                  className="grid w-full cursor-pointer gap-4 border-b border-[var(--line)] px-4 py-3 text-left transition duration-200 last:border-b-0 hover:bg-[var(--row-hover)] lg:grid-cols-[minmax(280px,1.6fr)_minmax(110px,0.65fr)_minmax(125px,0.65fr)_minmax(100px,0.6fr)_auto] lg:items-center"
                  onClick={() => onOpenSip(sip.id)}
                  onKeyDown={(event) => openSipFromKeyboard(event, sip.id)}
                >
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold text-[var(--foreground)]">{sip.asset.name}</h4>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                      <CalendarDays className="h-4 w-4" aria-hidden />
                      <span>Started {sip.startDate}</span>
                    </div>
                  </div>
                  <div className="lg:text-right">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{formatCurrency(sip.amount)}</p>
                    <p className="text-xs text-[var(--muted)]">{formatFrequency(sip.frequency)}</p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--foreground)] lg:text-right">{sip.nextDueDate ?? "NA"}</p>
                  <div>
                    <Badge variant={sip.status === "ACTIVE" ? "success" : "warning"}>
                      {sip.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 lg:justify-end">
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      aria-label="Edit SIP"
                      title="Edit SIP"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(sip);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
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
                        setDeleteTarget(sip);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <TablePagination
                {...sipPagination}
                onPageChange={sipPagination.setPage}
                onPageSizeChange={sipPagination.setPageSize}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">
              No SIP mandates.
            </div>
          )}
        </CardContent>
      </Card>

      {editingSip ? (
        <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm animate-fade" role="dialog" aria-modal="true">
          <button className="absolute inset-0 cursor-default" type="button" aria-label="Close edit SIP" onClick={() => setEditingSip(null)} />
          <form
            className="modal-panel absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-xl"
            onSubmit={saveEdit}
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Edit SIP</h3>
              <p className="mt-1 truncate text-sm text-[var(--muted)]">{editingSip.asset.name}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sip-edit-amount">Amount</Label>
                <Input
                  id="sip-edit-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sip-edit-frequency">Frequency</Label>
                <select
                  id="sip-edit-frequency"
                  className={selectClass}
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value as SipFrequency)}
                >
                  <option value="WEEKLY" className="bg-slate-950">Weekly</option>
                  <option value="MONTHLY" className="bg-slate-950">Monthly</option>
                  <option value="QUARTERLY" className="bg-slate-950">Quarterly</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sip-edit-start">Start date</Label>
                <Input
                  id="sip-edit-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sip-edit-status">Status</Label>
                <select
                  id="sip-edit-status"
                  className={selectClass}
                  value={status}
                  onChange={(event) => setStatus(event.target.value as SipStatus)}
                >
                  <option value="ACTIVE" className="bg-slate-950">Active</option>
                  <option value="PAUSED" className="bg-slate-950">Paused</option>
                </select>
              </div>
            </div>
            {error ? <p className="mt-4 text-sm text-[var(--negative)]">{error}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="submit">Save SIP</Button>
              <Button type="button" variant="secondary" onClick={() => setEditingSip(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete SIP mandate?"
        description={deleteTarget ? `This removes the recurring SIP setup for ${deleteTarget.asset.name}. Existing transactions stay in history.` : undefined}
        confirmLabel="Delete"
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void deleteSip()}
      />
    </section>
  );
}

function compactFundName(name: string) {
  return name
    .replace(/\s*-\s*Direct Plan\s*-\s*Growth.*/i, "")
    .replace(/\s*-\s*Growth Option.*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMarketCapName(name: string) {
  const cleaned = name.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  if (/\blarge\b/i.test(cleaned)) {
    return "Large Cap";
  }

  if (/\bmid\b/i.test(cleaned)) {
    return "Mid Cap";
  }

  if (/\bsmall\b|\bmicro\b/i.test(cleaned)) {
    return "Small Cap";
  }

  return cleaned.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFrequency(frequency: SipFrequency) {
  if (frequency === "WEEKLY") {
    return "Weekly";
  }

  if (frequency === "QUARTERLY") {
    return "Quarterly";
  }

  return "Monthly";
}
