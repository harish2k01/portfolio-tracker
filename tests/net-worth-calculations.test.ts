import assert from "node:assert/strict";
import test from "node:test";
import { buildNetWorthAllocation, mergeNetWorthTimeline } from "../src/lib/net-worth-calculations";
import type { HoldingRow, NetWorthAssetRow } from "../src/types/portfolio";

test("builds a consolidated allocation across investments and manually tracked assets", () => {
  const holdings = [
    {
      assetId: "mf-1",
      name: "Index Fund",
      type: "MUTUAL_FUND",
      assetClass: "Equity",
      investedAmount: 90_000,
      quantity: 1,
      currentPrice: 100_000,
      currentValue: 100_000,
      gain: 10_000,
      gainPercent: 11.11,
    },
    {
      assetId: "stock-1",
      name: "Example Stock",
      type: "STOCK",
      assetClass: "Equity",
      investedAmount: 45_000,
      quantity: 1,
      currentPrice: 50_000,
      currentValue: 50_000,
      gain: 5_000,
      gainPercent: 11.11,
    },
  ] satisfies HoldingRow[];
  const assets = [
    manualAsset("bank", "Emergency fund", "BANK_ACCOUNT", 75_000),
    manualAsset("epf", "EPF", "EPF", 25_000),
  ];

  assert.deepEqual(buildNetWorthAllocation(holdings, assets), [
    { name: "Mutual Funds", amount: 100_000, value: 40 },
    { name: "Bank Accounts", amount: 75_000, value: 30 },
    { name: "Stocks", amount: 50_000, value: 20 },
    { name: "EPF", amount: 25_000, value: 10 },
  ]);
});

test("merges investment and manual-asset history using carry-forward values", () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dayOne = yesterday.toISOString().slice(0, 10);
  const dayTwo = today.toISOString().slice(0, 10);

  const timeline = mergeNetWorthTimeline(
    [
      { date: dayOne, invested: 1_000, current: 1_050 },
      { date: dayTwo, invested: 2_000, current: 2_100 },
    ],
    [{ date: dayOne, invested: 5_000, current: 5_000 }],
  );

  assert.deepEqual(timeline, [
    {
      date: dayOne,
      invested: 6_000,
      current: 6_050,
      investments: 1_050,
      otherAssets: 5_000,
    },
    {
      date: dayTwo,
      invested: 7_000,
      current: 7_100,
      investments: 2_100,
      otherAssets: 5_000,
    },
  ]);
});

function manualAsset(
  id: string,
  name: string,
  type: NetWorthAssetRow["type"],
  currentValue: number,
): NetWorthAssetRow {
  return {
    id,
    name,
    type,
    institution: null,
    currentValue,
    investedAmount: currentValue,
    accountReference: null,
    interestRate: null,
    maturityDate: null,
    quantity: null,
    unitPrice: null,
    notes: null,
    asOfDate: new Date().toISOString().slice(0, 10),
  };
}
