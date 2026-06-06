import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      name: true,
      email: true,
      isActive: true,
      mustResetPassword: true,
    },
  });

  if (!user || !user.isActive) {
    return Response.json({ error: "No active user found for this email." }, { status: 404 });
  }

  return Response.json({
    email: user.email,
    name: user.name,
    mustResetPassword: user.mustResetPassword,
  });
}
