"use client";

import { useApp } from "@/components/app/app-shell";
import { AdminSettings } from "@/components/dashboard/admin-settings";
import { FundSearch } from "@/components/dashboard/fund-search";
import { NetWorthAssets } from "@/components/dashboard/net-worth-assets";
import { TransactionEntry } from "@/components/dashboard/transaction-entry";
import { PageHeader } from "@/components/screens/page-header";

export function AssetsScreen() {
  const { dashboard, refreshDashboard } = useApp();

  // NetWorthAssets carries its own page heading and add button.
  return <NetWorthAssets assets={dashboard?.netWorthAssets ?? []} onChanged={refreshDashboard} />;
}

export function ActivityScreen() {
  const { dashboard, refreshDashboard, openAsset } = useApp();

  return (
    <div className="space-y-5">
      <PageHeader title="Activity" description="Record buys, sells and SIP instalments, or import a broker statement." />
      <TransactionEntry dashboard={dashboard} onChanged={refreshDashboard} onOpenAsset={openAsset} />
    </div>
  );
}

export function SearchScreen() {
  const { refreshDashboard, openSearchResult } = useApp();

  return (
    <div className="space-y-5">
      <PageHeader title="Find investments" description="Search mutual funds, NSE/BSE stocks and ETFs by name, symbol or ISIN." />
      <FundSearch onChanged={refreshDashboard} onOpenFund={openSearchResult} />
    </div>
  );
}

export function SettingsScreen() {
  const { requestReset, isResetting } = useApp();

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Sign-up, users and data." />
      <AdminSettings onResetData={requestReset} isResetting={isResetting} />
    </div>
  );
}
