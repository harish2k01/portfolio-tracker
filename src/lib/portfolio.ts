import type { AssetType, SipFrequency, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assetIdentity, resolveAssetSchemeCode } from "@/lib/assets";
import {
  aggregateWeightedAllocation,
  inferMarketCapAllocation,
  inferSectorAllocation,
  parseStoredAllocation,
} from "@/lib/allocation-metadata";
import {
  fetchHistoricalInvestmentPrices,
  fetchInvestmentDetails,
  resolveMutualFundScheme,
  type DatedPricePoint,
} from "@/lib/market-data";
import {
  calculateStampDuty as calculateClientStampDuty,
  calculateUnits as calculateClientUnits,
} from "@/lib/analytics";

export type HoldingRow = {
  assetId: string;
  name: string;
  type: AssetType;
  assetClass: "Equity" | "Debt" | "Commodities";
  symbol?: string | null;
  isin?: string | null;
  schemeCode?: string | null;
  category?: string | null;
  investedAmount: number;
  quantity: number;
  currentPrice: number | null;
  currentValue: number;
  gain: number;
  gainPercent: number;
  assetAllocation?: Array<{ name: string; value: number }>;
  sectorAllocation?: Array<{ name: string; value: number }>;
  marketCapAllocation?: Array<{ name: string; value: number }>;
  fundHoldings?: Array<{ name: string; weight: number; sector?: string; instrument?: string }>;
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function monthlyEquivalent(amount: number, frequency: SipFrequency) {
  if (frequency === "WEEKLY") {
    return amount * 4.33;
  }

  if (frequency === "QUARTERLY") {
    return amount / 3;
  }

  return amount;
}

export function calculateStampDuty(amount: number, assetType?: AssetType | null, type?: TransactionType | null) {
  return calculateClientStampDuty(amount, assetType ?? null, type ?? null);
}

export function calculateUnits(amount: number, price: number, stampDuty = 0, precision = 3) {
  return calculateClientUnits(amount, price, stampDuty, precision);
}

export function nextSipDueDate(startDate: Date, frequency: SipFrequency, today = new Date()) {
  const next = new Date(startDate);
  next.setHours(0, 0, 0, 0);
  const target = new Date(today);
  target.setHours(0, 0, 0, 0);

  while (next < target) {
    if (frequency === "WEEKLY") {
      next.setDate(next.getDate() + 7);
    } else if (frequency === "QUARTERLY") {
      next.setMonth(next.getMonth() + 3);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
  }

  return next;
}

export async function getUserHoldings(userId: string): Promise<HoldingRow[]> {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: { asset: true },
    orderBy: { tradeDate: "asc" },
  });
  const grouped = new Map<string, HoldingRow>();

  for (const transaction of transactions) {
    const row =
      grouped.get(transaction.assetId) ??
      ({
        assetId: transaction.assetId,
        name: transaction.asset.name,
        type: transaction.asset.type,
        assetClass: classifyAssetClass(
          transaction.asset.type,
          transaction.asset.name,
          transaction.asset.category,
        ),
        symbol: transaction.asset.symbol,
        isin: transaction.asset.isin,
        schemeCode: transaction.asset.schemeCode,
        category: transaction.asset.category,
        investedAmount: 0,
        quantity: 0,
        currentPrice: null,
        currentValue: 0,
        gain: 0,
        gainPercent: 0,
        fundHoldings: parseStoredFundHoldings(transaction.asset.holdings),
        sectorAllocation: parseStoredAllocation(transaction.asset.sectorAllocation),
        marketCapAllocation: parseStoredAllocation(transaction.asset.marketCapAllocation),
      } satisfies HoldingRow);

    const quantity = Number(transaction.quantity);
    const amount = Number(transaction.amount);
    const navOrPrice = Number(transaction.navOrPrice);

    if (Number.isFinite(navOrPrice) && navOrPrice > 0) {
      row.currentPrice = navOrPrice;
    }

    if (transaction.type === "SELL") {
      const averageCost = row.quantity > 0 ? row.investedAmount / row.quantity : 0;
      const soldQuantity = Math.min(quantity, row.quantity);
      row.investedAmount = Math.max(row.investedAmount - averageCost * soldQuantity, 0);
      row.quantity = Math.max(row.quantity - quantity, 0);
    } else {
      row.quantity += quantity;
      row.investedAmount += amount;
    }

    grouped.set(transaction.assetId, row);
  }

  const rows = [...grouped.values()].filter((row) => row.quantity > 0.000001);

  return Promise.all(
    rows.map(async (row) => {
      try {
        const schemeCode =
          row.type === "MUTUAL_FUND" && !row.schemeCode
            ? await resolveAndPersistMutualFundScheme(row.assetId, row.name)
            : row.schemeCode;
        const quote = await withTimeout(
          fetchInvestmentDetails({
            type: row.type,
            schemeCode,
            symbol: row.symbol,
            isin: row.isin,
          }),
          25000,
        );
        const currentPrice = quote.value ?? row.currentPrice;
        const currentValue = currentPrice ? row.quantity * currentPrice : 0;
        const netInvested = Math.max(row.investedAmount, 0);
        const gain = currentValue - netInvested;
        const category = quote.category ?? row.category;
        const assetClass = classifyAssetClass(row.type, row.name, category);
        const assetAllocation =
          quote.assetAllocation ??
          (row.type === "MUTUAL_FUND" ? undefined : [{ name: assetClass, value: 100 }]);
        const sectorAllocation =
          quote.sectorAllocation ??
          row.sectorAllocation ??
          (row.type === "MUTUAL_FUND" ? undefined : inferSectorAllocation(row.name, category));
        const marketCapAllocation =
          quote.marketCapAllocation ??
          row.marketCapAllocation ??
          (row.type === "MUTUAL_FUND" ? undefined : inferMarketCapAllocation(row.name, category));
        const fundHoldings = quote.holdings ?? row.fundHoldings;

        if (
          (quote.holdings?.length && !row.fundHoldings?.length) ||
          (quote.sectorAllocation?.length && !row.sectorAllocation?.length) ||
          (quote.marketCapAllocation?.length && !row.marketCapAllocation?.length)
        ) {
          await persistAllocationMetadata(row.assetId, {
            holdings: row.fundHoldings?.length ? undefined : quote.holdings,
            sectorAllocation: row.sectorAllocation?.length ? undefined : quote.sectorAllocation,
            marketCapAllocation: row.marketCapAllocation?.length
              ? undefined
              : quote.marketCapAllocation,
          });
        }

        return {
          ...row,
          category,
          assetClass,
          investedAmount: netInvested,
          currentPrice,
          currentValue,
          gain,
          gainPercent: netInvested ? (gain / netInvested) * 100 : 0,
          schemeCode,
          assetAllocation,
          sectorAllocation,
          marketCapAllocation,
          fundHoldings,
        };
      } catch {
        const currentPrice = row.currentPrice;
        const currentValue = currentPrice ? row.quantity * currentPrice : 0;
        const netInvested = Math.max(row.investedAmount, 0);
        const gain = currentValue - netInvested;

        return {
          ...row,
          investedAmount: netInvested,
          currentValue,
          gain,
          gainPercent: netInvested ? (gain / netInvested) * 100 : 0,
          sectorAllocation:
            row.sectorAllocation ??
            (row.type === "MUTUAL_FUND" ? undefined : inferSectorAllocation(row.name, row.category)),
          marketCapAllocation:
            row.marketCapAllocation ??
            (row.type === "MUTUAL_FUND" ? undefined : inferMarketCapAllocation(row.name, row.category)),
          fundHoldings: row.fundHoldings,
        };
      }
    }),
  );
}

export async function getDashboard(userId: string) {
  const [holdings, sips, timeline, realizedGain] = await Promise.all([
    getUserHoldings(userId),
    prisma.sip.findMany({
      where: { userId },
      include: { asset: true },
      orderBy: { startDate: "desc" },
    }),
    getPortfolioTimeline(userId),
    getRealizedGain(userId),
  ]);

  const investedAmount = holdings.reduce((sum, row) => sum + row.investedAmount, 0);
  const totalValue = holdings.reduce((sum, row) => sum + row.currentValue, 0);
  const gains = totalValue - investedAmount;
  const monthlySipTotal = sips
    .filter((sip) => sip.status === "ACTIVE")
    .reduce((sum, sip) => sum + monthlyEquivalent(Number(sip.amount), sip.frequency), 0);
  const assetAllocation = allocationFromHoldings(holdings);
  const sectorAllocation = weightedProviderAllocation(holdings, "sectorAllocation");
  const marketCapSplit = weightedProviderAllocation(holdings, "marketCapAllocation");
  const stockConcentration = stockConcentrationFromHoldings(holdings);

  return {
    summary: {
      totalValue,
      investedAmount,
      gains,
      gainsPercent: investedAmount ? (gains / investedAmount) * 100 : 0,
      realizedGain,
      monthlySipTotal,
      activeSipCount: sips.filter((sip) => sip.status === "ACTIVE").length,
      holdingsCount: holdings.length,
    },
    holdings,
    sips: sips.map((sip) => ({
      id: sip.id,
      amount: Number(sip.amount),
      frequency: sip.frequency,
      startDate: sip.startDate.toISOString().slice(0, 10),
      nextDueDate: sip.nextDueDate?.toISOString().slice(0, 10) ?? null,
      status: sip.status,
      asset: serializeAsset(sip.asset),
    })),
    timeline: withCurrentTimelinePoint(timeline, investedAmount, totalValue),
    allocations: {
      assets: assetAllocation,
      sectors: sectorAllocation,
      marketCap: marketCapSplit,
      stockConcentration,
    },
  };
}

async function getRealizedGain(userId: string) {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    select: {
      assetId: true,
      type: true,
      amount: true,
      quantity: true,
    },
    orderBy: [{ tradeDate: "asc" }, { createdAt: "asc" }],
  });
  const positions = new Map<string, { quantity: number; costBasis: number }>();
  let realizedGain = 0;

  for (const transaction of transactions) {
    const position = positions.get(transaction.assetId) ?? { quantity: 0, costBasis: 0 };
    const quantity = Number(transaction.quantity);
    const amount = Number(transaction.amount);

    if (transaction.type === "SELL") {
      const soldQuantity = Math.min(Math.max(quantity, 0), position.quantity);
      const averageCost = position.quantity > 0 ? position.costBasis / position.quantity : 0;

      realizedGain += amount - averageCost * soldQuantity;
      position.quantity = Math.max(position.quantity - soldQuantity, 0);
      position.costBasis = Math.max(position.costBasis - averageCost * soldQuantity, 0);
    } else {
      position.quantity += quantity;
      position.costBasis += amount;
    }

    positions.set(transaction.assetId, position);
  }

  return Number(realizedGain.toFixed(2));
}

async function getPortfolioTimeline(userId: string) {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: { asset: true },
    orderBy: [{ tradeDate: "asc" }, { createdAt: "asc" }],
  });

  if (!transactions.length) {
    return [];
  }

  const firstTradeDate = transactions[0].tradeDate;
  const startDate = startOfDay(firstTradeDate);
  const endDate = startOfDay(new Date());
  const transactionsByDate = new Map<string, typeof transactions>();
  const assetsById = new Map<string, (typeof transactions)[number]["asset"]>();
  const priceSeriesByAsset = new Map<string, DatedPricePoint[]>();
  const allDates = new Set<string>();

  for (const transaction of transactions) {
    const date = transaction.tradeDate.toISOString().slice(0, 10);
    const list = transactionsByDate.get(date) ?? [];
    list.push(transaction);
    transactionsByDate.set(date, list);
    assetsById.set(transaction.assetId, transaction.asset);
    allDates.add(date);
  }

  allDates.add(endDate.toISOString().slice(0, 10));
  addTimelineDateRange(allDates, startDate, endDate);

  await Promise.all(
    [...assetsById.entries()].map(async ([assetId, asset]) => {
      const tradePrices = transactions
        .filter((transaction) => transaction.assetId === assetId)
        .map((transaction) => ({
          date: transaction.tradeDate.toISOString().slice(0, 10),
          dateValue: startOfDay(transaction.tradeDate).getTime(),
          value: Number(transaction.navOrPrice),
        }))
        .filter((point) => Number.isFinite(point.value) && point.value > 0);

      try {
        const schemeCode =
          asset.type === "MUTUAL_FUND" && !asset.schemeCode
            ? await resolveAssetSchemeCode(asset)
            : asset.schemeCode;
        const providerPrices = await withFallbackTimeout(
          fetchHistoricalInvestmentPrices({
            type: asset.type,
            schemeCode,
            symbol: asset.symbol,
            startDate,
            endDate: addDays(endDate, 1),
          }),
          8000,
          [],
        );
        const merged = mergePriceSeries([...providerPrices, ...tradePrices]);

        priceSeriesByAsset.set(assetId, merged);

        for (const point of merged) {
          if (point.dateValue >= startDate.getTime() && point.dateValue <= endDate.getTime()) {
            allDates.add(point.date);
          }
        }
      } catch {
        priceSeriesByAsset.set(assetId, mergePriceSeries(tradePrices));
      }
    }),
  );

  const dateList = [...allDates].sort();
  const unitsByAsset = new Map<string, number>();
  const investedByAsset = new Map<string, number>();

  return dateList
    .map((date) => {
      for (const transaction of transactionsByDate.get(date) ?? []) {
        const assetId = transaction.assetId;
        const quantity = Number(transaction.quantity);
        const amount = Number(transaction.amount);
        const previousUnits = unitsByAsset.get(assetId) ?? 0;
        const previousInvested = investedByAsset.get(assetId) ?? 0;

        if (transaction.type === "SELL") {
          const averageCost = previousUnits > 0 ? previousInvested / previousUnits : 0;
          const soldQuantity = Math.min(quantity, previousUnits);
          unitsByAsset.set(assetId, Math.max(previousUnits - quantity, 0));
          investedByAsset.set(assetId, Math.max(previousInvested - averageCost * soldQuantity, 0));
        } else {
          unitsByAsset.set(assetId, previousUnits + quantity);
          investedByAsset.set(assetId, previousInvested + amount);
        }
      }

      const invested = [...investedByAsset.values()].reduce((sum, value) => sum + value, 0);
      const dateValue = new Date(`${date}T00:00:00.000Z`).getTime();
      const current = [...unitsByAsset.entries()].reduce((sum, [assetId, units]) => {
        return sum + units * priceOnOrBefore(priceSeriesByAsset.get(assetId) ?? [], dateValue);
      }, 0);

      return {
        date,
        invested: Number(invested.toFixed(2)),
        current: Number(current.toFixed(2)),
      };
    })
    .filter((point) => point.invested > 0 || point.current > 0);
}

function mergePriceSeries(points: DatedPricePoint[]) {
  const byDate = new Map<string, DatedPricePoint>();

  for (const point of points) {
    if (Number.isFinite(point.value) && point.value > 0) {
      byDate.set(point.date, point);
    }
  }

  return [...byDate.values()].sort((a, b) => a.dateValue - b.dateValue);
}

function priceOnOrBefore(points: DatedPricePoint[], dateValue: number) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].dateValue <= dateValue) {
      return points[index].value;
    }
  }

  return 0;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addTimelineDateRange(dates: Set<string>, startDate: Date, endDate: Date) {
  const cursor = startOfDay(startDate);
  const finalDate = startOfDay(endDate);

  while (cursor <= finalDate) {
    dates.add(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
}

function withFallbackTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
  return Promise.race<T>([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}

function withCurrentTimelinePoint(
  timeline: Array<{ date: string; invested: number; current: number }>,
  invested: number,
  current: number,
) {
  if (!timeline.length) {
    return [];
  }

  const today = new Date().toISOString().slice(0, 10);
  const finalPoint = {
    date: today,
    invested: Number(invested.toFixed(2)),
    current: Number(current.toFixed(2)),
  };

  if (timeline.at(-1)?.date === today) {
    return [...timeline.slice(0, -1), finalPoint];
  }

  return [...timeline, finalPoint];
}

export async function getUserAssetTransactions(userId: string, assetId: string) {
  return prisma.transaction.findMany({
    where: { userId, assetId },
    include: { asset: true, sip: true },
    orderBy: { tradeDate: "desc" },
  });
}

export async function getUserSipTransactions(userId: string, sipId: string) {
  return prisma.transaction.findMany({
    where: { userId, sipId },
    include: { asset: true },
    orderBy: { tradeDate: "desc" },
  });
}

export function serializeTransaction(transaction: {
  id: string;
  type: TransactionType;
  amount: unknown;
  quantity: unknown;
  navOrPrice: unknown;
  stampDuty: unknown;
  tradeDate: Date;
  sipId: string | null;
  asset: Parameters<typeof serializeAsset>[0];
}) {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: Number(transaction.amount),
    quantity: Number(transaction.quantity),
    navOrPrice: Number(transaction.navOrPrice),
    stampDuty: Number(transaction.stampDuty),
    tradeDate: transaction.tradeDate.toISOString().slice(0, 10),
    asset: serializeAsset(transaction.asset),
    sipId: transaction.sipId,
  };
}

export function serializeAsset(asset: {
  id: string;
  name: string;
  type: AssetType;
  symbol: string | null;
  schemeCode: string | null;
  exchange: string | null;
  category: string | null;
  amc: string | null;
  sectorAllocation?: unknown;
  marketCapAllocation?: unknown;
  holdings?: unknown;
}) {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    symbol: asset.symbol,
    schemeCode: asset.schemeCode,
    exchange: asset.exchange,
    category: asset.category,
    amc: asset.amc,
    identity: assetIdentity(asset),
    sectorAllocation: parseStoredAllocation(asset.sectorAllocation),
    marketCapAllocation: parseStoredAllocation(asset.marketCapAllocation),
  };
}

function parseStoredFundHoldings(value: unknown): HoldingRow["fundHoldings"] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const points: NonNullable<HoldingRow["fundHoldings"]> = [];

  for (const point of value) {
    if (!point || typeof point !== "object") {
      continue;
    }

    const candidate = point as {
      name?: unknown;
      weight?: unknown;
      sector?: unknown;
      instrument?: unknown;
    };
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const weight = Number(candidate.weight);

    if (!name || !Number.isFinite(weight) || weight <= 0) {
      continue;
    }

    points.push({
      name,
      weight,
      ...(typeof candidate.sector === "string" ? { sector: candidate.sector } : {}),
      ...(typeof candidate.instrument === "string" ? { instrument: candidate.instrument } : {}),
    });
  }

  return points.length ? points : undefined;
}

function allocationFromHoldings(rows: HoldingRow[]) {
  return aggregateWeightedAllocation(
    rows.map((row) => ({
      amount: allocationBasis(row),
      allocation: row.assetAllocation?.length
        ? row.assetAllocation
        : [{ name: row.assetClass, value: 100 }],
    })),
  );
}

function allocationBasis(row: Pick<HoldingRow, "currentValue" | "investedAmount">) {
  return row.currentValue > 0 ? row.currentValue : row.investedAmount;
}

function stockConcentrationFromHoldings(rows: HoldingRow[]) {
  const groups = new Map<string, { name: string; amount: number }>();

  for (const row of rows) {
    const amount = allocationBasis(row);

    if (amount <= 0) {
      continue;
    }

    if (row.type === "STOCK") {
      addStockExposure(groups, row.name, amount);
      continue;
    }

    const stockHoldings = row.fundHoldings?.filter(isStockUnderlyingHolding) ?? [];

    if (!stockHoldings.length) {
      continue;
    }

    const totalWeight = stockHoldings.reduce((sum, holding) => sum + holding.weight, 0);
    const denominator = totalWeight > 100 ? totalWeight : 100;

    for (const holding of stockHoldings) {
      addStockExposure(groups, holding.name, amount * (holding.weight / denominator));
    }
  }

  const totalStockExposure = [...groups.values()].reduce((sum, point) => sum + point.amount, 0);

  if (!totalStockExposure) {
    return [];
  }

  return [...groups.values()]
    .map((point) => ({
      name: point.name,
      amount: Number(point.amount.toFixed(2)),
      value: Number(((point.amount / totalStockExposure) * 100).toFixed(2)),
    }))
    .filter((point) => point.value > 0)
    .sort((left, right) => right.value - left.value);
}

function addStockExposure(groups: Map<string, { name: string; amount: number }>, name: string, amount: number) {
  const cleanedName = normalizeStockName(name);

  if (!cleanedName || amount <= 0) {
    return;
  }

  const key = cleanedName.toLowerCase();
  const current = groups.get(key);
  groups.set(key, {
    name: current?.name ?? cleanedName,
    amount: (current?.amount ?? 0) + amount,
  });
}

function isStockUnderlyingHolding(holding: { name: string; instrument?: string }) {
  const text = `${holding.name} ${holding.instrument ?? ""}`.toLowerCase();

  if (/repo|treps|cash|net current|receivable|payable|margin|collateral|bill|bond|debenture|government securit|t-bill|treasury/i.test(text)) {
    return false;
  }

  if (holding.instrument) {
    return /equity|stock|foreign|adr|gdr/i.test(holding.instrument);
  }

  return true;
}

function normalizeStockName(name: string) {
  return name
    .replace(/\s+/g, " ")
    .replace(/\b(limited|ltd\.?|inc\.?|corp\.?|corporation|company|co\.)$/i, (match) =>
      /^ltd/i.test(match) ? "Ltd" : match.trim(),
    )
    .trim();
}

function classifyAssetClass(
  type: AssetType,
  name: string,
  category?: string | null,
): "Equity" | "Debt" | "Commodities" {
  const text = `${name} ${category ?? ""}`.toLowerCase();

  if (/gold|silver|commodity|commodities|metal|metals/.test(text)) {
    return "Commodities";
  }

  if (
    /debt|liquid|overnight|gilt|bond|income|duration|money market|corporate bond|credit risk|floater|ultra short|low duration|banking & psu|banking and psu/.test(
      text,
    )
  ) {
    return "Debt";
  }

  if (type === "STOCK" || type === "ETF" || type === "MUTUAL_FUND") {
    return "Equity";
  }

  return "Equity";
}

async function persistAllocationMetadata(
  assetId: string,
  metadata: {
    holdings?: Array<{ name: string; weight: number; sector?: string; instrument?: string }>;
    sectorAllocation?: Array<{ name: string; value: number }>;
    marketCapAllocation?: Array<{ name: string; value: number }>;
  },
) {
  try {
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        ...(metadata.holdings?.length ? { holdings: metadata.holdings } : {}),
        ...(metadata.sectorAllocation?.length
          ? { sectorAllocation: metadata.sectorAllocation }
          : {}),
        ...(metadata.marketCapAllocation?.length
          ? { marketCapAllocation: metadata.marketCapAllocation }
          : {}),
      },
    });
  } catch {
    // Allocation enrichment is best-effort and must not block the dashboard.
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Provider timed out.")), timeoutMs);
    }),
  ]);
}

async function resolveAndPersistMutualFundScheme(assetId: string, name: string) {
  const resolved = await resolveMutualFundScheme(name);

  if (!resolved?.schemeCode) {
    return null;
  }

  const existing = await prisma.asset.findUnique({
    where: { schemeCode: resolved.schemeCode },
    select: { id: true },
  });

  if (!existing || existing.id === assetId) {
    try {
      await prisma.asset.update({
        where: { id: assetId },
        data: {
          schemeCode: resolved.schemeCode,
          name: resolved.name,
          category: resolved.category,
          amc: resolved.amc,
        },
      });
    } catch {
      // Concurrent dashboard requests can resolve the same imported scheme.
    }
  }

  return resolved.schemeCode;
}

function weightedProviderAllocation(
  rows: HoldingRow[],
  key: "sectorAllocation" | "marketCapAllocation",
) {
  return aggregateWeightedAllocation(
    rows.map((row) => ({
      amount: allocationBasis(row),
      allocation: row[key]?.map((point) => ({
        name: normalizeAllocationName(point.name, key),
        value: point.value,
      })),
    })),
  );
}

function normalizeAllocationName(
  name: string,
  key: "sectorAllocation" | "marketCapAllocation",
) {
  const cleaned = name.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  if (key === "marketCapAllocation") {
    if (/\blarge\b/i.test(cleaned)) {
      return "Large Cap";
    }

    if (/\bmid\b/i.test(cleaned)) {
      return "Mid Cap";
    }

    if (/\bsmall\b|\bmicro\b/i.test(cleaned)) {
      return "Small Cap";
    }
  }

  return cleaned
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function getAvailableUnits(userId: string, assetId: string) {
  const transactions = await prisma.transaction.findMany({
    where: { userId, assetId },
  });

  return transactions.reduce((sum, transaction) => {
    const quantity = Number(transaction.quantity);
    return transaction.type === "SELL" ? sum - quantity : sum + quantity;
  }, 0);
}

export function isBuyType(type: TransactionType) {
  return type === "BUY" || type === "LUMPSUM" || type === "SIP_INSTALLMENT";
}
