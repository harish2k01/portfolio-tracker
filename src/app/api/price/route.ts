import { fetchPriceOnDate } from "@/lib/market-data";
import { getCurrentUser } from "@/lib/session";
import type { AssetType } from "@prisma/client";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as AssetType | null;
  const date = searchParams.get("date");
  const schemeCode = searchParams.get("schemeCode");
  const symbol = searchParams.get("symbol");

  if (!type || !date) {
    return Response.json({ error: "type and date are required." }, { status: 400 });
  }

  try {
    const value = await fetchPriceOnDate({ type, schemeCode, symbol, date });
    return Response.json({ value });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Price unavailable." },
      { status: 404 },
    );
  }
}
