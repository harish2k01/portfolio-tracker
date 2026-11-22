import type { Metadata } from "next";
import { SearchScreen } from "@/components/screens/simple-screens";

export const metadata: Metadata = { title: "Find investments · Net Worth Tracker" };

export default function SearchPage() {
  return <SearchScreen />;
}
