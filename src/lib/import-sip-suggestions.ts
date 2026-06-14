import { prisma } from "@/lib/prisma";
import { nextSipDueDate, serializeAsset } from "@/lib/portfolio";
import { inferImportedMutualFundDebitAmount } from "@/lib/analytics";

export type ImportSipSuggestion = {
  assetId: string;
  assetName: string;
  amount: number;
  importedAmount: number;
  referenceMonth: string;
  action: "CREATE" | "UPDATE" | "LINK";
  existingAmount: number | null;
  totalAvailableTransactions: number;
  referenceTransactions: Array<{
    id: string;
    date: string;
    amount: number;
    units: number;
  }>;
};

export async function detectImportedSipSuggestions(
  userId: string,
  assetIds?: string[],
): Promise<ImportSipSuggestion[]> {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      assetId: assetIds?.length ? { in: assetIds } : undefined,
      externalSource: { not: null },
      type: { in: ["BUY", "LUMPSUM", "SIP_INSTALLMENT"] },
      asset: { type: "MUTUAL_FUND" },
    },
    include: { asset: true },
    orderBy: [{ tradeDate: "desc" }, { createdAt: "desc" }],
  });
  const sips = await prisma.sip.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  const transactionsByAsset = new Map<string, typeof transactions>();

  for (const transaction of transactions) {
    const group = transactionsByAsset.get(transaction.assetId) ?? [];
    group.push(transaction);
    transactionsByAsset.set(transaction.assetId, group);
  }

  return [...transactionsByAsset.values()]
    .map((assetTransactions) => {
      const unlinked = assetTransactions.filter((transaction) => !transaction.sipId);

      if (!unlinked.length) {
        return null;
      }

      const latestMonthKey = monthKey(unlinked[0].tradeDate);
      const referenceTransactions = assetTransactions.filter(
        (transaction) => monthKey(transaction.tradeDate) === latestMonthKey,
      );
      const importedAmount = roundCurrency(
        referenceTransactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0),
      );
      const amount = importedSipDebitAmount(importedAmount);
      const existingSip = sips.find((sip) => sip.assetId === assetTransactions[0].assetId);
      const existingAmount = existingSip ? Number(existingSip.amount) : null;
      const action =
        existingAmount === null
          ? "CREATE"
          : Math.abs(existingAmount - amount) > 0.01
            ? "UPDATE"
            : "LINK";

      return {
        assetId: assetTransactions[0].assetId,
        assetName: assetTransactions[0].asset.name,
        amount,
        importedAmount,
        referenceMonth: formatMonth(unlinked[0].tradeDate),
        action,
        existingAmount,
        totalAvailableTransactions: assetTransactions.length,
        referenceTransactions: referenceTransactions
          .slice()
          .sort((left, right) => left.tradeDate.getTime() - right.tradeDate.getTime())
          .map((transaction) => ({
            id: transaction.id,
            date: transaction.tradeDate.toISOString().slice(0, 10),
            amount: Number(transaction.amount),
            units: Number(transaction.quantity),
          })),
      } satisfies ImportSipSuggestion;
    })
    .filter((suggestion): suggestion is ImportSipSuggestion => Boolean(suggestion));
}

export async function applyImportSipSuggestion(input: {
  userId: string;
  assetId: string;
  amount: number;
}) {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: input.userId,
      assetId: input.assetId,
      type: { in: ["BUY", "LUMPSUM", "SIP_INSTALLMENT"] },
    },
    include: { asset: true },
    orderBy: { tradeDate: "asc" },
  });

  if (!transactions.length) {
    throw new Error("No available mutual fund transactions were found.");
  }

  const asset = transactions[0].asset;

  if (asset.type !== "MUTUAL_FUND") {
    throw new Error("Only mutual fund transactions can be linked to a SIP.");
  }

  const amount = roundCurrency(input.amount);
  const existingSip = await prisma.sip.findFirst({
    where: {
      userId: input.userId,
      assetId: asset.id,
    },
    include: { asset: true },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  const startDate = transactions[0].tradeDate;
  const latestDate = transactions.at(-1)?.tradeDate ?? startDate;
  const nextAnchor = new Date(latestDate);
  nextAnchor.setDate(nextAnchor.getDate() + 1);
  const sip = existingSip
    ? await prisma.sip.update({
        where: { id: existingSip.id },
        data: {
          amount,
          startDate,
          nextDueDate: nextSipDueDate(nextAnchor, existingSip.frequency, nextAnchor),
        },
        include: { asset: true },
      })
    : await prisma.sip.create({
        data: {
          userId: input.userId,
          assetId: asset.id,
          amount,
          frequency: "MONTHLY",
          startDate,
          nextDueDate: nextSipDueDate(nextAnchor, "MONTHLY", nextAnchor),
        },
        include: { asset: true },
      });

  await prisma.transaction.updateMany({
    where: { id: { in: transactions.map((transaction) => transaction.id) } },
    data: {
      sipId: sip.id,
      type: "SIP_INSTALLMENT",
    },
  });

  return {
    sip: {
      id: sip.id,
      amount: Number(sip.amount),
      frequency: sip.frequency,
      startDate: sip.startDate.toISOString().slice(0, 10),
      nextDueDate: sip.nextDueDate?.toISOString().slice(0, 10) ?? null,
      status: sip.status,
      asset: serializeAsset(sip.asset),
    },
    converted: transactions.length,
  };
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function importedSipDebitAmount(amount: number) {
  return inferImportedMutualFundDebitAmount(amount);
}
