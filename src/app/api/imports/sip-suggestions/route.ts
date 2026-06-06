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
  };

  if (!body.assetId || !body.amount) {
    return Response.json({ error: "Asset and SIP amount are required." }, { status: 400 });
  }

  try {
    const result = await applyImportSipSuggestion({
      userId: user.id,
      assetId: body.assetId,
      amount: body.amount,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create SIP from import." },
      { status: 400 },
    );
  }
}
