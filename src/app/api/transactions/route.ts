import type { TransactionType } from "@prisma/client";
import { upsertAsset } from "@/lib/assets";
import { fetchPriceOnDate, type InvestmentSearchResult } from "@/lib/market-data";
import { prisma } from "@/lib/prisma";
import {
  calculateStampDuty,
  calculateUnits,
  getAvailableUnits,
  isBuyType,
  nextSipDueDate,
  serializeTransaction,
} from "@/lib/portfolio";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    include: { asset: true, sip: true },
    orderBy: { tradeDate: "desc" },
  });

  return Response.json(transactions.map(serializeTransaction));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    asset?: InvestmentSearchResult;
    assetId?: string;
    sipId?: string;
    type?: TransactionType;
    amount?: number;
    tradeDate?: string;
    quantity?: number;
    navOrPrice?: number;
    stampDuty?: number;
  };

  const type = body.type ?? "BUY";

  if (!body.tradeDate) {
    return Response.json({ error: "Trade date is required." }, { status: 400 });
  }

  const asset = body.asset
    ? await upsertAsset(body.asset)
    : body.assetId
      ? await prisma.asset.findUnique({ where: { id: body.assetId } })
      : null;

  if (!asset) {
    return Response.json({ error: "Asset is required." }, { status: 400 });
  }

  const navOrPrice =
    body.navOrPrice ??
    (await fetchPriceOnDate({
      type: asset.type,
      schemeCode: asset.schemeCode,
      symbol: asset.symbol,
      date: body.tradeDate,
    }));
  const stampDuty = calculateStampDuty(body.amount ?? 0, asset.type, type);

  let amount = body.amount ?? 0;
  let quantity = body.quantity ?? 0;

  if (type === "SELL") {
    if (!quantity) {
      return Response.json({ error: "Sell quantity is required." }, { status: 400 });
    }

    const availableUnits = await getAvailableUnits(user.id, asset.id);

    if (quantity > availableUnits) {
      return Response.json({ error: "Sell quantity exceeds available units." }, { status: 400 });
    }

    amount = Number((quantity * navOrPrice).toFixed(2));
  } else {
    if (!amount) {
      return Response.json({ error: "Amount is required." }, { status: 400 });
    }

    quantity = body.quantity ?? calculateUnits(amount, navOrPrice, stampDuty, 3);
  }

  if (!isBuyType(type) && type !== "SELL") {
    return Response.json({ error: "Unsupported transaction type." }, { status: 400 });
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId: user.id,
      assetId: asset.id,
      sipId: body.sipId,
      type,
      amount,
      quantity,
      navOrPrice,
      stampDuty,
      tradeDate: new Date(body.tradeDate),
    },
    include: { asset: true, sip: true },
  });

  if (type === "SIP_INSTALLMENT" && body.sipId) {
    const sip = await prisma.sip.findFirst({
      where: { id: body.sipId, userId: user.id },
    });

    if (sip) {
      const nextAnchor = new Date(sip.nextDueDate ?? body.tradeDate);
      nextAnchor.setDate(nextAnchor.getDate() + 1);
      await prisma.sip.update({
        where: { id: sip.id },
        data: {
          nextDueDate: nextSipDueDate(nextAnchor, sip.frequency, nextAnchor),
          dismissedDueDate: null,
        },
      });
    }
  }

  return Response.json(serializeTransaction(transaction), { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: string;
    asset?: InvestmentSearchResult;
    assetId?: string;
    sipId?: string | null;
    type?: TransactionType;
    amount?: number;
    tradeDate?: string;
    quantity?: number;
    navOrPrice?: number;
  };

  if (!body.id) {
    return Response.json({ error: "Transaction id is required." }, { status: 400 });
  }

  const existing = await prisma.transaction.findFirst({
    where: { id: body.id, userId: user.id },
    include: { asset: true },
  });

  if (!existing) {
    return Response.json({ error: "Transaction not found." }, { status: 404 });
  }

  const type = body.type ?? existing.type;
  const tradeDate = body.tradeDate ?? existing.tradeDate.toISOString().slice(0, 10);
  const asset = body.asset
    ? await upsertAsset(body.asset)
    : body.assetId
      ? await prisma.asset.findUnique({ where: { id: body.assetId } })
      : existing.asset;

  if (!asset) {
    return Response.json({ error: "Asset is required." }, { status: 400 });
  }

  const navOrPrice =
    body.navOrPrice ??
    (await fetchPriceOnDate({
      type: asset.type,
      schemeCode: asset.schemeCode,
      symbol: asset.symbol,
      date: tradeDate,
    }));
  const amountInput = body.amount ?? Number(existing.amount);
  const stampDuty = calculateStampDuty(amountInput, asset.type, type);

  let amount = amountInput;
  let quantity = body.quantity ?? Number(existing.quantity);

  if (type === "SELL") {
    if (!quantity) {
      return Response.json({ error: "Sell quantity is required." }, { status: 400 });
    }

    const availableUnits = await getAvailableUnitsExcluding(user.id, asset.id, existing.id);

    if (quantity > availableUnits) {
      return Response.json({ error: "Sell quantity exceeds available units." }, { status: 400 });
    }

    amount = Number((quantity * navOrPrice).toFixed(2));
  } else {
    if (!amount) {
      return Response.json({ error: "Amount is required." }, { status: 400 });
    }

    quantity = body.quantity ?? calculateUnits(amount, navOrPrice, stampDuty, 3);
  }

  if (!isBuyType(type) && type !== "SELL") {
    return Response.json({ error: "Unsupported transaction type." }, { status: 400 });
  }

  const transaction = await prisma.transaction.update({
    where: { id: existing.id },
    data: {
      assetId: asset.id,
      sipId: body.sipId === undefined ? existing.sipId : body.sipId,
      type,
      amount,
      quantity,
      navOrPrice,
      stampDuty,
      tradeDate: new Date(tradeDate),
    },
    include: { asset: true, sip: true },
  });

  return Response.json(serializeTransaction(transaction));
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Transaction id is required." }, { status: 400 });
  }

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return Response.json({ error: "Transaction not found." }, { status: 404 });
  }

  await prisma.transaction.delete({ where: { id } });

  return Response.json({ ok: true });
}

async function getAvailableUnitsExcluding(userId: string, assetId: string, excludeId: string) {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      assetId,
      id: { not: excludeId },
    },
  });

  return transactions.reduce((sum, transaction) => {
    const quantity = Number(transaction.quantity);
    return transaction.type === "SELL" ? sum - quantity : sum + quantity;
  }, 0);
}
