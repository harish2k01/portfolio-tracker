import { applyImportSipSuggestion } from "@/lib/import-sip-suggestions";
import { getCurrentUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    assetId?: string;
    amount?: number;
    suggestions?: Array<{ assetId?: string; amount?: number }>;
  };

  const suggestions = body.suggestions?.length
    ? body.suggestions
    : [{ assetId: body.assetId, amount: body.amount }];

  if (suggestions.some((suggestion) => !suggestion.assetId || !suggestion.amount)) {
    return Response.json({ error: "Asset and SIP amount are required." }, { status: 400 });
  }

  try {
    const results = [];

    for (const suggestion of suggestions) {
      results.push(
        await applyImportSipSuggestion({
          userId: user.id,
          assetId: suggestion.assetId!,
          amount: suggestion.amount!,
        }),
      );
    }

    return Response.json({
      results,
      converted: results.reduce((sum, result) => sum + result.converted, 0),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create SIP from import." },
      { status: 400 },
    );
  }
}
