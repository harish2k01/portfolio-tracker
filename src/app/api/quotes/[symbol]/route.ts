import type { AssetType } from "@prisma/client";
import { fetchYahooDetails } from "@/lib/market-data";
import { getCurrentUser } from "@/lib/session";
import type { ChartRange } from "@/types/portfolio";

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { symbol } = await context.params;
  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") ?? "1Y") as ChartRange;
  const type = (searchParams.get("type") ?? "STOCK") as AssetType;

  try {
    return Response.json(await fetchYahooDetails(decodeURIComponent(symbol), type, range));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Quote unavailable." },
      { status: 404 },
    );
  }
}
