import type { Asset } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getUserAssetTransactions,
  serializeAsset,
  serializeTransaction,
} from "@/lib/portfolio";
import { fetchInvestmentDetails } from "@/lib/market-data";
import { getCurrentUser } from "@/lib/session";
import type { ChartRange } from "@/types/portfolio";

export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assetId } = await context.params;
  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") ?? "1Y") as ChartRange;
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });

  if (!asset) {
    return Response.json({ error: "Asset not found." }, { status: 404 });
  }

  const [details, transactions] = await Promise.all([
    safeFetchDetails(asset, asset.type === "MUTUAL_FUND" && range === "1D" ? "1W" : range),
    getUserAssetTransactions(user.id, asset.id),
  ]);

  return Response.json({
    asset: serializeAsset(asset),
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
      3500,
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
