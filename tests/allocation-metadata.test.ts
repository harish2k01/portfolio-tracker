import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  aggregateWeightedAllocation,
  inferMarketCapAllocation,
  inferSectorAllocation,
  parseStoredAllocation,
} from "../src/lib/allocation-metadata";
import { parseAmfiClassificationWorkbook } from "../src/lib/amfi-classification";
import {
  buildGrowwPortfolioAllocations,
  parseGrowwFundPage,
} from "../src/lib/groww-fund-data";

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
  assert.equal(values.get("company:example large"), "Large Cap");
});

test("parses Groww fund page Next.js payload", () => {
  const html = `
    <html>
      <script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{"mfServerSideData":{"scheme_code":"120716","scheme_name":"UTI Nifty 50","holdings":[]}}}}
      </script>
    </html>
  `;
  const data = parseGrowwFundPage(html);

  assert.equal(data?.scheme_code, "120716");
  assert.equal(data?.scheme_name, "UTI Nifty 50");
});

test("builds Groww look-through fund allocations from underlying holdings", async () => {
  const allocations = await buildGrowwPortfolioAllocations(
    [
      {
        company_name: "Example Large Ltd",
        nature_name: "EQUITY",
        sector_name: "Financial",
        corpus_per: 50,
      },
      {
        company_name: "Example Mid Ltd",
        nature_name: "EQUITY",
        sector_name: "Technology",
        corpus_per: 30,
      },
      {
        company_name: "Net Current Assets",
        nature_name: "CASH",
        sector_name: "Unspecified",
        corpus_per: 10,
      },
      {
        company_name: "Treasury Bill",
        nature_name: "DEBT",
        sector_name: "Unspecified",
        corpus_per: 10,
      },
    ],
    "Example Flexi Cap Fund",
    "Equity: Flexi Cap",
    async (companyName) =>
      companyName.includes("Large")
        ? "Large Cap"
        : companyName.includes("Mid")
          ? "Mid Cap"
          : null,
  );

  assert.deepEqual(allocations.assetAllocation, [
    { name: "Equity", value: 80 },
    { name: "Debt", value: 20 },
  ]);
  assert.deepEqual(allocations.sectorAllocation, [
    { name: "Financial", value: 50 },
    { name: "Technology", value: 30 },
  ]);
  assert.deepEqual(allocations.marketCapAllocation, [
    { name: "Large Cap", value: 50 },
    { name: "Mid Cap", value: 30 },
  ]);
});

test("weighted allocation preserves partial coverage and normalizes small overages", () => {
  assert.deepEqual(
    aggregateWeightedAllocation([
      { amount: 1000, allocation: [{ name: "Financial", value: 80 }] },
      { amount: 1000, allocation: undefined },
    ]),
    [{ name: "Financial", amount: 800, value: 100 }],
  );
  assert.deepEqual(
    aggregateWeightedAllocation([
      {
        amount: 1000,
        allocation: [
          { name: "Large Cap", value: 60 },
          { name: "Mid Cap", value: 40.2 },
        ],
      },
    ]).map(({ name, value }) => ({ name, value })),
    [
      { name: "Large Cap", value: 59.88 },
      { name: "Mid Cap", value: 40.12 },
    ],
  );
});
