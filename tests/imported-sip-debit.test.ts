import assert from "node:assert/strict";
import test from "node:test";
import { inferImportedMutualFundDebitAmount } from "../src/lib/analytics";

test("recovers SIP debits from precise tradebook allocated values", () => {
  assert.deepEqual(
    [1499.93, 1499.926, 999.932, 4999.795].map((amount) =>
      inferImportedMutualFundDebitAmount(amount, "PRECISE"),
    ),
    [1500, 1500, 1000, 5000],
  );
});

test("recovers SIP debits from truncated whole-rupee order history values", () => {
  assert.deepEqual(
    [3999, 4999].map((amount) =>
      inferImportedMutualFundDebitAmount(amount, "TRUNCATED_WHOLE_RUPEE"),
    ),
    [4000, 5000],
  );
});
