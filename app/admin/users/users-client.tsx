"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Save, UserRound } from "lucide-react";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  plan: string;
  quotaBytes: number | null;
  storage: { used: string; quota: string; percent: number };
  emailVerified: boolean;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

const quotaOptions = [
  ["1 GB", 1024 ** 3],
  ["25 GB", 25 * 1024 ** 3],
  ["100 GB", 100 * 1024 ** 3],
  ["200 GB", 200 * 1024 ** 3],
  ["2 TB", 2 * 1024 ** 4],
  ["5 TB", 5 * 1024 ** 4],
];

export function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && data.ok) setUsers(data.users || []);
    else setNotice(data.message || "Failed to load users.");
  }

  async function patchUser(userId: string, patch: Record<string, unknown>) {
    setNotice("");
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...patch }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setNotice(data.message || "Update failed.");
      return;
    }
    setNotice("User updated.");
    await loadUsers();
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[#08090d] p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-[#d7ff3f]"><ArrowLeft className="h-4 w-4" />Back to admin</Link>
            <h1 className="mt-3 text-2xl font-semibold">Users</h1>
            <p className="mt-1 text-sm text-zinc-500">Manage accounts, plans, quota, and access status.</p>
          </div>
        </div>
        {notice ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">{notice}</p> : null}
        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-zinc-400"><Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />Loading users...</div>
        ) : (
          <div className="mt-5 grid gap-3">
            {users.map((user) => (
              <div key={user.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d7ff3f]/10 text-[#d7ff3f]"><UserRound className="h-5 w-5" /></span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{user.name}</p>
                        <p className="truncate text-sm text-zinc-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <Info label="Role" value={user.role} />
                      <Info label="Plan" value={user.plan} />
                      <Info label="Storage" value={`${user.storage.used} / ${user.storage.quota}`} />
                      <Info label="Verified" value={user.emailVerified ? "Yes" : "No"} />
                      <Info label="Status" value={user.disabled ? "Disabled" : "Active"} />
                      <Info label="Created" value={new Date(user.createdAt).toLocaleString("id-ID")} />
                      <Info label="Last login" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("id-ID") : "-"} />
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[#d7ff3f]" style={{ width: `${user.storage.percent}%` }} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-zinc-300">
                      Plan
                      <select defaultValue={user.plan} onChange={(event) => void patchUser(user.id, { plan: event.target.value })} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 outline-none">
                        {["Free", "Personal", "Pro", "Vendor", "Business", "Custom"].map((plan) => <option key={plan}>{plan}</option>)}
                      </select>
                    </label>
                    <label className="text-sm text-zinc-300">
                      Quota
                      <select defaultValue={user.quotaBytes ?? "unlimited"} onChange={(event) => void patchUser(user.id, { quotaBytes: event.target.value === "unlimited" ? null : Number(event.target.value) })} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 outline-none">
                        {quotaOptions.map(([label, value]) => <option key={String(value)} value={value}>{label}</option>)}
                        <option value="unlimited">Unlimited</option>
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => void patchUser(user.id, { emailVerified: !user.emailVerified })} className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">
                        {user.emailVerified ? "Unverify" : "Verify"}
                      </button>
                      <button onClick={() => void patchUser(user.id, { disabled: !user.disabled })} className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">
                        {user.disabled ? "Enable" : "Disable"}
                      </button>
                    </div>
                    <button disabled className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm font-semibold text-zinc-500">
                      <Save className="h-4 w-4" />
                      Reset email soon
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-zinc-100">{value}</p>
    </div>
  );
}
