import type { Metadata } from "next";
import { HoldingsScreen } from "@/components/screens/holdings-screen";

export const metadata: Metadata = { title: "Holdings · Net Worth Tracker" };

export default async function HoldingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { filter } = await searchParams;

  return <HoldingsScreen filter={typeof filter === "string" && filter ? filter : null} />;
}
