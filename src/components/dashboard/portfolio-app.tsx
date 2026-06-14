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
  Moon,
  Search,
  Settings,
  Sun,
  WalletCards,
  X,
} from "lucide-react";
import { AdminSettings } from "@/components/dashboard/admin-settings";
import { AssetDetailPanel } from "@/components/dashboard/asset-detail-panel";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { FundSearch } from "@/components/dashboard/fund-search";
import { SipManager } from "@/components/dashboard/sip-manager";
import { TransactionEntry } from "@/components/dashboard/transaction-entry";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { PortfolioDashboard } from "@/types/portfolio";

type AppUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: "ADMIN" | "USER";
  isActive: boolean;
};

type Section = "dashboard" | "sips" | "transactions" | "search" | "admin";
type DetailTarget = { kind: "asset"; id: string } | { kind: "sip"; id: string };
type Theme = "dark" | "light";

const baseSections = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "sips", label: "SIPs", icon: CalendarClock },
  { id: "transactions", label: "Transactions", icon: WalletCards },
  { id: "search", label: "Search", icon: Search },
] satisfies Array<{ id: Section; label: string; icon: typeof BarChart3 }>;

export function PortfolioApp({ user }: { user: AppUser }) {
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [theme, setTheme] = useState<Theme>("light");
  const [dashboard, setDashboard] = useState<PortfolioDashboard | null>(null);
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
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

  useEffect(() => {
    const stored = window.localStorage.getItem("portfolio-tracker-theme");

    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    }
  }, []);

  function switchSection(section: Section) {
    setActiveSection(section);
    setMenuOpen(false);
  }

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem("portfolio-tracker-theme", next);
      return next;
    });
  }

  async function resetPortfolio() {
    setIsResetting(true);
    setError("");

    try {
      const response = await fetch("/api/portfolio", { method: "DELETE" });

      if (!response.ok) {
        throw new Error("Unable to reset portfolio data.");
      }

      setDetailTarget(null);
      setActiveSection("dashboard");
      setResetOpen(false);
      await refreshDashboard();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reset portfolio data.");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <main
      data-theme={theme}
      className={cn(
        "min-h-screen transition-colors duration-300",
        theme === "light" ? "theme-light bg-[#fbfcfd]" : "theme-dark bg-[#111827]",
      )}
    >
      <div className="mx-auto grid min-h-screen w-full max-w-[1680px] lg:grid-cols-[248px_minmax(0,1fr)]">
        {menuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}

        <aside
          className={cn(
            "app-menu fixed inset-y-0 left-0 z-50 flex w-[248px] -translate-x-full flex-col border-r p-3 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
            menuOpen && "translate-x-0",
          )}
        >
          <div className="flex items-center justify-between gap-2 px-1 py-2">
            <button
              type="button"
              className="flex min-w-0 items-center gap-3 rounded-md text-left outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/40"
              onClick={() => switchSection("dashboard")}
              aria-label="Go to dashboard"
            >
              <Image src="/logo.svg" alt="" width={38} height={38} className="shrink-0 rounded-full" priority />
              <span className="truncate text-base font-semibold text-white">Portfolio Tracker</span>
            </button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="header-control lg:hidden"
              aria-label="Close navigation"
              onClick={() => setMenuOpen(false)}
            >
              <X className="h-5 w-5" aria-hidden />
            </Button>
          </div>

          <div className="mx-1 mt-4 border-b border-white/15 px-2 pb-4">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="mt-1 truncate text-xs text-slate-400">{user.email ?? "Signed in"}</p>
          </div>

          <nav className="mt-4 space-y-1" aria-label="Primary navigation">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  className={cn(
                    "app-menu-item flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition",
                    isActive && "app-menu-item-active",
                  )}
                  onClick={() => switchSection(section.id)}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {section.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto space-y-1 border-t border-white/15 pt-3">
            <button
              type="button"
              className="app-menu-item flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button
              type="button"
              className="app-menu-item flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </div>
        </aside>

        <div className="min-w-0 px-4 py-4 sm:px-6 lg:px-8">
          <header className="app-header sticky top-0 z-30 mb-5 flex items-center justify-between gap-4 rounded-lg border px-3 py-2 lg:hidden">
            <button
              type="button"
              className="flex min-w-0 items-center gap-2 text-left"
              onClick={() => switchSection("dashboard")}
              aria-label="Go to dashboard"
            >
              <Image src="/logo.svg" alt="" width={34} height={34} className="shrink-0 rounded-full" priority />
              <span className="truncate text-sm font-semibold text-white">Portfolio Tracker</span>
            </button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="header-control"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </Button>
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
              onOpenTransactions={() => switchSection("search")}
              onOpenAsset={(assetId) => setDetailTarget({ kind: "asset", id: assetId })}
            />
          ) : null}
          {activeSection === "sips" ? (
            <SipManager
              sips={dashboard?.sips ?? []}
              onChanged={refreshDashboard}
              onOpenSip={(sipId) => setDetailTarget({ kind: "sip", id: sipId })}
            />
          ) : null}
          {activeSection === "transactions" ? (
            <TransactionEntry
              dashboard={dashboard}
              onChanged={refreshDashboard}
              onOpenAsset={(assetId) => setDetailTarget({ kind: "asset", id: assetId })}
            />
          ) : null}
          {activeSection === "search" ? <FundSearch onChanged={refreshDashboard} /> : null}
          {activeSection === "admin" && user.role === "ADMIN" ? (
            <AdminSettings onResetPortfolio={() => setResetOpen(true)} isResetting={isResetting} />
          ) : null}
        </div>
      </div>
      <AssetDetailPanel target={detailTarget} onClose={() => setDetailTarget(null)} onChanged={refreshDashboard} />
      <ConfirmDialog
        open={resetOpen}
        title="Reset all portfolio data?"
        description="This permanently deletes your transactions, SIPs, holdings, and portfolio history. Your account will remain active."
        confirmLabel="Reset portfolio"
        tone="danger"
        isBusy={isResetting}
        onConfirm={() => void resetPortfolio()}
        onClose={() => setResetOpen(false)}
      />
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
      <div className="rounded-full border border-white/10 bg-[#16212e] p-5 shadow-xl">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-white" />
      </div>
    </div>
  );
}
