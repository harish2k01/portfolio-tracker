import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hasUsers, isSignupEnabled, setSignupEnabled } from "@/lib/settings";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    password?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const name = body.name?.trim() || null;

  if (!email || !email.includes("@") || password.length < 8) {
    return Response.json(
      { error: "Enter a valid email and a password with at least 8 characters." },
      { status: 400 },
    );
  }

  const usersExist = await hasUsers();
  const signupEnabled = await isSignupEnabled();

  if (usersExist && !signupEnabled) {
    return Response.json({ error: "Signup is disabled by the admin." }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return Response.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: usersExist ? "USER" : "ADMIN",
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  if (!usersExist) {
    await setSignupEnabled(false);
  }

  return Response.json({ user }, { status: 201 });
}
