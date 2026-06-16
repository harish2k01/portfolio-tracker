"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useState } from "react";
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TablePagination, usePagination } from "@/components/ui/pagination";

type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: "ADMIN" | "USER";
  isActive: boolean;
  mustResetPassword: boolean;
  createdAt: string;
};

export function AdminSettings({
  onResetPortfolio,
  isResetting,
}: {
  onResetPortfolio: () => void;
  isResetting: boolean;
}) {
  const [signupEnabled, setSignupEnabled] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const userPagination = usePagination(users);

  async function load() {
    const [settingsResponse, usersResponse] = await Promise.all([
      fetch("/api/admin/settings", { cache: "no-store" }),
      fetch("/api/admin/users", { cache: "no-store" }),
    ]);

    if (settingsResponse.ok) {
      const settings = await settingsResponse.json();
      setSignupEnabled(settings.signupEnabled);
    }

    if (usersResponse.ok) {
      const payload = await usersResponse.json();
      setUsers(payload.users);
      setCurrentAdminId(payload.currentAdminId);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleSignup() {
    const next = !signupEnabled;
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signupEnabled: next }),
    });

    if (response.ok) {
      setSignupEnabled(next);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsCreating(true);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newUserName, email: newUserEmail }),
    });
    const payload = await response.json();
    setIsCreating(false);

    if (!response.ok) {
      setError(payload.error ?? "Unable to add user.");
      return;
    }

    setNewUserName("");
    setNewUserEmail("");
    setMessage("Temporary password email sent.");
    await load();
  }

  async function toggleUser(user: AdminUser) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, isActive: !user.isActive }),
    });

    if (response.ok) {
      await load();
    }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-500" />
            <CardTitle>Instance Controls</CardTitle>
          </div>
          <CardDescription>First user is admin. Signup stays closed unless reopened here.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Public signup</p>
                <p className="text-sm text-[var(--muted)]">
                  {signupEnabled ? "New users can register." : "New registrations are blocked."}
                </p>
              </div>
              <Button type="button" variant={signupEnabled ? "danger" : "default"} onClick={toggleSignup}>
                {signupEnabled ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel xl:row-span-1">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-500" />
            <CardTitle>Add User</CardTitle>
          </div>
          <CardDescription>Creates a user and emails a temporary password</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end" onSubmit={createUser}>
            <div className="space-y-2">
              <Label htmlFor="new-user-name">Name</Label>
              <Input
                id="new-user-name"
                value={newUserName}
                onChange={(event) => setNewUserName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-email">Email</Label>
              <Input
                id="new-user-email"
                type="email"
                value={newUserEmail}
                onChange={(event) => setNewUserEmail(event.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Sending" : "Add User"}
            </Button>
          </form>
          {message ? <p className="mt-3 text-sm text-[var(--positive)]">{message}</p> : null}
          {error ? <p className="mt-3 text-sm text-[var(--negative)]">{error}</p> : null}
        </CardContent>
      </Card>

      <Card className="glass-panel xl:col-span-2">
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Activate or deactivate non-current users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {userPagination.items.map((user) => (
            <div
              key={user.id}
              className="grid gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4 md:grid-cols-[1fr_auto_auto]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">{user.email}</p>
                <p className="text-xs text-[var(--muted)]">{user.name ?? "Unnamed user"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={user.role === "ADMIN" ? "default" : "muted"}>{user.role}</Badge>
                <Badge variant={user.isActive ? "success" : "danger"}>
                  {user.isActive ? "ACTIVE" : "INACTIVE"}
                </Badge>
                {user.mustResetPassword ? <Badge variant="warning">RESET</Badge> : null}
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={user.id === currentAdminId}
                onClick={() => toggleUser(user)}
              >
                {user.isActive ? "Deactivate" : "Activate"}
              </Button>
            </div>
          ))}
          {users.length ? (
            <TablePagination
              {...userPagination}
              className="rounded-md border border-[var(--line)]"
              onPageChange={userPagination.setPage}
              onPageSizeChange={userPagination.setPageSize}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card className="glass-panel xl:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-[var(--negative)]" />
            <CardTitle>Portfolio Data</CardTitle>
          </div>
          <CardDescription>Remove all transactions, SIPs, holdings, and portfolio history for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 rounded-lg border border-[var(--negative)]/25 bg-[var(--negative-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Start from scratch</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Your login and user account remain active.</p>
            </div>
            <Button type="button" variant="danger" disabled={isResetting} onClick={onResetPortfolio}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Reset portfolio data
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
