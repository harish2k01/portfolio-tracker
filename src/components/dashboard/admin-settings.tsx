"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: "ADMIN" | "USER";
  isActive: boolean;
  createdAt: string;
};

export function AdminSettings() {
  const [signupEnabled, setSignupEnabled] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState("");

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
            <ShieldCheck className="h-5 w-5 text-cyan-200" />
            <CardTitle>Instance Controls</CardTitle>
          </div>
          <CardDescription>First user is admin. Signup stays closed unless reopened here.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-white/10 bg-black/[0.16] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Public signup</p>
                <p className="text-sm text-slate-400">
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

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Activate or deactivate non-current users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="grid gap-4 rounded-lg border border-white/10 bg-black/[0.16] p-4 md:grid-cols-[1fr_auto_auto]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user.email}</p>
                <p className="text-xs text-slate-500">{user.name ?? "Unnamed user"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={user.role === "ADMIN" ? "default" : "muted"}>{user.role}</Badge>
                <Badge variant={user.isActive ? "success" : "danger"}>
                  {user.isActive ? "ACTIVE" : "INACTIVE"}
                </Badge>
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
        </CardContent>
      </Card>
    </section>
  );
}
