import type { Asset, AssetType, TransactionType } from "@prisma/client";
import * as XLSX from "xlsx";
import { upsertAsset } from "@/lib/assets";
import { searchInvestments, type InvestmentSearchResult } from "@/lib/market-data";
import { prisma } from "@/lib/prisma";

type ImportSource = "mf-tradebook" | "mf-order-history" | "stock-order-history";

export type ParsedTrade = {
  source: ImportSource;
  externalId: string | null;
  assetName: string;
  assetType: AssetType;
  symbol?: string;
  isin?: string;
  exchange?: string;
  type: TransactionType;
  quantity: number;
  navOrPrice: number;
  amount: number;
  tradeDate: Date;
};

export type TradeImportSummary = {
  fileName: string;
  parsed: number;
  imported: number;
  skipped: number;
  failed: number;
  taggedSipTransactions: number;
  affectedAssetIds: string[];
  errors: string[];
};

export async function importTradeWorkbook(
  userId: string,
  fileName: string,
  input: ArrayBuffer,
): Promise<TradeImportSummary> {
  const trades = parseTradeWorkbook(input);
  const summary: TradeImportSummary = {
    fileName,
    parsed: trades.length,
    imported: 0,
    skipped: 0,
    failed: 0,
    taggedSipTransactions: 0,
    affectedAssetIds: [],
    errors: [],
  };

  for (const trade of trades) {
    try {
      const asset = await resolveImportedAsset(trade);
      const exists = await findExistingImportedTrade(userId, asset.id, trade);

      if (exists) {
        summary.skipped += 1;
        continue;
      }

      await prisma.transaction.create({
        data: {
          userId,
          assetId: asset.id,
          type: trade.type,
          amount: trade.amount,
          quantity: trade.quantity,
          navOrPrice: trade.navOrPrice,
          stampDuty: 0,
          tradeDate: trade.tradeDate,
          externalSource: trade.source,
          externalId: trade.externalId,
          importedAt: new Date(),
        },
      });
      summary.imported += 1;
      if (!summary.affectedAssetIds.includes(asset.id)) {
        summary.affectedAssetIds.push(asset.id);
      }
    } catch (caught) {
      summary.failed += 1;
      summary.errors.push(
        `${trade.assetName}: ${caught instanceof Error ? caught.message : "Unable to import row."}`,
      );
    }
  }

  return summary;
}

export function parseTradeWorkbook(input: ArrayBuffer): ParsedTrade[] {
  const workbook = XLSX.read(Buffer.from(input), { cellDates: false });
  return workbook.SheetNames.flatMap((sheetName) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
      blankrows: false,
      raw: false,
    });

    return parseSheetRows(rows);
  });
}

function parseSheetRows(rows: unknown[][]): ParsedTrade[] {
  const headerIndex = rows.findIndex((row) => {
    const keys = row.map(normalizeHeader);
    return (
      (keys.includes("symbol") && keys.includes("tradeid") && keys.includes("tradetype")) ||
      (keys.includes("stockname") && keys.includes("exchangeorderid")) ||
      (keys.includes("schemename") &&
        keys.includes("transactiontype") &&
        keys.includes("units") &&
        keys.includes("nav") &&
        keys.includes("amount"))
    );
  });

  if (headerIndex === -1) {
    return [];
  }

  const header = rows[headerIndex].map(normalizeHeader);
  const lookup = new Map(header.map((key, index) => [key, index]));
  const isMutualFundTradebook = lookup.has("tradeid") && lookup.has("tradetype");
  const isMutualFundOrderHistory = lookup.has("schemename") && lookup.has("transactiontype");
  const trades: ParsedTrade[] = [];

  for (const row of rows.slice(headerIndex + 1)) {
    const parsed = isMutualFundTradebook
      ? parseMutualFundTradebookRow(row, lookup)
      : isMutualFundOrderHistory
        ? parseMutualFundOrderHistoryRow(row, lookup)
        : parseStockRow(row, lookup);

    if (parsed) {
      trades.push(parsed);
    }
  }

  return trades;
}

function parseMutualFundTradebookRow(row: unknown[], lookup: Map<string, number>): ParsedTrade | null {
  const assetName = cleanDisplayName(cell(row, lookup, "symbol"));
  const quantity = Math.abs(numberCell(row, lookup, "quantity"));
  const navOrPrice = numberCell(row, lookup, "price");
  const tradeDate = dateCell(row, lookup, "tradedate");
  const tradeType = cell(row, lookup, "tradetype").toLowerCase();

  if (!assetName || !quantity || !navOrPrice || !tradeDate) {
    return null;
  }

  return {
    source: "mf-tradebook",
    externalId: cell(row, lookup, "tradeid") || cell(row, lookup, "orderid") || null,
    assetName,
    assetType: "MUTUAL_FUND",
    isin: normalizeIsin(cell(row, lookup, "isin")),
    exchange: cell(row, lookup, "exchange") || undefined,
    type: tradeType.includes("sell") || tradeType.includes("redeem") ? "SELL" : "LUMPSUM",
    quantity,
    navOrPrice,
    amount: roundCurrency(quantity * navOrPrice),
    tradeDate,
  };
}

function parseMutualFundOrderHistoryRow(row: unknown[], lookup: Map<string, number>): ParsedTrade | null {
  const assetName = cleanDisplayName(cell(row, lookup, "schemename"));
  const quantity = Math.abs(numberCell(row, lookup, "units"));
  const navOrPrice = numberCell(row, lookup, "nav");
  const amount = Math.abs(numberCell(row, lookup, "amount"));
  const tradeDate = dateCell(row, lookup, "date");
  const tradeType = cell(row, lookup, "transactiontype").toLowerCase();

  if (!assetName || !quantity || !navOrPrice || !amount || !tradeDate) {
    return null;
  }

  return {
    source: "mf-order-history",
    externalId: null,
    assetName,
    assetType: "MUTUAL_FUND",
    type: tradeType.includes("sell") || tradeType.includes("redeem") ? "SELL" : "LUMPSUM",
    quantity,
    navOrPrice,
    amount: roundCurrency(amount),
    tradeDate,
  };
}

function parseStockRow(row: unknown[], lookup: Map<string, number>): ParsedTrade | null {
  const status = cell(row, lookup, "orderstatus").toLowerCase();

  if (status && status !== "executed") {
    return null;
  }

  const assetName = cleanDisplayName(cell(row, lookup, "stockname"));
  const rawSymbol = cell(row, lookup, "symbol").toUpperCase();
  const exchange = cell(row, lookup, "exchange").toUpperCase();
  const quantity = Math.abs(numberCell(row, lookup, "quantity"));
  const amount = Math.abs(numberCell(row, lookup, "value"));
  const tradeDate = dateCell(row, lookup, "executiondateandtime");
  const navOrPrice = quantity ? roundNav(amount / quantity) : 0;

  if (!assetName || !rawSymbol || !quantity || !amount || !tradeDate || !navOrPrice) {
    return null;
  }

  return {
    source: "stock-order-history",
    externalId: cell(row, lookup, "exchangeorderid") || null,
    assetName,
    assetType: isEtfName(`${assetName} ${rawSymbol}`) ? "ETF" : "STOCK",
    symbol: yahooSymbol(rawSymbol, exchange),
    isin: normalizeIsin(cell(row, lookup, "isin")),
    exchange: exchange || undefined,
    type: cell(row, lookup, "type").toLowerCase() === "sell" ? "SELL" : "BUY",
    quantity,
    navOrPrice,
    amount: roundCurrency(amount),
    tradeDate,
  };
}

async function resolveImportedAsset(trade: ParsedTrade): Promise<Asset> {
  if (trade.isin) {
    const existingByIsin = await prisma.asset.findUnique({ where: { isin: trade.isin } });

    if (existingByIsin) {
      return existingByIsin;
    }
  }

  if (trade.assetType === "MUTUAL_FUND") {
    const resolved = await resolveMutualFundFromProvider(trade);

    if (resolved) {
      const asset = await upsertAsset(resolved);
      return trade.isin
        ? prisma.asset.update({
            where: { id: asset.id },
            data: { isin: trade.isin },
          })
        : asset;
    }

    const existingByName = await prisma.asset.findFirst({
      where: { type: "MUTUAL_FUND", name: trade.assetName },
    });

    if (existingByName) {
      return existingByName;
    }

    return prisma.asset.create({
      data: {
        name: trade.assetName,
        type: "MUTUAL_FUND",
        isin: trade.isin,
        exchange: trade.exchange,
        category: "Imported mutual fund",
      },
    });
  }

  const symbol = trade.symbol ?? yahooSymbol(trade.assetName, trade.exchange);

  return upsertAsset({
    name: trade.assetName,
    type: trade.assetType,
    symbol,
    isin: trade.isin,
    exchange: trade.exchange,
    category: trade.assetType === "ETF" ? "ETF" : "Equity",
  });
}

async function resolveMutualFundFromProvider(trade: ParsedTrade) {
  const candidates = await withFallbackTimeout(
    searchInvestments(`${trade.assetName} growth`),
    6000,
    [] as InvestmentSearchResult[],
  );
  const target = normalizeFundName(trade.assetName);
  const ranked = candidates
    .filter((candidate) => candidate.type === "MUTUAL_FUND" && candidate.schemeCode)
    .map((candidate) => ({
      candidate,
      score:
        similarityScore(target, normalizeFundName(candidate.name)) +
        (candidate.name.toLowerCase().includes("direct") ? 8 : 0) +
        (candidate.name.toLowerCase().includes("growth") ? 6 : 0) -
        (candidate.name.toLowerCase().includes("idcw") ? 10 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];

  if (!best || best.score < 10) {
    return null;
  }

  return {
    ...best.candidate,
    isin: trade.isin,
  };
}

async function findExistingImportedTrade(userId: string, assetId: string, trade: ParsedTrade) {
  if (trade.externalId) {
    const byExternalId = await prisma.transaction.findFirst({
      where: {
        userId,
        externalSource: trade.source,
        externalId: trade.externalId,
      },
    });

    if (byExternalId) {
      return byExternalId;
    }
  }

  return prisma.transaction.findFirst({
    where: {
      userId,
      assetId,
      type: trade.type === "SELL" ? "SELL" : { in: ["BUY", "LUMPSUM", "SIP_INSTALLMENT"] },
      tradeDate: trade.tradeDate,
      amount: trade.amount,
      quantity: trade.quantity,
      navOrPrice: trade.navOrPrice,
    },
  });
}

function cell(row: unknown[], lookup: Map<string, number>, key: string) {
  const index = lookup.get(key);

  if (index === undefined) {
    return "";
  }

  const value = row[index];
  return value === null || value === undefined ? "" : String(value).trim();
}

function numberCell(row: unknown[], lookup: Map<string, number>, key: string) {
  const value = Number(cell(row, lookup, key).replace(/,/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function dateCell(row: unknown[], lookup: Map<string, number>, key: string) {
  return parseTradeDate(cell(row, lookup, key));
}

function parseTradeDate(value: string) {
  if (!value) {
    return null;
  }

  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoDate) {
    return new Date(Date.UTC(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3])));
  }

  const indianDate = value.match(/^(\d{2})-(\d{2})-(\d{4})/);

  if (indianDate) {
    return new Date(Date.UTC(Number(indianDate[3]), Number(indianDate[2]) - 1, Number(indianDate[1])));
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cleanDisplayName(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (match) => match.toUpperCase())
    .replace(/\bIdcw\b/g, "IDCW")
    .replace(/\bEtf\b/g, "ETF")
    .replace(/\bNavi\b/g, "Navi")
    .replace(/\bHdfc\b/g, "HDFC")
    .replace(/\bIcici\b/g, "ICICI")
    .replace(/\bNifty\b/g, "Nifty")
    .replace(/\bPsu\b/g, "PSU")
    .replace(/\bUs\b/g, "US");
}

function normalizeIsin(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized || undefined;
}

function normalizeFundName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(direct|regular)\s+plan\b/g, "")
    .replace(/\b(growth|idcw|dividend|option|fund|scheme)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function similarityScore(left: string, right: string) {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  let score = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      score += 4;
    }
  }

  if (right.includes(left) || left.includes(right)) {
    score += 12;
  }

  return score;
}

function yahooSymbol(symbol: string, exchange?: string) {
  const normalized = symbol.trim().toUpperCase();

  if (normalized.endsWith(".NS") || normalized.endsWith(".BO")) {
    return normalized;
  }

  if (exchange?.toUpperCase() === "BSE") {
    return `${normalized}.BO`;
  }

  return `${normalized}.NS`;
}

function isEtfName(value: string) {
  return /\bETF\b|\bBEES\b/i.test(value);
}

function roundCurrency(value: number) {
  return Number(value.toFixed(3));
}

function roundNav(value: number) {
  return Number(value.toFixed(6));
}

function withFallbackTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
  return Promise.race<T>([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}
