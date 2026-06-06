import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isSmtpConfigured, sendTemporaryPasswordEmail } from "@/lib/mail";
import { createTemporaryPassword, hashPassword, temporaryPasswordExpiry } from "@/lib/temporary-password";

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
      mustResetPassword: true,
      createdAt: true,
    },
  });

  return Response.json({
    currentAdminId: admin.id,
    users,
  });
}

export async function POST(request: Request) {
  const admin = await getCurrentUser();

  if (!admin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (admin.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { name?: string; email?: string };
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim() || null;

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Enter a valid email." }, { status: 400 });
  }

  if (!isSmtpConfigured()) {
    return Response.json({ error: "SMTP is not configured." }, { status: 503 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return Response.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const temporaryPassword = createTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      mustResetPassword: true,
      temporaryPasswordExpiresAt: temporaryPasswordExpiry(),
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustResetPassword: true,
      createdAt: true,
    },
  });

  try {
    await sendTemporaryPasswordEmail({ email, name, temporaryPassword });
  } catch (error) {
    await prisma.user.delete({ where: { id: user.id } });
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to send temporary password." },
      { status: 502 },
    );
  }

  return Response.json({ user }, { status: 201 });
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
      mustResetPassword: true,
      createdAt: true,
    },
  });

  return Response.json({ user: updated });
}
