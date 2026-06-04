import type { Asset, AssetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { InvestmentSearchResult } from "@/lib/market-data";

export async function upsertAsset(input: InvestmentSearchResult): Promise<Asset> {
  if (input.type === "MUTUAL_FUND") {
    if (!input.schemeCode) {
      throw new Error("Mutual fund scheme code is required.");
    }

    return prisma.asset.upsert({
      where: { schemeCode: input.schemeCode },
      update: {
        name: input.name,
        type: input.type,
        amc: input.amc,
        category: input.category,
      },
      create: {
        name: input.name,
        type: input.type,
        schemeCode: input.schemeCode,
        amc: input.amc,
        category: input.category,
      },
    });
  }

  if (!input.symbol) {
    throw new Error("Symbol is required.");
  }

  return prisma.asset.upsert({
    where: { symbol: input.symbol },
    update: {
      name: input.name,
      type: input.type,
      exchange: input.exchange,
      category: input.category,
    },
    create: {
      name: input.name,
      type: input.type,
      symbol: input.symbol,
      exchange: input.exchange,
      category: input.category,
    },
  });
}

export async function getAssetOrThrow(assetId: string) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
  });

  if (!asset) {
    throw new Error("Asset not found.");
  }

  return asset;
}

export function assetIdentity(asset: Pick<Asset, "type" | "schemeCode" | "symbol">): {
  type: AssetType;
  schemeCode?: string | null;
  symbol?: string | null;
} {
  return {
    type: asset.type,
    schemeCode: asset.schemeCode,
    symbol: asset.symbol,
  };
}
