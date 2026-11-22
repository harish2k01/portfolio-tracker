import assert from "node:assert/strict";
import test from "node:test";
import { buildAttentionItems, daysBetween } from "../src/lib/attention";
import type { NetWorthAssetRow, SipRow } from "../src/types/portfolio";

const today = "2026-11-22";

function sip(overrides: Partial<SipRow>): SipRow {
  return {
    id: "sip-1",
    amount: 10_000,
    frequency: "MONTHLY",
    startDate: "2025-01-25",
    nextDueDate: "2026-11-25",
    status: "ACTIVE",
    asset: { id: "a1", name: "Flexi Cap Fund", type: "MUTUAL_FUND", symbol: null, schemeCode: "1", isin: null, exchange: null, category: null, amc: null },
    ...overrides,
  };
}

function asset(overrides: Partial<NetWorthAssetRow>): NetWorthAssetRow {
  return {
    id: "nw-1",
    name: "SBI FD",
    type: "FIXED_DEPOSIT",
    institution: null,
    currentValue: 200_000,
    investedAmount: 200_000,
    accountReference: null,
    interestRate: 7.1,
    maturityDate: null,
    quantity: null,
    unitPrice: null,
    notes: null,
    asOfDate: "2026-11-01",
    ...overrides,
  };
}

test("counts whole days between ISO dates", () => {
  assert.equal(daysBetween("2026-11-22", "2026-11-25"), 3);
  assert.equal(daysBetween("2026-11-22", "2026-11-22"), 0);
  assert.equal(daysBetween("2026-12-30", "2027-01-02"), 3);
  assert.equal(daysBetween("2026-11-25", "2026-11-22"), -3);
});

test("flags active SIPs due within a week and skips paused or distant ones", () => {
  const items = buildAttentionItems({
    today,
    netWorthAssets: [],
    sips: [
      sip({ id: "soon" }),
      sip({ id: "today", nextDueDate: "2026-11-22" }),
      sip({ id: "later", nextDueDate: "2026-12-05" }),
      sip({ id: "paused", status: "PAUSED" }),
      sip({ id: "none", nextDueDate: null }),
    ],
  });

  assert.deepEqual(items.map((item) => item.id), ["sip-today", "sip-soon"]);
  assert.match(items[0].title, /today$/);
  assert.match(items[1].title, /in 3 days$/);
});

test("flags deposits maturing soon or already matured, and old manual values", () => {
  const items = buildAttentionItems({
    today,
    sips: [],
    netWorthAssets: [
      asset({ id: "maturing", maturityDate: "2026-12-02" }),
      asset({ id: "matured", maturityDate: "2026-11-10" }),
      asset({ id: "far", maturityDate: "2027-06-18" }),
      asset({ id: "epf", name: "EPF", type: "EPF", asOfDate: "2026-09-09" }),
      asset({ id: "fresh", name: "Savings", type: "BANK_ACCOUNT", asOfDate: "2026-11-20" }),
    ],
  });

  assert.deepEqual(items.map((item) => item.id), ["maturity-matured", "maturity-maturing", "stale-epf"]);
  assert.match(items[0].title, /matured 12 days ago/);
  assert.match(items[1].title, /in 10 days/);
  assert.match(items[2].title, /74 days old/);
});
