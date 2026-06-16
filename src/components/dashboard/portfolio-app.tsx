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
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
  WalletCards,
  X,
} from "lucide-react";
import { AdminSettings } from "@/components/dashboard/admin-settings";
import { AssetDetailPanel } from "@/components/dashboard/asset-detail-panel";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { FundOverviewPage, type FundOverviewTarget } from "@/components/dashboard/fund-overview-page";
import { FundSearch } from "@/components/dashboard/fund-search";
import { HoldingsView } from "@/components/dashboard/holdings-view";
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

type Section = "dashboard" | "holdings" | "sips" | "transactions" | "search" | "admin";
type DetailTarget = { kind: "asset"; id: string } | { kind: "sip"; id: string };
type Theme = "dark" | "light";

const baseSections = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "holdings", label: "Holdings", icon: WalletCards },
  { id: "sips", label: "SIPs", icon: CalendarClock },
  { id: "transactions", label: "Transactions", icon: WalletCards },
  { id: "search", label: "Search", icon: Search },
] satisfies Array<{ id: Section; label: string; icon: typeof BarChart3 }>;

export function PortfolioApp({ user }: { user: AppUser }) {
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [theme, setTheme] = useState<Theme>("light");
  const [dashboard, setDashboard] = useState<PortfolioDashboard | null>(null);
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const [fundTarget, setFundTarget] = useState<FundOverviewTarget | null>(null);
  const [holdingsFilter, setHoldingsFilter] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const sections =
    user.role === "ADMIN"
      ? [...baseSections, { id: "admin" as const, label: "Settings", icon: Settings }]
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

    setSidebarCollapsed(window.localStorage.getItem("portfolio-tracker-sidebar") === "collapsed");
  }, []);

  function switchSection(section: Section) {
    setActiveSection(section);
    if (section === "holdings") {
      setHoldingsFilter(null);
    }
    setDetailTarget(null);
    setFundTarget(null);
    setMenuOpen(false);
  }

  function openHoldings(filter?: string) {
    setHoldingsFilter(filter ?? null);
    setActiveSection("holdings");
    setDetailTarget(null);
    setFundTarget(null);
    setMenuOpen(false);
  }

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem("portfolio-tracker-theme", next);
      return next;
    });
  }

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("portfolio-tracker-sidebar", next ? "collapsed" : "expanded");
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
      setFundTarget(null);
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
      <div
        className={cn(
          "mx-auto grid min-h-screen w-full max-w-[1680px] transition-[grid-template-columns] duration-300 ease-out",
          sidebarCollapsed
            ? "lg:grid-cols-[76px_minmax(0,1fr)]"
            : "lg:grid-cols-[248px_minmax(0,1fr)]",
        )}
      >
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
            "app-menu fixed inset-y-0 left-0 z-50 flex w-[268px] -translate-x-full flex-col border-r p-3 transition-[width,transform,padding] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
            menuOpen && "translate-x-0",
            sidebarCollapsed && "lg:w-[76px] lg:p-2",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between gap-2 px-1 py-2",
              sidebarCollapsed && "lg:flex-col lg:px-0",
            )}
          >
            <button
              type="button"
              className={cn(
                "flex min-w-0 items-center gap-3 rounded-md text-left outline-none transition duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
                sidebarCollapsed && "lg:justify-center",
              )}
              onClick={() => switchSection("dashboard")}
              aria-label="Go to dashboard"
            >
              <Image src="/logo.svg" alt="" width={38} height={38} className="shrink-0 rounded-full" priority />
              <span className={cn("sidebar-primary truncate text-base font-semibold", sidebarCollapsed && "lg:hidden")}>
                Portfolio Tracker
              </span>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="sidebar-toggle hidden lg:inline-flex"
              aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={!sidebarCollapsed}
              onClick={toggleSidebar}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden /> : <PanelLeftClose className="h-5 w-5" aria-hidden />}
            </Button>
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

          <div className={cn("sidebar-divider mx-1 mt-4 border-b px-2 pb-4", sidebarCollapsed && "lg:hidden")}>
            <p className="sidebar-primary truncate text-sm font-semibold">{displayName}</p>
            <p className="sidebar-muted mt-1 truncate text-xs">{user.email ?? "Signed in"}</p>
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
                    sidebarCollapsed && "lg:justify-center lg:px-0",
                  )}
                  onClick={() => switchSection(section.id)}
                  title={sidebarCollapsed ? section.label : undefined}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  <span className={cn("truncate", sidebarCollapsed && "lg:hidden")}>{section.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="sidebar-divider mt-auto space-y-1 border-t pt-3">
            <button
              type="button"
              className={cn(
                "app-menu-item flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition",
                sidebarCollapsed && "lg:justify-center lg:px-0",
              )}
              onClick={toggleTheme}
              title={sidebarCollapsed ? (theme === "dark" ? "Light mode" : "Dark mode") : undefined}
            >
              {theme === "dark" ? <Sun className="h-[18px] w-[18px] shrink-0" aria-hidden /> : <Moon className="h-[18px] w-[18px] shrink-0" aria-hidden />}
              <span className={cn("truncate", sidebarCollapsed && "lg:hidden")}>
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </span>
            </button>
            <button
              type="button"
              className={cn(
                "app-menu-item flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition",
                sidebarCollapsed && "lg:justify-center lg:px-0",
              )}
              onClick={() => signOut({ callbackUrl: "/login" })}
              title={sidebarCollapsed ? "Sign out" : undefined}
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
              <span className={cn("truncate", sidebarCollapsed && "lg:hidden")}>Sign out</span>
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

          <div key={activeSection} className="page-transition">
            {detailTarget ? (
              <AssetDetailPanel
                mode="page"
                target={detailTarget}
                onClose={() => setDetailTarget(null)}
                onChanged={refreshDashboard}
              />
            ) : fundTarget ? (
              <FundOverviewPage
                target={fundTarget}
                onBack={() => setFundTarget(null)}
                onOpenInvestment={(target) => setDetailTarget(target)}
              />
            ) : activeSection === "dashboard" ? (
              <DashboardOverview
                dashboard={dashboard}
                onOpenTransactions={() => switchSection("search")}
                onOpenHoldings={openHoldings}
              />
            ) : null}
            {!detailTarget && !fundTarget && activeSection === "holdings" ? (
              <HoldingsView
                dashboard={dashboard}
                filter={holdingsFilter}
                onFilterChange={setHoldingsFilter}
                onOpenTransactions={() => switchSection("search")}
                onOpenAsset={(assetId) => setFundTarget({ kind: "asset", assetId })}
              />
            ) : null}
            {!detailTarget && !fundTarget && activeSection === "sips" ? (
              <SipManager
                sips={dashboard?.sips ?? []}
                onChanged={refreshDashboard}
                onOpenSip={(sipId) => setFundTarget({ kind: "sip", sipId })}
              />
            ) : null}
            {!detailTarget && !fundTarget && activeSection === "transactions" ? (
              <TransactionEntry
                dashboard={dashboard}
                onChanged={refreshDashboard}
                onOpenAsset={(assetId) => setFundTarget({ kind: "asset", assetId })}
              />
            ) : null}
            {!detailTarget && !fundTarget && activeSection === "search" ? (
              <FundSearch
                onChanged={refreshDashboard}
                onOpenFund={(asset) => setFundTarget({ kind: "search", asset })}
              />
            ) : null}
            {!detailTarget && !fundTarget && activeSection === "admin" && user.role === "ADMIN" ? (
              <AdminSettings onResetPortfolio={() => setResetOpen(true)} isResetting={isResetting} />
            ) : null}
          </div>
        </div>
      </div>
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
      className="portfolio-loading-overlay fixed inset-0 z-40 flex items-center justify-center animate-fade"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="portfolio-loader" role="status">
        <p className="portfolio-loader-title">Loading...</p>
        <div className="portfolio-loader-bars" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
