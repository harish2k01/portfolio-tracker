import { prisma } from "@/lib/prisma";
import { isSmtpConfigured, sendTemporaryPasswordEmail } from "@/lib/mail";
import { createTemporaryPassword, hashPassword, temporaryPasswordExpiry } from "@/lib/temporary-password";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Enter a valid email." }, { status: 400 });
  }

  if (!isSmtpConfigured()) {
    return Response.json({ error: "SMTP is not configured." }, { status: 503 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      passwordHash: true,
      mustResetPassword: true,
      temporaryPasswordExpiresAt: true,
    },
  });

  if (!user?.email || !user.isActive) {
    return Response.json({ ok: true });
  }

  const temporaryPassword = createTemporaryPassword();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(temporaryPassword),
      mustResetPassword: true,
      temporaryPasswordExpiresAt: temporaryPasswordExpiry(),
    },
  });

  try {
    await sendTemporaryPasswordEmail({
      email: user.email,
      name: user.name,
      temporaryPassword,
    });
  } catch (error) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: user.passwordHash,
        mustResetPassword: user.mustResetPassword,
        temporaryPasswordExpiresAt: user.temporaryPasswordExpiresAt,
      },
    });

    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to send temporary password." },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}
