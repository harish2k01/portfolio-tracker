import type { NetWorthAssetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ManualTimelinePoint } from "@/lib/net-worth-calculations";
import type { NetWorthAssetRow } from "@/types/portfolio";

export async function getNetWorthAssets(userId: string): Promise<NetWorthAssetRow[]> {
  const assets = await prisma.netWorthAsset.findMany({
    where: { userId },
    include: {
      snapshots: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return assets.map((asset) => serializeNetWorthAsset(asset));
}

export async function getNetWorthTimeline(userId: string): Promise<ManualTimelinePoint[]> {
  const assets = await prisma.netWorthAsset.findMany({
    where: { userId },
    include: {
      snapshots: {
        orderBy: { date: "asc" },
      },
    },
  });
  const dates = new Set<string>();

  for (const asset of assets) {
    for (const snapshot of asset.snapshots) {
      dates.add(snapshot.date.toISOString().slice(0, 10));
    }
  }

  if (!dates.size) {
    return [];
  }

  const startDate = [...dates].sort()[0];
  const endDate = new Date().toISOString().slice(0, 10);
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const finalDate = new Date(`${endDate}T00:00:00.000Z`);
  const indexes = new Map<string, number>();
  const currentSnapshots = new Map<
    string,
    { currentValue: number; investedAmount: number }
  >();
  const timeline: ManualTimelinePoint[] = [];

  while (cursor <= finalDate) {
    const date = cursor.toISOString().slice(0, 10);

    for (const asset of assets) {
      let index = indexes.get(asset.id) ?? 0;

      while (
        index < asset.snapshots.length &&
        asset.snapshots[index].date.toISOString().slice(0, 10) <= date
      ) {
        const snapshot = asset.snapshots[index];
        const currentValue = Number(snapshot.currentValue);
        currentSnapshots.set(asset.id, {
          currentValue,
          investedAmount:
            snapshot.investedAmount === null
              ? currentValue
              : Number(snapshot.investedAmount),
        });
        index += 1;
      }

      indexes.set(asset.id, index);
    }

    timeline.push({
      date,
      current: Number(
        [...currentSnapshots.values()]
          .reduce((sum, point) => sum + point.currentValue, 0)
          .toFixed(2),
      ),
      invested: Number(
        [...currentSnapshots.values()]
          .reduce((sum, point) => sum + point.investedAmount, 0)
          .toFixed(2),
      ),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return timeline.filter((point) => point.current > 0 || point.invested > 0);
}

export function serializeNetWorthAsset(asset: {
  id: string;
  name: string;
  type: NetWorthAssetType;
  institution: string | null;
  currentValue: unknown;
  investedAmount: unknown;
  accountReference: string | null;
  interestRate: unknown;
  maturityDate: Date | null;
  quantity: unknown;
  unitPrice: unknown;
  notes: string | null;
  updatedAt: Date;
  snapshots?: Array<{
    date: Date;
    currentValue: unknown;
    investedAmount: unknown;
  }>;
}): NetWorthAssetRow {
  const latestSnapshot = asset.snapshots?.[0];

  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    institution: asset.institution,
    currentValue: Number(latestSnapshot?.currentValue ?? asset.currentValue),
    investedAmount:
      latestSnapshot
        ? latestSnapshot.investedAmount === null
          ? null
          : Number(latestSnapshot.investedAmount)
        : asset.investedAmount === null
          ? null
          : Number(asset.investedAmount),
    accountReference: asset.accountReference,
    interestRate: asset.interestRate === null ? null : Number(asset.interestRate),
    maturityDate: asset.maturityDate?.toISOString().slice(0, 10) ?? null,
    quantity: asset.quantity === null ? null : Number(asset.quantity),
    unitPrice: asset.unitPrice === null ? null : Number(asset.unitPrice),
    notes: asset.notes,
    asOfDate:
      latestSnapshot?.date.toISOString().slice(0, 10) ??
      asset.updatedAt.toISOString().slice(0, 10),
  };
}
