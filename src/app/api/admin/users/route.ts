import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const admin = await getCurrentUser();

  if (!admin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (admin.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return Response.json({
    currentAdminId: admin.id,
    users,
  });
}

export async function PATCH(request: Request) {
  const admin = await getCurrentUser();

  if (!admin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (admin.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { userId?: string; isActive?: boolean };

  if (!body.userId || typeof body.isActive !== "boolean") {
    return Response.json({ error: "userId and isActive are required." }, { status: 400 });
  }

  if (body.userId === admin.id && !body.isActive) {
    return Response.json({ error: "Admins cannot deactivate themselves." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: body.userId },
    data: { isActive: body.isActive },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return Response.json({ user: updated });
}
