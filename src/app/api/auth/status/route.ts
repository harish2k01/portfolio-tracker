import { getCurrentUser } from "@/lib/session";
import { hasUsers, isSignupEnabled } from "@/lib/settings";

export async function GET() {
  const [user, usersExist, signupEnabled] = await Promise.all([
    getCurrentUser(),
    hasUsers(),
    isSignupEnabled(),
  ]);

  return Response.json({
    user,
    usersExist,
    signupEnabled,
  });
}
