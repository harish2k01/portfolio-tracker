import { getDashboard } from "@/lib/portfolio";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(await getDashboard(user.id));
}

export async function DELETE() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { userId: user.id } }),
    prisma.sip.deleteMany({ where: { userId: user.id } }),
    prisma.portfolio.deleteMany({ where: { userId: user.id } }),
  ]);

  return Response.json({ ok: true });
}
