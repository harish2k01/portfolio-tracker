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
            <div className="mt-5 text-center text-sm text-[var(--muted)]">
              <Link href="/login" className="text-[var(--primary)] hover:text-[var(--primary-hover)]">
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
                <button type="button" className="text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setStep("email")}>
                  Change email
                </button>
                <button type="button" className="text-[var(--primary)] hover:text-[var(--primary-hover)]" onClick={handleForgotPassword}>
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
                <button type="button" className="text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setStep("email")}>
                  Change email
                </button>
                <button type="button" className="text-[var(--primary)] hover:text-[var(--primary-hover)]" onClick={handleForgotPassword}>
                  Send new temporary password
                </button>
              </div>
            </form>
          ) : null}

          {signupEnabled || !usersExist ? (
            <div className="mt-5 text-center text-sm text-[var(--muted)]">
              <Link href="/signup" className="text-[var(--primary)] hover:text-[var(--primary-hover)]">
                Create an account
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="theme-light min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-80px)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.78fr)]">
        <section className="order-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm sm:p-8 lg:order-1">
          <div className="flex items-center gap-3">
            <BrandMark compact />
            <div>
              <p className="text-lg font-semibold text-[var(--foreground)]">Portfolio Tracker</p>
              <p className="text-sm text-[var(--muted)]">Track investments, SIPs, holdings, and returns in one place.</p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <PreviewStat label="Portfolio value" value="₹5.2L" />
            <PreviewStat label="Monthly SIPs" value="₹42K" />
            <PreviewStat label="XIRR" value="9.4%" tone="positive" />
          </div>

          <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Portfolio trend</p>
                <p className="text-xs text-[var(--muted)]">A simple preview of the dashboard experience.</p>
              </div>
              <span className="rounded-full bg-[var(--positive-soft)] px-3 py-1 text-xs font-semibold text-[var(--positive)]">
                +2.5%
              </span>
            </div>
            <PreviewChart />
          </div>
        </section>

        <div className="order-1 flex justify-center lg:order-2">{children}</div>
      </div>
    </main>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-[#d9dee5]"
          : "mb-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-[#d9dee5]"
      }
    >
      <Image src="/logo.svg" alt="" width={compact ? 44 : 48} height={compact ? 44 : 48} priority />
    </div>
  );
}

function PreviewStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive";
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
      <p className={tone === "positive" ? "mt-3 text-2xl font-semibold text-[var(--positive)]" : "mt-3 text-2xl font-semibold text-[var(--foreground)]"}>
        {value}
      </p>
    </div>
  );
}

function PreviewChart() {
  return (
    <div className="h-44" aria-hidden>
      <svg viewBox="0 0 520 176" className="h-full w-full">
        <defs>
          <linearGradient id="authPreviewFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 154 L40 148 L78 132 L118 136 L154 112 L194 118 L232 84 L272 92 L312 70 L350 78 L390 52 L430 48 L470 32 L520 26 L520 176 L0 176 Z"
          fill="url(#authPreviewFill)"
        />
        <path
          d="M0 154 L40 148 L78 132 L118 136 L154 112 L194 118 L232 84 L272 92 L312 70 L350 78 L390 52 L430 48 L470 32 L520 26"
          fill="none"
          stroke="var(--primary)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        {[0, 1, 2].map((line) => (
          <line
            key={line}
            x1="0"
            x2="520"
            y1={48 + line * 48}
            y2={48 + line * 48}
            stroke="var(--line)"
            strokeDasharray="5 8"
            strokeWidth="1"
          />
        ))}
      </svg>
    </div>
  );
}

function FormMessage({ error, message }: { error: string; message: string }) {
  if (error) {
    return (
      <div className="rounded-lg border border-[var(--negative)]/30 bg-[var(--negative-soft)] p-3 text-sm text-[var(--negative)]">
        {error}
      </div>
    );
  }

  if (message) {
    return (
      <div className="rounded-lg border border-[var(--positive)]/30 bg-[var(--positive-soft)] p-3 text-sm text-[var(--positive)]">
        {message}
      </div>
    );
  }

  return null;
}
