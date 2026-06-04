import { PortfolioApp } from "@/components/dashboard/portfolio-app";
import { requirePageUser } from "@/lib/session";

export default async function Home() {
  const user = await requirePageUser();

  return <PortfolioApp user={user} />;
}
