import type { Metadata } from "next";
import { SipsScreen } from "@/components/screens/sips-screen";

export const metadata: Metadata = { title: "SIPs · Net Worth Tracker" };

export default function SipsPage() {
  return <SipsScreen />;
}
