import { upsertAsset } from "@/lib/assets";
import { fetchInvestmentDetails, type InvestmentSearchResult } from "@/lib/market-data";
import { prisma } from "@/lib/prisma";
import { serializeAsset } from "@/lib/portfolio";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.watchlistItem.findMany({
    where: { userId: user.id },
    include: { asset: true },
    orderBy: { createdAt: "desc" },
  });

  const enriched = await Promise.all(
    items.map(async (item) => {
      let latestValue: number | null = null;
      let changePercent: number | null = null;

      try {
        const quote = await fetchInvestmentDetails({
          type: item.asset.type,
          schemeCode: item.asset.schemeCode,
          symbol: item.asset.symbol,
        });
        latestValue = quote.value;
        changePercent = quote.changePercent;
      } catch {
        latestValue = null;
      }

      return {
        id: item.id,
        asset: serializeAsset(item.asset),
        aboveThreshold: item.aboveThreshold ? Number(item.aboveThreshold) : null,
        belowThreshold: item.belowThreshold ? Number(item.belowThreshold) : null,
        latestValue,
        changePercent,
        alert:
          latestValue !== null &&
          ((item.aboveThreshold && latestValue >= Number(item.aboveThreshold)) ||
            (item.belowThreshold && latestValue <= Number(item.belowThreshold))),
      };
    }),
  );

  return Response.json(enriched);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    asset?: InvestmentSearchResult;
    aboveThreshold?: number | null;
    belowThreshold?: number | null;
  };

  if (!body.asset) {
    return Response.json({ error: "Asset is required." }, { status: 400 });
  }

  const asset = await upsertAsset(body.asset);
  const item = await prisma.watchlistItem.upsert({
    where: { userId_assetId: { userId: user.id, assetId: asset.id } },
    update: {
      aboveThreshold: body.aboveThreshold,
      belowThreshold: body.belowThreshold,
    },
    create: {
      userId: user.id,
      assetId: asset.id,
      aboveThreshold: body.aboveThreshold,
      belowThreshold: body.belowThreshold,
    },
    include: { asset: true },
  });

  return Response.json(
    {
      id: item.id,
      asset: serializeAsset(item.asset),
      aboveThreshold: item.aboveThreshold ? Number(item.aboveThreshold) : null,
      belowThreshold: item.belowThreshold ? Number(item.belowThreshold) : null,
    },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Watchlist item id is required." }, { status: 400 });
  }

  await prisma.watchlistItem.deleteMany({ where: { id, userId: user.id } });

  return Response.json({ ok: true });
}
