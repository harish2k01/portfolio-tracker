import { NetWorthApp } from "@/components/dashboard/net-worth-app";
import { requirePageUser } from "@/lib/session";

export default async function Home() {
  const user = await requirePageUser();

  return <NetWorthApp user={user} />;
}
