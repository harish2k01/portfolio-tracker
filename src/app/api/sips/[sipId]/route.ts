import type { Asset } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserSipTransactions, serializeAsset, serializeTransaction } from "@/lib/portfolio";
import { fetchInvestmentDetails } from "@/lib/market-data";
import { getCurrentUser } from "@/lib/session";
import type { ChartRange } from "@/types/portfolio";

export async function GET(request: Request, context: { params: Promise<{ sipId: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sipId } = await context.params;
  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") ?? "1Y") as ChartRange;
  const sip = await prisma.sip.findFirst({
    where: { id: sipId, userId: user.id },
    include: { asset: true },
  });

  if (!sip) {
    return Response.json({ error: "SIP not found." }, { status: 404 });
  }

  const [details, transactions] = await Promise.all([
    safeFetchDetails(sip.asset, range === "1D" ? "1W" : range),
    getUserSipTransactions(user.id, sip.id),
  ]);

  return Response.json({
    sip: {
      id: sip.id,
      amount: Number(sip.amount),
      frequency: sip.frequency,
      startDate: sip.startDate.toISOString().slice(0, 10),
      nextDueDate: sip.nextDueDate?.toISOString().slice(0, 10) ?? null,
      status: sip.status,
      asset: serializeAsset(sip.asset),
    },
    details,
    transactions: transactions.map(serializeTransaction),
  });
}

async function safeFetchDetails(asset: Asset, range: ChartRange) {
  try {
    return await withTimeout(
      fetchInvestmentDetails(
        { type: asset.type, schemeCode: asset.schemeCode, symbol: asset.symbol },
        range,
      ),
      25000,
    );
  } catch {
    return {
      name: asset.name,
      type: asset.type,
      symbol: asset.symbol ?? undefined,
      schemeCode: asset.schemeCode ?? undefined,
      exchange: asset.exchange ?? undefined,
      category: asset.category ?? undefined,
      amc: asset.amc ?? undefined,
      value: Number(asset.price ?? asset.nav ?? 0) || null,
      changePercent: null,
      history: [],
    };
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
