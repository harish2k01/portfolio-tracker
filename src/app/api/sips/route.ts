import type { SipFrequency, SipStatus } from "@prisma/client";
import { upsertAsset } from "@/lib/assets";
import { prisma } from "@/lib/prisma";
import { nextSipDueDate, serializeAsset } from "@/lib/portfolio";
import { getCurrentUser } from "@/lib/session";
import type { InvestmentSearchResult } from "@/lib/market-data";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sips = await prisma.sip.findMany({
    where: { userId: user.id },
    include: { asset: true },
    orderBy: { startDate: "desc" },
  });

  return Response.json(
    sips.map((sip) => ({
      id: sip.id,
      amount: Number(sip.amount),
      frequency: sip.frequency,
      startDate: sip.startDate.toISOString().slice(0, 10),
      nextDueDate: sip.nextDueDate?.toISOString().slice(0, 10) ?? null,
      status: sip.status,
      asset: serializeAsset(sip.asset),
    })),
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    asset?: InvestmentSearchResult;
    amount?: number;
    frequency?: SipFrequency;
    startDate?: string;
  };

  if (!body.asset || body.asset.type !== "MUTUAL_FUND" || !body.amount || !body.startDate) {
    return Response.json(
      { error: "Mutual fund asset, amount, and start date are required." },
      { status: 400 },
    );
  }

  const asset = await upsertAsset(body.asset);
  const startDate = new Date(body.startDate);
  const frequency = body.frequency ?? "MONTHLY";
  const sip = await prisma.sip.create({
    data: {
      userId: user.id,
      assetId: asset.id,
      amount: body.amount,
      frequency,
      startDate,
      nextDueDate: nextSipDueDate(startDate, frequency),
    },
    include: { asset: true },
  });

  return Response.json(
    {
      id: sip.id,
      amount: Number(sip.amount),
      frequency: sip.frequency,
      startDate: sip.startDate.toISOString().slice(0, 10),
      nextDueDate: sip.nextDueDate?.toISOString().slice(0, 10) ?? null,
      status: sip.status,
      asset: serializeAsset(sip.asset),
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: string;
    amount?: number;
    frequency?: SipFrequency;
    startDate?: string;
    status?: SipStatus;
    dismissedDueDate?: string;
  };

  if (!body.id) {
    return Response.json({ error: "SIP id is required." }, { status: 400 });
  }

  const existing = await prisma.sip.findFirst({
    where: { id: body.id, userId: user.id },
  });

  if (!existing) {
    return Response.json({ error: "SIP not found." }, { status: 404 });
  }

  const startDate = body.startDate ? new Date(body.startDate) : existing.startDate;
  const frequency = body.frequency ?? existing.frequency;
  const sip = await prisma.sip.update({
    where: { id: existing.id },
    data: {
      amount: body.amount,
      frequency: body.frequency,
      startDate: body.startDate ? startDate : undefined,
      nextDueDate:
        body.startDate || body.frequency ? nextSipDueDate(startDate, frequency) : undefined,
      status: body.status,
      dismissedDueDate: body.dismissedDueDate ? new Date(body.dismissedDueDate) : undefined,
    },
    include: { asset: true },
  });

  return Response.json({
    id: sip.id,
    amount: Number(sip.amount),
    frequency: sip.frequency,
    startDate: sip.startDate.toISOString().slice(0, 10),
    nextDueDate: sip.nextDueDate?.toISOString().slice(0, 10) ?? null,
    status: sip.status,
    asset: serializeAsset(sip.asset),
  });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "SIP id is required." }, { status: 400 });
  }

  const sip = await prisma.sip.findFirst({ where: { id, userId: user.id } });

  if (!sip) {
    return Response.json({ error: "SIP not found." }, { status: 404 });
  }

  await prisma.sip.delete({ where: { id } });
  return Response.json({ ok: true });
}
