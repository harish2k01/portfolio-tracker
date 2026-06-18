import type { Asset, AssetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logoCachePatch } from "@/lib/investment-logos";
import { resolveMutualFundScheme, type InvestmentSearchResult } from "@/lib/market-data";

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
        isin: input.isin,
        amc: input.amc,
        category: input.category,
        ...logoCachePatch(input),
      },
      create: {
        name: input.name,
        type: input.type,
        schemeCode: input.schemeCode,
        isin: input.isin,
        amc: input.amc,
        category: input.category,
        ...logoCachePatch(input),
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
      isin: input.isin,
      exchange: input.exchange,
      category: input.category,
      ...logoCachePatch(input),
    },
    create: {
      name: input.name,
      type: input.type,
      symbol: input.symbol,
      isin: input.isin,
      exchange: input.exchange,
      category: input.category,
      ...logoCachePatch(input),
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

export async function resolveAssetSchemeCode(asset: Asset) {
  if (asset.type !== "MUTUAL_FUND" || asset.schemeCode) {
    return asset.schemeCode;
  }

  const resolved = await resolveMutualFundScheme(asset.name);

  if (!resolved?.schemeCode) {
    return null;
  }

  const existing = await prisma.asset.findUnique({
    where: { schemeCode: resolved.schemeCode },
    select: { id: true },
  });

  if (!existing || existing.id === asset.id) {
    try {
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          schemeCode: resolved.schemeCode,
          name: resolved.name,
          category: resolved.category,
          amc: resolved.amc,
          ...logoCachePatch({
            ...resolved,
            type: "MUTUAL_FUND",
          }),
        },
      });
    } catch {
      // Another request may have attached this provider identity first.
    }
  }

  return resolved.schemeCode;
}
