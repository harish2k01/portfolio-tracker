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
  Trash2,
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
      <div className="mx-auto flex min-h-screen w-full max-w-[1560px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="app-header sticky top-0 z-30 mb-6 border px-4 py-3 animate-in">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              className="flex min-w-0 items-center gap-3 rounded-md text-left outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/40"
              onClick={() => switchSection("dashboard")}
              aria-label="Go to dashboard"
            >
              <Image
                src="/logo.svg"
                alt=""
                width={44}
                height={44}
                className="shrink-0 rounded-full"
                priority
              />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold leading-tight text-white">
                  Portfolio Tracker
                </h1>
                <p className="truncate text-sm text-slate-400">{displayName}</p>
              </div>
            </button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="header-control"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                title={theme === "dark" ? "Light mode" : "Dark mode"}
                onClick={toggleTheme}
              >
                {theme === "dark" ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
              </Button>
            <div className="relative">
              {menuOpen ? (
                <button
                  type="button"
                  className="fixed inset-0 z-[45] cursor-default"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                />
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="header-control relative z-[60]"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
              </Button>
              {menuOpen ? (
                <nav className="app-menu absolute right-0 top-12 z-[60] w-72 rounded-lg border p-2 shadow-xl animate-in">
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
                            ? "bg-white/12 text-white"
                            : "text-slate-200 hover:bg-white/[0.09] hover:text-white",
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
                    className="mt-2 flex w-full items-center gap-3 rounded-md border-t border-white/10 px-3 py-2.5 text-left text-sm font-medium text-rose-200 transition hover:bg-rose-400/10 hover:text-rose-100"
                    onClick={() => {
                      setMenuOpen(false);
                      setResetOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Reset portfolio data
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sign out
                  </button>
                </nav>
              ) : null}
            </div>
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
        {activeSection === "admin" && user.role === "ADMIN" ? <AdminSettings /> : null}
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
