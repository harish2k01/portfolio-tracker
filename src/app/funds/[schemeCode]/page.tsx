import { FundDetails } from "@/components/dashboard/fund-details";
import { fetchMutualFundDetails } from "@/lib/market-data";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FundDetailsPage({
  params,
}: {
  params: Promise<{ schemeCode: string }>;
}) {
  await requirePageUser();
  const { schemeCode } = await params;
  const details = await fetchMutualFundDetails(schemeCode, "1Y");

  return <FundDetails details={details} />;
}
