import type { Sip } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateGrossInvestmentAmount } from "@/lib/analytics";
import { nextSipDueDate } from "@/lib/portfolio";

export async function autoTagSipTransactions(userId: string, sipId?: string) {
  const sips = await prisma.sip.findMany({
    where: {
      userId,
      id: sipId,
    },
  });
  let taggedCount = 0;

  for (const sip of sips) {
    taggedCount += await tagTransactionsForSip(userId, sip);
  }

  return taggedCount;
}

async function tagTransactionsForSip(userId: string, sip: Sip) {
  const sipAmount = Number(sip.amount);
  const tolerance = Math.max(2, sipAmount * 0.005);
  const candidates = await prisma.transaction.findMany({
    where: {
      userId,
      assetId: sip.assetId,
      sipId: null,
      type: { in: ["BUY", "LUMPSUM", "SIP_INSTALLMENT"] },
    },
    orderBy: { tradeDate: "asc" },
  });
  const matching = candidates.filter((transaction) => {
    const amount =
      transaction.externalSource && Number(transaction.stampDuty) === 0
        ? calculateGrossInvestmentAmount(
            Number(transaction.amount),
            "MUTUAL_FUND",
            "SIP_INSTALLMENT",
          )
        : Number(transaction.amount);

    return Math.abs(amount - sipAmount) <= tolerance;
  });

  if (!matching.length) {
    return 0;
  }

  await prisma.transaction.updateMany({
    where: { id: { in: matching.map((transaction) => transaction.id) } },
    data: {
      sipId: sip.id,
      type: "SIP_INSTALLMENT",
    },
  });

  const latestTrade = matching.at(-1)?.tradeDate;

  if (latestTrade) {
    const nextAnchor = new Date(latestTrade);
    nextAnchor.setDate(nextAnchor.getDate() + 1);
    await prisma.sip.update({
      where: { id: sip.id },
      data: {
        nextDueDate: nextSipDueDate(nextAnchor, sip.frequency, nextAnchor),
      },
    });
  }

  return matching.length;
}
