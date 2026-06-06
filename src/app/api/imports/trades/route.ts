import { importTradeWorkbook } from "@/lib/trade-import";
import { detectImportedSipSuggestions } from "@/lib/import-sip-suggestions";
import { getCurrentUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData
    .getAll("files")
    .concat(formData.getAll("file"))
    .filter((item): item is File => item instanceof File);

  if (!files.length) {
    return Response.json({ error: "Upload at least one Excel file." }, { status: 400 });
  }

  const summaries = [];

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      summaries.push({
        fileName: file.name,
        parsed: 0,
        imported: 0,
        skipped: 0,
        failed: 1,
        taggedSipTransactions: 0,
        affectedAssetIds: [],
        errors: ["Only .xlsx files are supported."],
      });
      continue;
    }

    summaries.push(await importTradeWorkbook(user.id, file.name, await file.arrayBuffer()));
  }
  const affectedAssetIds = [...new Set(summaries.flatMap((summary) => summary.affectedAssetIds))];
  const sipSuggestions = affectedAssetIds.length
    ? await detectImportedSipSuggestions(user.id, affectedAssetIds)
    : [];

  return Response.json({
    summaries,
    parsed: summaries.reduce((sum, item) => sum + item.parsed, 0),
    imported: summaries.reduce((sum, item) => sum + item.imported, 0),
    skipped: summaries.reduce((sum, item) => sum + item.skipped, 0),
    failed: summaries.reduce((sum, item) => sum + item.failed, 0),
    taggedSipTransactions: summaries.reduce((sum, item) => sum + item.taggedSipTransactions, 0),
    sipSuggestions,
  });
}
