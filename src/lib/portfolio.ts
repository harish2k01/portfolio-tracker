import type { AssetType, SipFrequency, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assetIdentity } from "@/lib/assets";
import { fetchInvestmentDetails } from "@/lib/market-data";
import {
  calculateNetInvestmentAmount,
  calculateStampDuty as calculateClientStampDuty,
  calculateUnits as calculateClientUnits,
} from "@/lib/analytics";

export type HoldingRow = {
  assetId: string;
  name: string;
  type: AssetType;
  assetClass: "Equity" | "Debt" | "Commodities";
  symbol?: string | null;
  schemeCode?: string | null;
  category?: string | null;
  investedAmount: number;
  quantity: number;
  currentPrice: number | null;
  currentValue: number;
  gain: number;
  gainPercent: number;
  sectorAllocation?: Array<{ name: string; value: number }>;
  marketCapAllocation?: Array<{ name: string; value: number }>;
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
  const grouped = new Map<string, HoldingRow & { realizedOutflow: number }>();

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
        schemeCode: transaction.asset.schemeCode,
        category: transaction.asset.category,
        investedAmount: 0,
        quantity: 0,
        currentPrice: null,
        currentValue: 0,
        gain: 0,
        gainPercent: 0,
        realizedOutflow: 0,
      } satisfies HoldingRow & { realizedOutflow: number });

    const quantity = Number(transaction.quantity);
    const amount = Number(transaction.amount);
    const stampDuty = Number(transaction.stampDuty);

    if (transaction.type === "SELL") {
      row.quantity -= quantity;
      row.realizedOutflow += amount;
    } else {
      row.quantity += quantity;
      row.investedAmount += calculateNetInvestmentAmount(amount, stampDuty);
    }

    grouped.set(transaction.assetId, row);
  }

  const rows = [...grouped.values()].filter((row) => row.quantity > 0.000001);

  return Promise.all(
    rows.map(async (row) => {
      try {
        const quote = await withTimeout(
          fetchInvestmentDetails({
            type: row.type,
            schemeCode: row.schemeCode,
            symbol: row.symbol,
          }),
          3500,
        );
        const currentPrice = quote.value;
        const currentValue = currentPrice ? row.quantity * currentPrice : 0;
        const netInvested = Math.max(row.investedAmount - row.realizedOutflow, 0);
        const gain = currentValue - netInvested;
        const category = quote.category ?? row.category;
        const assetClass = classifyAssetClass(row.type, row.name, category);

        return {
          ...row,
          category,
          assetClass,
          investedAmount: netInvested,
          currentPrice,
          currentValue,
          gain,
          gainPercent: netInvested ? (gain / netInvested) * 100 : 0,
          sectorAllocation: quote.sectorAllocation ?? inferSectorAllocation(row.name, category),
          marketCapAllocation: quote.marketCapAllocation ?? inferMarketCapAllocation(row.name, category),
        };
      } catch {
        return {
          ...row,
          sectorAllocation: inferSectorAllocation(row.name, row.category),
          marketCapAllocation: inferMarketCapAllocation(row.name, row.category),
        };
      }
    }),
  );
}

export async function getDashboard(userId: string) {
  const [holdings, sips, watchlistItems, timeline] = await Promise.all([
    getUserHoldings(userId),
    prisma.sip.findMany({
      where: { userId },
      include: { asset: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.watchlistItem.findMany({
      where: { userId },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
    }),
    getPortfolioTimeline(userId),
  ]);

  const investedAmount = holdings.reduce((sum, row) => sum + row.investedAmount, 0);
  const totalValue = holdings.reduce((sum, row) => sum + row.currentValue, 0);
  const gains = totalValue - investedAmount;
  const monthlySipTotal = sips
    .filter((sip) => sip.status === "ACTIVE")
    .reduce((sum, sip) => sum + monthlyEquivalent(Number(sip.amount), sip.frequency), 0);
  const dueSips = await getDueSips(userId);
  const assetAllocation = allocationFromHoldings(holdings, "assetClass");
  const sectorAllocation = weightedProviderAllocation(holdings, "sectorAllocation");
  const marketCapSplit = weightedProviderAllocation(holdings, "marketCapAllocation");

  return {
    summary: {
      totalValue,
      investedAmount,
      gains,
      gainsPercent: investedAmount ? (gains / investedAmount) * 100 : 0,
      monthlySipTotal,
      activeSipCount: sips.filter((sip) => sip.status === "ACTIVE").length,
      holdingsCount: holdings.length,
      watchlistCount: watchlistItems.length,
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
    dueSips,
    timeline: withCurrentTimelinePoint(timeline, investedAmount, totalValue),
    allocations: {
      assets: assetAllocation,
      sectors: sectorAllocation,
      marketCap: marketCapSplit,
    },
  };
}

async function getPortfolioTimeline(userId: string) {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: [{ tradeDate: "asc" }, { createdAt: "asc" }],
  });
  const unitsByAsset = new Map<string, number>();
  const lastPriceByAsset = new Map<string, number>();
  const points = new Map<string, { date: string; invested: number; current: number }>();
  let invested = 0;

  for (const transaction of transactions) {
    const assetId = transaction.assetId;
    const quantity = Number(transaction.quantity);
    const amount = Number(transaction.amount);
    const stampDuty = Number(transaction.stampDuty);
    const price = Number(transaction.navOrPrice);
    const previousUnits = unitsByAsset.get(assetId) ?? 0;

    lastPriceByAsset.set(assetId, price);

    if (transaction.type === "SELL") {
      unitsByAsset.set(assetId, Math.max(previousUnits - quantity, 0));
      invested = Math.max(invested - amount, 0);
    } else {
      unitsByAsset.set(assetId, previousUnits + quantity);
      invested += calculateNetInvestmentAmount(amount, stampDuty);
    }

    const current = [...unitsByAsset.entries()].reduce((sum, [id, units]) => {
      return sum + units * (lastPriceByAsset.get(id) ?? 0);
    }, 0);
    const date = transaction.tradeDate.toISOString().slice(0, 10);

    points.set(date, {
      date,
      invested: Number(invested.toFixed(2)),
      current: Number(current.toFixed(2)),
    });
  }

  return [...points.values()];
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

export async function getDueSips(userId: string) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const sips = await prisma.sip.findMany({
    where: {
      userId,
      status: "ACTIVE",
      nextDueDate: { lte: today },
    },
    include: {
      asset: true,
      transactions: {
        orderBy: { tradeDate: "desc" },
        take: 1,
      },
    },
  });

  return sips
    .filter((sip) => {
      const dueDate = sip.nextDueDate;
      const dismissed = sip.dismissedDueDate;

      if (!dueDate) {
        return false;
      }

      if (dismissed && dismissed.toDateString() === dueDate.toDateString()) {
        return false;
      }

      return !sip.transactions.some(
        (transaction) =>
          transaction.type === "SIP_INSTALLMENT" &&
          transaction.tradeDate.toDateString() === dueDate.toDateString(),
      );
    })
    .map((sip) => ({
      id: sip.id,
      amount: Number(sip.amount),
      dueDate: sip.nextDueDate?.toISOString().slice(0, 10) ?? "",
      frequency: sip.frequency,
      asset: serializeAsset(sip.asset),
    }));
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
  };
}

function allocationFromHoldings(rows: HoldingRow[], key: "assetClass" | "category") {
  const total = rows.reduce((sum, row) => sum + row.currentValue, 0);
  const groups = new Map<string, number>();

  for (const row of rows) {
    const label = key === "assetClass" ? row.assetClass : row.category || "Unclassified";
    groups.set(label, (groups.get(label) ?? 0) + row.currentValue);
  }

  return [...groups.entries()].map(([name, value]) => ({
    name,
    value: total ? Number(((value / total) * 100).toFixed(2)) : 0,
    amount: value,
  }));
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

function inferSectorAllocation(name: string, category?: string | null) {
  const text = `${name} ${category ?? ""}`.toLowerCase();
  const sectors: Array<[RegExp, string]> = [
    [/technology|digital|it\b|software|internet|ai|artificial intelligence/, "Technology"],
    [/bank|financial|finance|psu bank|private bank/, "Financial"],
    [/pharma|healthcare|health care|hospital/, "Healthcare"],
    [/infra|infrastructure|power|energy|oil|gas/, "Energy & Infrastructure"],
    [/consumer|consumption|fmcg/, "Consumer"],
    [/auto|automobile|transport/, "Automobile"],
  ];
  const match = sectors.find(([pattern]) => pattern.test(text));

  return match ? [{ name: match[1], value: 100 }] : undefined;
}

function inferMarketCapAllocation(name: string, category?: string | null) {
  const text = `${name} ${category ?? ""}`.toLowerCase();

  if (/large\s*&\s*mid|large and mid/.test(text)) {
    return [
      { name: "Large Cap", value: 50 },
      { name: "Mid Cap", value: 50 },
    ];
  }

  if (/large cap|bluechip|blue chip/.test(text)) {
    return [{ name: "Large Cap", value: 100 }];
  }

  if (/mid cap/.test(text)) {
    return [{ name: "Mid Cap", value: 100 }];
  }

  if (/small cap|micro cap/.test(text)) {
    return [{ name: "Small Cap", value: 100 }];
  }

  if (/flexi cap|multi cap|multicap|focused/.test(text)) {
    return [
      { name: "Large Cap", value: 50 },
      { name: "Mid Cap", value: 30 },
      { name: "Small Cap", value: 20 },
    ];
  }

  return undefined;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Provider timed out.")), timeoutMs);
    }),
  ]);
}

function weightedProviderAllocation(
  rows: HoldingRow[],
  key: "sectorAllocation" | "marketCapAllocation",
) {
  const groups = new Map<string, number>();
  let allocatedValue = 0;

  for (const row of rows) {
    const allocation = row[key];

    if (!allocation?.length || row.currentValue <= 0) {
      continue;
    }

    allocatedValue += row.currentValue;

    for (const point of allocation) {
      groups.set(point.name, (groups.get(point.name) ?? 0) + row.currentValue * (point.value / 100));
    }
  }

  return [...groups.entries()]
    .map(([name, amount]) => ({
      name,
      amount,
      value: allocatedValue ? Number(((amount / allocatedValue) * 100).toFixed(2)) : 0,
    }))
    .filter((point) => point.value > 0)
    .sort((a, b) => b.value - a.value);
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
