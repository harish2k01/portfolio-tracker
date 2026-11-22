import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsScreen } from "@/components/screens/simple-screens";
import { requirePageUser } from "@/lib/session";

export const metadata: Metadata = { title: "Settings · Net Worth Tracker" };

export default async function SettingsPage() {
  const user = await requirePageUser();

  if (user.role !== "ADMIN") {
    redirect("/");
  }

  return <SettingsScreen />;
}
