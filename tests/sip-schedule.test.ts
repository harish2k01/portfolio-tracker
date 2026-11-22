import assert from "node:assert/strict";
import test from "node:test";
import { projectSipDebits, shiftSipDate } from "../src/lib/sip-schedule";
import type { SipRow } from "../src/types/portfolio";

function sip(overrides: Partial<SipRow>): SipRow {
  return {
    id: "s1",
    amount: 5_000,
    frequency: "MONTHLY",
    startDate: "2025-01-10",
    nextDueDate: "2026-12-10",
    status: "ACTIVE",
    asset: { id: "a1", name: "Index Fund", type: "MUTUAL_FUND", symbol: null, schemeCode: "1", isin: null, exchange: null, category: null, amc: null },
    ...overrides,
  };
}

test("shifts dates by frequency and clamps to month end", () => {
  assert.equal(shiftSipDate("2026-01-31", "MONTHLY", 1), "2026-02-28");
  assert.equal(shiftSipDate("2026-02-28", "MONTHLY", 1, 31), "2026-03-31");
  assert.equal(shiftSipDate("2026-11-15", "QUARTERLY", 1), "2027-02-15");
  assert.equal(shiftSipDate("2026-12-29", "WEEKLY", 1), "2027-01-05");
  assert.equal(shiftSipDate("2026-12-10", "MONTHLY", -1), "2026-11-10");
});

test("projects debits inside a window, including ones already taken this month", () => {
  const debits = projectSipDebits(
    [
      sip({ id: "monthly" }),
      sip({ id: "weekly", frequency: "WEEKLY", nextDueDate: "2026-11-24", startDate: "2026-11-01" }),
      sip({ id: "paused", status: "PAUSED" }),
      sip({ id: "new", nextDueDate: "2026-11-28", startDate: "2026-11-28" }),
    ],
    "2026-11-01",
    "2026-11-30",
  );

  assert.deepEqual(
    debits.map((debit) => `${debit.sipId}:${debit.date}`),
    ["weekly:2026-11-03", "monthly:2026-11-10", "weekly:2026-11-10", "weekly:2026-11-17", "weekly:2026-11-24", "new:2026-11-28"],
  );
});
