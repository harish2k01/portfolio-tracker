import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/lib/session";
import { hasUsers, isSignupEnabled } from "@/lib/settings";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  const [usersExist, signupEnabled] = await Promise.all([hasUsers(), isSignupEnabled()]);

  return <AuthForm mode="login" usersExist={usersExist} signupEnabled={signupEnabled} />;
}
