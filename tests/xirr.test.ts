import assert from "node:assert/strict";
import test from "node:test";
import { calculateXirr } from "../src/lib/xirr";

test("calculates annualized XIRR for dated investment cash flows", () => {
  const xirr = calculateXirr([
    { amount: -10000, date: "2025-01-01" },
    { amount: 11200, date: "2026-01-01" },
  ]);

  assert.ok(xirr !== null);
  assert.equal(Number((xirr * 100).toFixed(2)), 12);
});

test("returns null when cash flows cannot produce an XIRR", () => {
  assert.equal(
    calculateXirr([
      { amount: -10000, date: "2025-01-01" },
      { amount: -5000, date: "2025-02-01" },
    ]),
    null,
  );
  assert.equal(calculateXirr([{ amount: 10000, date: "2025-01-01" }]), null);
});

test("supports multiple investments and partial redemptions", () => {
  const xirr = calculateXirr([
    { amount: -5000, date: "2025-01-01" },
    { amount: -5000, date: "2025-07-01" },
    { amount: 3000, date: "2025-10-01" },
    { amount: 8500, date: "2026-01-01" },
  ]);

  assert.ok(xirr !== null);
  assert.equal(Number((xirr * 100).toFixed(2)), 22.41);
});
