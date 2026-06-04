"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthFormProps = {
  mode: "login" | "signup";
  usersExist: boolean;
  signupEnabled: boolean;
};

export function AuthForm({ mode, usersExist, signupEnabled }: AuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";
  const firstAdmin = isSignup && !usersExist;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignup) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Signup failed.");
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Invalid email, password, or inactive user.");
      }

      router.push("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.13),transparent_34%),linear-gradient(180deg,#08090b_0%,#0d1117_55%,#08090b_100%)] px-4">
      <Card className="glass-panel w-full max-w-md">
        <CardHeader>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
            <Gem className="h-5 w-5" aria-hidden />
          </div>
          <CardTitle>{isSignup ? "Create Account" : "Sign In"}</CardTitle>
          <CardDescription>
            {firstAdmin
              ? "First account becomes the admin and closes public signup."
              : isSignup
                ? "Create a user account for this instance."
                : "Use your instance email and password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {isSignup ? (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error ? (
              <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading || (isSignup && !signupEnabled)}>
              {loading ? "Please wait" : isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>
          <div className="mt-5 text-center text-sm text-slate-400">
            {isSignup ? (
              <Link href="/login" className="text-cyan-200 hover:text-cyan-100">
                Back to sign in
              </Link>
            ) : signupEnabled || !usersExist ? (
              <Link href="/signup" className="text-cyan-200 hover:text-cyan-100">
                Create an account
              </Link>
            ) : (
              <span>Signup is disabled by the admin.</span>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
