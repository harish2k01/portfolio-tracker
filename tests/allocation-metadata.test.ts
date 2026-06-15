import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  inferMarketCapAllocation,
  inferSectorAllocation,
  parseStoredAllocation,
} from "../src/lib/allocation-metadata";
import { parseAmfiClassificationWorkbook } from "../src/lib/amfi-classification";

test("infers mutual-fund market-cap allocation from scheme category and name", () => {
  assert.deepEqual(
    inferMarketCapAllocation(
      "Nippon India Nifty Smallcap 250 Index Fund - Direct Plan",
      "Equity: Small Cap",
    ),
    [{ name: "Small Cap", value: 100 }],
  );
  assert.deepEqual(inferMarketCapAllocation("UTI Nifty 50 Index Fund"), [
    { name: "Large Cap", value: 100 },
  ]);
});

test("infers thematic mutual-fund sector allocation without inventing diversified sectors", () => {
  assert.deepEqual(inferSectorAllocation("Edelweiss US Technology Equity FoF"), [
    { name: "Technology", value: 100 },
  ]);
  assert.equal(inferSectorAllocation("Parag Parikh Flexi Cap Fund"), undefined);
});

test("validates stored allocation metadata before reuse", () => {
  assert.deepEqual(
    parseStoredAllocation([
      { name: "Large Cap", value: 70 },
      { name: "", value: 20 },
      { name: "Small Cap", value: "30" },
      { name: "Invalid", value: 0 },
    ]),
    [
      { name: "Large Cap", value: 70 },
      { name: "Small Cap", value: 30 },
    ],
  );
});

test("parses AMFI stock categorisation workbook by ISIN", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Average Market Capitalization"],
    [
      "Sr. No.",
      "Company name",
      "ISIN",
      "NSE Symbol",
      "Categorization as per SEBI Circular dated Oct 6, 2017",
    ],
    [1, "Example Large Ltd", "INE000A01001", "EXAMPLE", "Large Cap"],
    [2, "Example Mid Ltd", "INE000A01002", "EXMID", "Mid Cap"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const input = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  const values = parseAmfiClassificationWorkbook(input);

  assert.equal(values.get("INE000A01001"), "Large Cap");
  assert.equal(values.get("INE000A01002"), "Mid Cap");
});
