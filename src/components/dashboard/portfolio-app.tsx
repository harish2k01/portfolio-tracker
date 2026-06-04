"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Image from "next/image";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  LogOut,
  Menu,
  Search,
  Settings,
  Star,
  WalletCards,
  X,
} from "lucide-react";
import { AdminSettings } from "@/components/dashboard/admin-settings";
import { AssetDetailPanel } from "@/components/dashboard/asset-detail-panel";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { FundSearch } from "@/components/dashboard/fund-search";
import { SipManager } from "@/components/dashboard/sip-manager";
import { TransactionEntry, type PendingSipEntry } from "@/components/dashboard/transaction-entry";
import { WatchlistPanel } from "@/components/dashboard/watchlist-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortfolioDashboard } from "@/types/portfolio";

type AppUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: "ADMIN" | "USER";
  isActive: boolean;
};

type Section = "dashboard" | "sips" | "transactions" | "search" | "watchlist" | "admin";
type DetailTarget = { kind: "asset"; id: string } | { kind: "sip"; id: string };

const baseSections = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "sips", label: "SIPs", icon: CalendarClock },
  { id: "transactions", label: "Entries", icon: WalletCards },
  { id: "search", label: "Search", icon: Search },
  { id: "watchlist", label: "Watchlist", icon: Star },
] satisfies Array<{ id: Section; label: string; icon: typeof BarChart3 }>;

export function PortfolioApp({ user }: { user: AppUser }) {
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [dashboard, setDashboard] = useState<PortfolioDashboard | null>(null);
  const [pendingSipEntry, setPendingSipEntry] = useState<PendingSipEntry | null>(null);
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const sections =
    user.role === "ADMIN"
      ? [...baseSections, { id: "admin" as const, label: "Admin", icon: Settings }]
      : baseSections;
  const displayName = user.name?.trim() || user.email?.split("@")[0] || "User";

  const refreshDashboard = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/portfolio", { cache: "no-store" });

      if (!response.ok) {
        setError("Unable to load portfolio data.");
        return;
      }

      setDashboard(await response.json());
    } catch {
      setError("Unable to load portfolio data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  function switchSection(section: Section) {
    setActiveSection(section);
    setMenuOpen(false);
  }

  function handleSipEntry(entry: PendingSipEntry) {
    setPendingSipEntry(entry);
    switchSection("transactions");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(0,194,168,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(111,97,255,0.11),transparent_28%),linear-gradient(180deg,#070809_0%,#0d1117_52%,#070809_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1560px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="glass-panel sticky top-4 z-30 mb-5 rounded-lg px-4 py-3 animate-in">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Image
                src="/logo.svg"
                alt=""
                width={44}
                height={44}
                className="shrink-0 rounded-full shadow-[0_12px_36px_rgba(0,194,168,0.28)]"
                priority
              />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold leading-tight text-white">
                  Portfolio Tracker
                </h1>
                <p className="truncate text-sm text-slate-400">{displayName}</p>
              </div>
            </div>

            <div className="relative">
              {menuOpen ? (
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                />
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="relative z-20"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
              </Button>
              {menuOpen ? (
                <nav className="absolute right-0 top-12 z-20 w-72 rounded-lg border border-white/10 bg-[#0c1016]/98 p-2 shadow-2xl shadow-black/40 backdrop-blur animate-in">
                  <div className="mb-2 border-b border-white/10 px-3 py-2">
                    <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                    <p className="text-xs text-slate-500">Signed in</p>
                  </div>
                  {sections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;

                    return (
                      <button
                        key={section.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition",
                          isActive
                            ? "bg-white text-slate-950"
                            : "text-slate-300 hover:bg-white/[0.08] hover:text-white",
                        )}
                        onClick={() => switchSection(section.id)}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                        {section.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center gap-3 rounded-md border-t border-white/10 px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sign out
                  </button>
                </nav>
              ) : null}
            </div>
          </div>
        </header>

        {isLoading ? <LoadingOverlay /> : null}

        {error ? (
          <div className="mb-5 rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {activeSection === "dashboard" ? (
          <DashboardOverview
            dashboard={dashboard}
            onOpenTransactions={() => switchSection("transactions")}
            onOpenAsset={(assetId) => setDetailTarget({ kind: "asset", id: assetId })}
          />
        ) : null}
        {activeSection === "sips" ? (
          <SipManager
            sips={dashboard?.sips ?? []}
            dueSips={dashboard?.dueSips ?? []}
            onChanged={refreshDashboard}
            onCreateEntry={handleSipEntry}
            onOpenSip={(sipId) => setDetailTarget({ kind: "sip", id: sipId })}
          />
        ) : null}
        {activeSection === "transactions" ? (
          <TransactionEntry
            sips={dashboard?.sips ?? []}
            pendingSipEntry={pendingSipEntry}
            onPendingSipConsumed={() => setPendingSipEntry(null)}
            onChanged={refreshDashboard}
            onOpenAsset={(assetId) => setDetailTarget({ kind: "asset", id: assetId })}
          />
        ) : null}
        {activeSection === "search" ? <FundSearch onChanged={refreshDashboard} /> : null}
        {activeSection === "watchlist" ? <WatchlistPanel onChanged={refreshDashboard} /> : null}
        {activeSection === "admin" && user.role === "ADMIN" ? <AdminSettings /> : null}
      </div>
      <AssetDetailPanel target={detailTarget} onClose={() => setDetailTarget(null)} />
    </main>
  );
}

function LoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#070809]/70 backdrop-blur-sm animate-fade"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="rounded-full border border-white/10 bg-[#0f1319]/90 p-5 shadow-2xl shadow-black/50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-cyan-300" />
      </div>
    </div>
  );
}
