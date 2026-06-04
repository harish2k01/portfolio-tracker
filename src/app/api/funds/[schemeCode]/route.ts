import { fetchMutualFundDetails } from "@/lib/market-data";
import { getCurrentUser } from "@/lib/session";
import type { ChartRange } from "@/types/portfolio";

export async function GET(
  request: Request,
  context: { params: Promise<{ schemeCode: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { schemeCode } = await context.params;
  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") ?? "1Y") as ChartRange;

  try {
    return Response.json(await fetchMutualFundDetails(schemeCode, range === "1D" ? "1W" : range));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Fund data unavailable." },
      { status: 404 },
    );
  }
}
