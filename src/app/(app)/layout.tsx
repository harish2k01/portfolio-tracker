import { AppShell } from "@/components/app/app-shell";
import { requirePageUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();

  return <AppShell user={user}>{children}</AppShell>;
}
