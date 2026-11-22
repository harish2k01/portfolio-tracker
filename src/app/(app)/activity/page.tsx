import type { Metadata } from "next";
import { ActivityScreen } from "@/components/screens/simple-screens";

export const metadata: Metadata = { title: "Activity · Net Worth Tracker" };

export default function ActivityPage() {
  return <ActivityScreen />;
}
