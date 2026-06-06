import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/temporary-password";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    temporaryPassword?: string;
    newPassword?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const temporaryPassword = body.temporaryPassword ?? "";
  const newPassword = body.newPassword ?? "";

  if (!email || !email.includes("@") || temporaryPassword.length < 1 || newPassword.length < 8) {
    return Response.json(
      { error: "Email, temporary password, and a new password of at least 8 characters are required." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.passwordHash || !user.isActive || !user.mustResetPassword) {
    return Response.json({ error: "Password reset is not available for this user." }, { status: 400 });
  }

  if (user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt < new Date()) {
    return Response.json({ error: "Temporary password expired. Use forgot password again." }, { status: 400 });
  }

  const isValid = await verifyPassword(temporaryPassword, user.passwordHash);

  if (!isValid) {
    return Response.json({ error: "Temporary password is incorrect." }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustResetPassword: false,
      temporaryPasswordExpiresAt: null,
    },
  });

  return Response.json({ ok: true });
}
