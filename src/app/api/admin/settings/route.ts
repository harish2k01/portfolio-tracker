import { getCurrentUser } from "@/lib/session";
import { isSignupEnabled, setSignupEnabled } from "@/lib/settings";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json({
    signupEnabled: await isSignupEnabled(),
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { signupEnabled?: boolean };

  if (typeof body.signupEnabled !== "boolean") {
    return Response.json({ error: "signupEnabled must be boolean." }, { status: 400 });
  }

  await setSignupEnabled(body.signupEnabled);

  return Response.json({ signupEnabled: body.signupEnabled });
}
