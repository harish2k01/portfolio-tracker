import type { NetWorthAssetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeNetWorthAsset } from "@/lib/net-worth";
import { getCurrentUser } from "@/lib/session";

type NetWorthAssetInput = {
  id?: string;
  name?: string;
  type?: NetWorthAssetType;
  institution?: string | null;
  currentValue?: number;
  investedAmount?: number | null;
  accountReference?: string | null;
  interestRate?: number | null;
  maturityDate?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  notes?: string | null;
  asOfDate?: string;
};

const supportedTypes = new Set<NetWorthAssetType>([
  "BANK_ACCOUNT",
  "FIXED_DEPOSIT",
  "EPF",
  "GOLD",
  "PPF",
  "NPS",
  "OTHER",
]);

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assets = await prisma.netWorthAsset.findMany({
    where: { userId: user.id },
    include: {
      snapshots: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return Response.json(assets.map((asset) => serializeNetWorthAsset(asset)));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as NetWorthAssetInput;
  const validation = validateInput(body);

  if (validation.error) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const data = buildAssetData(body, validation.currentValue);
  const asOfDate = parseDate(body.asOfDate);
  const asset = await prisma.netWorthAsset.create({
    data: {
      userId: user.id,
      ...data,
      snapshots: {
        create: {
          date: asOfDate,
          currentValue: validation.currentValue,
          investedAmount: nullableNumber(body.investedAmount),
        },
      },
    },
    include: {
      snapshots: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  return Response.json(serializeNetWorthAsset(asset), { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as NetWorthAssetInput;

  if (!body.id) {
    return Response.json({ error: "Asset id is required." }, { status: 400 });
  }

  const existing = await prisma.netWorthAsset.findFirst({
    where: { id: body.id, userId: user.id },
  });

  if (!existing) {
    return Response.json({ error: "Net-worth asset not found." }, { status: 404 });
  }

  const merged: NetWorthAssetInput = {
    name: body.name ?? existing.name,
    type: body.type ?? existing.type,
    institution: body.institution === undefined ? existing.institution : body.institution,
    currentValue:
      body.currentValue === undefined ? Number(existing.currentValue) : body.currentValue,
    investedAmount:
      body.investedAmount === undefined
        ? existing.investedAmount === null
          ? null
          : Number(existing.investedAmount)
        : body.investedAmount,
    accountReference:
      body.accountReference === undefined
        ? existing.accountReference
        : body.accountReference,
    interestRate:
      body.interestRate === undefined
        ? existing.interestRate === null
          ? null
          : Number(existing.interestRate)
        : body.interestRate,
    maturityDate:
      body.maturityDate === undefined
        ? existing.maturityDate?.toISOString().slice(0, 10) ?? null
        : body.maturityDate,
    quantity:
      body.quantity === undefined
        ? existing.quantity === null
          ? null
          : Number(existing.quantity)
        : body.quantity,
    unitPrice:
      body.unitPrice === undefined
        ? existing.unitPrice === null
          ? null
          : Number(existing.unitPrice)
        : body.unitPrice,
    notes: body.notes === undefined ? existing.notes : body.notes,
    asOfDate: body.asOfDate,
  };
  const validation = validateInput(merged);

  if (validation.error) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const asOfDate = parseDate(body.asOfDate);
  const [, asset] = await prisma.$transaction([
    prisma.netWorthSnapshot.upsert({
      where: {
        netWorthAssetId_date: {
          netWorthAssetId: existing.id,
          date: asOfDate,
        },
      },
      update: {
        currentValue: validation.currentValue,
        investedAmount: nullableNumber(merged.investedAmount),
      },
      create: {
        netWorthAssetId: existing.id,
        date: asOfDate,
        currentValue: validation.currentValue,
        investedAmount: nullableNumber(merged.investedAmount),
      },
    }),
    prisma.netWorthAsset.update({
      where: { id: existing.id },
      data: buildAssetData(merged, validation.currentValue),
      include: {
        snapshots: {
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  return Response.json(serializeNetWorthAsset(asset));
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Asset id is required." }, { status: 400 });
  }

  const existing = await prisma.netWorthAsset.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return Response.json({ error: "Net-worth asset not found." }, { status: 404 });
  }

  await prisma.netWorthAsset.delete({ where: { id } });
  return Response.json({ ok: true });
}

function validateInput(body: NetWorthAssetInput) {
  const name = body.name?.trim();
  const type = body.type;
  const currentValue = resolveCurrentValue(body);

  if (!name) {
    return { error: "Asset name is required.", currentValue: 0 };
  }

  if (!type || !supportedTypes.has(type)) {
    return { error: "Select a valid asset type.", currentValue: 0 };
  }

  if (!Number.isFinite(currentValue) || currentValue < 0) {
    return { error: "Current value must be zero or greater.", currentValue: 0 };
  }

  if (
    body.investedAmount !== null &&
    body.investedAmount !== undefined &&
    (!Number.isFinite(body.investedAmount) || body.investedAmount < 0)
  ) {
    return { error: "Invested amount must be zero or greater.", currentValue };
  }

  return { error: "", currentValue: Number(currentValue.toFixed(2)) };
}

function resolveCurrentValue(body: NetWorthAssetInput) {
  if (Number.isFinite(body.currentValue)) {
    return Number(body.currentValue);
  }

  if (Number.isFinite(body.quantity) && Number.isFinite(body.unitPrice)) {
    return Number(body.quantity) * Number(body.unitPrice);
  }

  return Number.NaN;
}

function buildAssetData(
  body: NetWorthAssetInput,
  currentValue: number,
) {
  return {
    name: body.name?.trim() ?? "",
    type: body.type ?? "OTHER",
    institution: cleanText(body.institution),
    currentValue,
    investedAmount: nullableNumber(body.investedAmount),
    accountReference: cleanText(body.accountReference),
    interestRate: nullableNumber(body.interestRate),
    maturityDate: body.maturityDate ? parseDate(body.maturityDate) : null,
    quantity: nullableNumber(body.quantity),
    unitPrice: nullableNumber(body.unitPrice),
    notes: cleanText(body.notes),
  };
}

function cleanText(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function nullableNumber(value?: number | null) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? null
    : value;
}

function parseDate(value?: string | null) {
  const date = value ? new Date(`${value}T00:00:00.000Z`) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  date.setUTCHours(0, 0, 0, 0);
  return date;
}
