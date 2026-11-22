import assert from "node:assert/strict";
import test from "node:test";
import { parseAmfiDate, parseNavAll } from "../src/lib/amfi-nav";

const sample = [
  "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date",
  " ",
  "Open Ended Schemes(Equity Scheme - Flexi Cap Fund)",
  " ",
  "PPFAS Mutual Fund",
  " ",
  "122639;INF879O01027;-;Parag Parikh Flexi Cap Fund;Direct Plan;Growth;95.4585;20-Nov-2026",
  "135763;INF846K01WS2;INF846K01WQ6;Axis Children's Fund;Direct Plan;IDCW Option;29.1887;20-Nov-2026",
  "999001;-;-;Wound Up Fund;Direct Plan;Growth;N.A.;01-Jan-2020",
  "100027;INF209K01AJ8;-;Older Six Column Fund - Growth;35.12;19-Nov-2026",
].join("\r\n");

test("parses AMFI dates", () => {
  assert.equal(parseAmfiDate("20-Nov-2026"), "2026-11-20");
  assert.equal(parseAmfiDate("1-Feb-2026"), "2026-02-01");
  assert.equal(parseAmfiDate("2026-11-20"), null);
});

test("indexes NAV rows by scheme code and skips headings and unusable rows", () => {
  const navs = parseNavAll(sample);

  assert.deepEqual([...navs.keys()], ["122639", "135763", "100027"]);
  assert.deepEqual(navs.get("122639"), {
    schemeCode: "122639",
    name: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
    nav: 95.4585,
    date: "2026-11-20",
    isins: ["INF879O01027"],
  });
  assert.deepEqual(navs.get("135763")?.isins, ["INF846K01WS2", "INF846K01WQ6"]);
  assert.equal(navs.get("100027")?.name, "Older Six Column Fund - Growth");
  assert.equal(navs.get("100027")?.nav, 35.12);
});
