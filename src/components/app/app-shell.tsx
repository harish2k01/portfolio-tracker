"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Landmark,
  Layers,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { AssetDetailPanel } from "@/components/dashboard/asset-detail-panel";
import { FundOverviewPage, type FundOverviewTarget } from "@/components/dashboard/fund-overview-page";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { InvestmentSearchResult, PortfolioDashboard } from "@/types/portfolio";

export type AppUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: "ADMIN" | "USER";
  isActive: boolean;
};

export type DetailTarget = { kind: "asset"; id: string } | { kind: "sip"; id: string };
type Theme = "dark" | "light";
type Overlay<T> = { path: string; target: T } | null;

type AppContextValue = {
  user: AppUser;
  dashboard: PortfolioDashboard | null;
  isLoading: boolean;
  refreshDashboard: () => Promise<void>;
  openAsset: (assetId: string) => void;
  openSip: (sipId: string) => void;
  openSearchResult: (asset: InvestmentSearchResult) => void;
  requestReset: () => void;
  isResetting: boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const value = useContext(AppContext);

  if (!value) {
    throw new Error("useApp must be used inside AppShell");
  }

  return value;
}

const baseNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/holdings", label: "Holdings", icon: Layers },
  { href: "/sips", label: "SIPs & cash flow", icon: CalendarClock },
  { href: "/assets", label: "Accounts & assets", icon: Landmark },
  { href: "/activity", label: "Activity", icon: ListOrdered },
  { href: "/search", label: "Find investments", icon: Search },
];

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("light");
  const [dashboard, setDashboard] = useState<PortfolioDashboard | null>(null);
  const [fundOverlay, setFundOverlay] = useState<Overlay<FundOverviewTarget>>(null);
  const [detailOverlay, setDetailOverlay] = useState<Overlay<DetailTarget>>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const nav = user.role === "ADMIN" ? [...baseNav, { href: "/settings", label: "Settings", icon: Settings }] : baseNav;
  const displayName = user.name?.trim() || user.email?.split("@")[0] || "User";
  // Overlays belong to the page they were opened on; navigating away hides them.
  const fundTarget = fundOverlay?.path === pathname ? fundOverlay.target : null;
  const detailTarget = detailOverlay?.path === pathname ? detailOverlay.target : null;

  const refreshDashboard = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/portfolio", { cache: "no-store" });

      if (!response.ok) {
        setError("Unable to load net-worth data.");
        return;
      }

      setDashboard(await response.json());
    } catch {
      setError("Unable to load net-worth data.");
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

  async function resetNetWorthData() {
    setIsResetting(true);
    setError("");

    try {
      const response = await fetch("/api/portfolio", { method: "DELETE" });

      if (!response.ok) {
        throw new Error("Unable to reset net-worth data.");
      }

      setFundOverlay(null);
      setDetailOverlay(null);
      setResetOpen(false);
      await refreshDashboard();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reset net-worth data.");
    } finally {
      setIsResetting(false);
    }
  }

  const contextValue = useMemo<AppContextValue>(
    () => ({
      user,
      dashboard,
      isLoading,
      refreshDashboard,
      openAsset: (assetId) => setFundOverlay({ path: pathname, target: { kind: "asset", assetId } }),
      openSip: (sipId) => setFundOverlay({ path: pathname, target: { kind: "sip", sipId } }),
      openSearchResult: (asset) => setFundOverlay({ path: pathname, target: { kind: "search", asset } }),
      requestReset: () => setResetOpen(true),
      isResetting,
    }),
    [user, dashboard, isLoading, refreshDashboard, pathname, isResetting],
  );

  return (
    <AppContext.Provider value={contextValue}>
      <div
        data-theme={theme}
        className={cn(
          "min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300",
          theme === "light" ? "theme-light" : "theme-dark",
        )}
      >
        <div
          className={cn(
            "grid min-h-screen w-full transition-[grid-template-columns] duration-300 ease-out",
            sidebarCollapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]",
          )}
        >
          {menuOpen ? (
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              aria-label="Close navigation"
              onClick={() => setMenuOpen(false)}
            />
          ) : null}

          <aside
            className={cn(
              "app-menu fixed inset-y-0 left-0 z-50 flex w-[264px] -translate-x-full flex-col gap-6 border-r px-3 py-5 transition-[width,transform,padding] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
              menuOpen && "translate-x-0",
              sidebarCollapsed && "lg:w-[72px] lg:px-2",
            )}
          >
            <div className={cn("flex items-center justify-between gap-2 px-2", sidebarCollapsed && "lg:flex-col lg:px-0")}>
              <Link
                href="/"
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
                  sidebarCollapsed && "lg:justify-center",
                )}
                onClick={() => setMenuOpen(false)}
                aria-label="Net Worth Tracker home"
              >
                <Image src="/logo.svg" alt="" width={30} height={30} className="shrink-0 rounded-lg" priority />
                <span className={cn("font-display sidebar-primary truncate text-[17px] font-semibold", sidebarCollapsed && "lg:hidden")}>
                  Net Worth
                </span>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="sidebar-toggle hidden lg:inline-flex"
                aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
                aria-expanded={!sidebarCollapsed}
                onClick={toggleSidebar}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden /> : <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="sidebar-toggle lg:hidden"
                aria-label="Close navigation"
                onClick={() => setMenuOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden />
              </Button>
            </div>

            <nav className="flex flex-col gap-0.5" aria-label="Primary navigation">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "app-menu-item flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                      active && "app-menu-item-active",
                      sidebarCollapsed && "lg:justify-center lg:px-0",
                    )}
                    onClick={() => setMenuOpen(false)}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    <span className={cn("truncate", sidebarCollapsed && "lg:hidden")}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="sidebar-divider mt-auto flex flex-col gap-0.5 border-t pt-3">
              <div className={cn("px-3 pb-2", sidebarCollapsed && "lg:hidden")}>
                <p className="sidebar-primary truncate text-sm font-semibold">{displayName}</p>
                <p className="sidebar-muted truncate text-xs">{user.email ?? "Signed in"}</p>
              </div>
              <button
                type="button"
                className={cn(
                  "app-menu-item flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium",
                  sidebarCollapsed && "lg:justify-center lg:px-0",
                )}
                onClick={toggleTheme}
                title={sidebarCollapsed ? (theme === "dark" ? "Light mode" : "Dark mode") : undefined}
              >
                {theme === "dark" ? <Sun className="h-[18px] w-[18px] shrink-0" aria-hidden /> : <Moon className="h-[18px] w-[18px] shrink-0" aria-hidden />}
                <span className={cn("truncate", sidebarCollapsed && "lg:hidden")}>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
              </button>
              <button
                type="button"
                className={cn(
                  "app-menu-item flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium",
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

          <div className="min-w-0 px-4 pb-12 pt-4 sm:px-6 lg:px-10 lg:pt-7">
            <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-5 bg-[var(--background)] px-4 pb-2 pt-3 sm:-mx-6 sm:px-6 lg:hidden">
            <header className="app-header flex items-center justify-between gap-4 rounded-xl border px-3 py-2">
              <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="Net Worth Tracker home">
                <Image src="/logo.svg" alt="" width={28} height={28} className="shrink-0 rounded-lg" priority />
                <span className="font-display truncate text-sm font-semibold">Net Worth</span>
              </Link>
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
            </div>

            {isLoading && !dashboard ? <LoadingOverlay /> : null}

            <div className="mx-auto w-full max-w-[1200px]">
              {error ? (
                <div className="mb-5 rounded-xl border border-[var(--negative)]/30 bg-[var(--negative-soft)] p-4 text-sm text-[var(--negative)]">
                  {error}
                </div>
              ) : null}

              <div key={pathname} className="page-transition">
                {detailTarget ? (
                  <AssetDetailPanel
                    mode="page"
                    target={detailTarget}
                    onClose={() => setDetailOverlay(null)}
                    onChanged={refreshDashboard}
                  />
                ) : fundTarget ? (
                  <FundOverviewPage
                    target={fundTarget}
                    onBack={() => setFundOverlay(null)}
                    onOpenInvestment={(target) => setDetailOverlay({ path: pathname, target })}
                  />
                ) : (
                  children
                )}
              </div>
            </div>
          </div>
        </div>
        <ConfirmDialog
          open={resetOpen}
          title="Reset all net-worth data?"
          description="This permanently deletes your transactions, SIPs, holdings, tracked accounts, assets, and value history. Your account will remain active."
          confirmLabel="Reset net-worth data"
          tone="danger"
          isBusy={isResetting}
          onConfirm={() => void resetNetWorthData()}
          onClose={() => setResetOpen(false)}
        />
      </div>
    </AppContext.Provider>
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
