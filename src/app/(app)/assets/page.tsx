import type { Metadata } from "next";
import { AssetsScreen } from "@/components/screens/simple-screens";

export const metadata: Metadata = { title: "Accounts & assets · Net Worth Tracker" };

export default function AssetsPage() {
  return <AssetsScreen />;
}
