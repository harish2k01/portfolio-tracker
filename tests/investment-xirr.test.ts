import assert from "node:assert/strict";
import test from "node:test";
import { investmentXirr } from "../src/lib/xirr";

test("a single buy that grows 10% in a year has a 10% XIRR", () => {
  const rate = investmentXirr([{ type: "BUY", amount: 100_000, tradeDate: "2025-01-01" }], 110_000, "2026-01-01");

  assert.ok(rate !== null);
  assert.ok(Math.abs(rate - 0.1) < 0.001, `expected about 0.1, got ${rate}`);
});

test("sells count as money coming back", () => {
  const rate = investmentXirr(
    [
      { type: "SIP_INSTALLMENT", amount: 50_000, tradeDate: "2025-01-01" },
      { type: "LUMPSUM", amount: 50_000, tradeDate: "2025-01-01" },
      { type: "SELL", amount: 55_000, tradeDate: "2026-01-01" },
    ],
    55_000,
    "2026-01-01",
  );

  assert.ok(rate !== null);
  assert.ok(Math.abs(rate - 0.1) < 0.001, `expected about 0.1, got ${rate}`);
});

test("returns null without both outflows and a value", () => {
  assert.equal(investmentXirr([], 0, "2026-01-01"), null);
  assert.equal(investmentXirr([{ type: "BUY", amount: 1_000, tradeDate: "2025-01-01" }], 0, "2026-01-01"), null);
});
