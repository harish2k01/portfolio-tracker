"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { ReactNode } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthFormProps = {
  mode: "login" | "signup";
  usersExist: boolean;
  signupEnabled: boolean;
};

type LookupUser = {
  email: string;
  name: string | null;
  mustResetPassword: boolean;
};

type LoginStep = "email" | "password" | "reset";

export function AuthForm({ mode, usersExist, signupEnabled }: AuthFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("email");
  const [lookupUser, setLookupUser] = useState<LookupUser | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";
  const firstAdmin = isSignup && !usersExist;
  const displayName = lookupUser?.name?.trim() || lookupUser?.email || email;

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Signup failed.");
      }

      await signInWithPassword(email, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const response = await fetch("/api/auth/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to find user.");
      return;
    }

    setLookupUser(payload);
    setStep(payload.mustResetPassword ? "reset" : "password");
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithPassword(lookupUser?.email ?? email, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const resetResponse = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: lookupUser?.email ?? email,
        temporaryPassword,
        newPassword,
      }),
    });
    const resetPayload = await resetResponse.json();

    if (!resetResponse.ok) {
      setLoading(false);
      setError(resetPayload.error ?? "Unable to reset password.");
      return;
    }

    try {
      await signInWithPassword(lookupUser?.email ?? email, newPassword);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Password reset succeeded, but sign in failed.");
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setMessage("");
    setLoading(true);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: lookupUser?.email ?? email }),
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to send temporary password.");
      return;
    }

    setMessage("Temporary password email sent.");
    setStep("reset");
  }

  async function signInWithPassword(loginEmail: string, loginPassword: string) {
    const result = await signIn("credentials", {
      email: loginEmail,
      password: loginPassword,
      redirect: false,
    });

    if (result?.error) {
      throw new Error("Invalid password or inactive user.");
    }

    router.push("/");
    router.refresh();
  }

  if (isSignup) {
    return (
      <AuthShell>
        <Card className="glass-panel w-full max-w-md">
          <CardHeader>
            <BrandMark />
            <CardTitle>Create Account</CardTitle>
            <CardDescription>
              {firstAdmin ? "First account becomes the admin." : "Create a user account for this instance."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSignup}>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
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
              <FormMessage error={error} message={message} />
              <Button type="submit" className="w-full" disabled={loading || (isSignup && !signupEnabled)}>
                {loading ? "Please wait" : "Create account"}
              </Button>
            </form>
            <div className="mt-5 text-center text-sm text-slate-400">
              <Link href="/login" className="text-[#0787e5] hover:text-[#006fc4]">
                Back to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="glass-panel w-full max-w-md">
        <CardHeader>
          <BrandMark />
          <CardTitle>
            {step === "email" ? "Sign In" : step === "password" ? `Welcome, ${displayName}` : "Reset Password"}
          </CardTitle>
          <CardDescription>
            {step === "email"
              ? "Enter your email to continue."
              : step === "password"
                ? "Enter your password."
                : `Set a new password for ${displayName}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form className="space-y-4" onSubmit={handleEmailSubmit}>
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <FormMessage error={error} message={message} />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Checking" : "Continue"}
              </Button>
            </form>
          ) : null}

          {step === "password" ? (
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoFocus
                />
              </div>
              <FormMessage error={error} message={message} />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in" : "Sign in"}
              </Button>
              <div className="flex justify-between text-sm">
                <button type="button" className="text-slate-400 hover:text-white" onClick={() => setStep("email")}>
                  Change email
                </button>
                <button type="button" className="text-[#0787e5] hover:text-[#006fc4]" onClick={handleForgotPassword}>
                  Forgot password
                </button>
              </div>
            </form>
          ) : null}

          {step === "reset" ? (
            <form className="space-y-4" onSubmit={handleResetSubmit}>
              <div className="space-y-2">
                <Label htmlFor="temporary-password">Temporary password</Label>
                <Input
                  id="temporary-password"
                  type="password"
                  value={temporaryPassword}
                  onChange={(event) => setTemporaryPassword(event.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </div>
              <FormMessage error={error} message={message} />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving" : "Set password and sign in"}
              </Button>
              <div className="flex justify-between text-sm">
                <button type="button" className="text-slate-400 hover:text-white" onClick={() => setStep("email")}>
                  Change email
                </button>
                <button type="button" className="text-[#0787e5] hover:text-[#006fc4]" onClick={handleForgotPassword}>
                  Send new temporary password
                </button>
              </div>
            </form>
          ) : null}

          <div className="mt-5 text-center text-sm text-slate-400">
            {signupEnabled || !usersExist ? (
              <Link href="/signup" className="text-[#0787e5] hover:text-[#006fc4]">
                Create an account
              </Link>
            ) : (
              <span>Signup is disabled by the admin.</span>
            )}
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="theme-light flex min-h-screen items-center justify-center bg-[#fbfcfd] px-4">
      {children}
    </main>
  );
}

function BrandMark() {
  return (
    <div className="mb-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-[#d9dee5]">
      <Image src="/logo.svg" alt="" width={48} height={48} priority />
    </div>
  );
}

function FormMessage({ error, message }: { error: string; message: string }) {
  if (error) {
    return (
      <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
        {error}
      </div>
    );
  }

  if (message) {
    return (
      <div className="rounded-md border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
        {message}
      </div>
    );
  }

  return null;
}
