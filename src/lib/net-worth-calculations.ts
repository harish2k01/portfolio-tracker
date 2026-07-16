import type {
  AllocationPoint,
  HoldingRow,
  NetWorthAssetRow,
  PortfolioTimelinePoint,
} from "@/types/portfolio";

export type ManualTimelinePoint = {
  date: string;
  invested: number;
  current: number;
};

export function buildNetWorthAllocation(
  holdings: HoldingRow[],
  assets: NetWorthAssetRow[],
): AllocationPoint[] {
  const groups = new Map<string, number>();

  for (const holding of holdings) {
    const value = holding.currentValue > 0 ? holding.currentValue : holding.investedAmount;

    if (value <= 0) {
      continue;
    }

    const name =
      holding.assetClass === "Commodities"
        ? "Gold"
        : holding.type === "MUTUAL_FUND"
          ? "Mutual Funds"
          : holding.type === "STOCK"
            ? "Stocks"
            : "ETFs";
    groups.set(name, (groups.get(name) ?? 0) + value);
  }

  for (const asset of assets) {
    if (asset.currentValue <= 0) {
      continue;
    }

    const name = netWorthAssetLabel(asset.type);
    groups.set(name, (groups.get(name) ?? 0) + asset.currentValue);
  }

  const total = [...groups.values()].reduce((sum, value) => sum + value, 0);

  return [...groups.entries()]
    .map(([name, amount]) => ({
      name,
      amount: Number(amount.toFixed(2)),
      value: total ? Number(((amount / total) * 100).toFixed(2)) : 0,
    }))
    .filter((point) => point.value > 0)
    .sort((left, right) => right.amount - left.amount);
}

export function mergeNetWorthTimeline(
  investments: PortfolioTimelinePoint[],
  manualAssets: ManualTimelinePoint[],
): PortfolioTimelinePoint[] {
  const dates = new Set([
    ...investments.map((point) => point.date),
    ...manualAssets.map((point) => point.date),
  ]);

  if (!dates.size) {
    return [];
  }

  const investmentByDate = new Map(investments.map((point) => [point.date, point]));
  const manualByDate = new Map(manualAssets.map((point) => [point.date, point]));
  const firstDate = [...dates].sort()[0];
  const endDate = new Date().toISOString().slice(0, 10);
  const cursor = new Date(`${firstDate}T00:00:00.000Z`);
  const finalDate = new Date(`${endDate}T00:00:00.000Z`);
  const points: PortfolioTimelinePoint[] = [];
  let investmentCurrent = 0;
  let investmentInvested = 0;
  let manualCurrent = 0;
  let manualInvested = 0;

  while (cursor <= finalDate) {
    const date = cursor.toISOString().slice(0, 10);
    const investmentPoint = investmentByDate.get(date);
    const manualPoint = manualByDate.get(date);

    if (investmentPoint) {
      investmentCurrent = investmentPoint.current;
      investmentInvested = investmentPoint.invested;
    }

    if (manualPoint) {
      manualCurrent = manualPoint.current;
      manualInvested = manualPoint.invested;
    }

    points.push({
      date,
      invested: Number((investmentInvested + manualInvested).toFixed(2)),
      current: Number((investmentCurrent + manualCurrent).toFixed(2)),
      investments: Number(investmentCurrent.toFixed(2)),
      otherAssets: Number(manualCurrent.toFixed(2)),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return points.filter((point) => point.current > 0 || point.invested > 0);
}

export function netWorthAssetLabel(type: NetWorthAssetRow["type"]) {
  const labels: Record<NetWorthAssetRow["type"], string> = {
    BANK_ACCOUNT: "Bank Accounts",
    FIXED_DEPOSIT: "Fixed Deposits",
    EPF: "EPF",
    GOLD: "Gold",
    PPF: "PPF",
    NPS: "NPS",
    OTHER: "Other Assets",
  };

  return labels[type];
}
