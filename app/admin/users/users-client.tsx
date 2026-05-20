"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Clock,
  Database,
  HardDrive,
  Loader2,
  Mail,
  Save,
  Search,
  Shield,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  plan: string;
  quotaBytes: number | null;
  storage: {
    used: string;
    quota: string;
    percent: number;
  };
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

const planOptions = ["Free", "Personal", "Pro", "Vendor", "Business", "Custom"];

type FilterMode = "ALL" | "ACTIVE" | "DISABLED" | "VERIFIED" | "UNVERIFIED" | "ADMIN";

export function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);

    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));

    setLoading(false);

    if (res.ok && data.ok) {
      setUsers(data.users || []);
      return;
    }

    setNotice(data.message || "Failed to load users.");
  }

  async function patchUser(userId: string, patch: Record<string, unknown>) {
    setNotice("");
    setUpdatingId(userId);

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, ...patch }),
    });

    const data = await res.json().catch(() => ({}));

    setUpdatingId(null);

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

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((user) => !user.disabled).length;
    const disabled = users.filter((user) => user.disabled).length;
    const verified = users.filter((user) => user.emailVerified).length;
    const admins = users.filter((user) => user.role === "ADMIN").length;

    return {
      total,
      active,
      disabled,
      verified,
      admins,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !keyword ||
        user.name.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        user.role.toLowerCase().includes(keyword) ||
        user.plan.toLowerCase().includes(keyword);

      if (!matchesSearch) return false;

      if (filter === "ACTIVE") return !user.disabled;
      if (filter === "DISABLED") return user.disabled;
      if (filter === "VERIFIED") return user.emailVerified;
      if (filter === "UNVERIFIED") return !user.emailVerified;
      if (filter === "ADMIN") return user.role === "ADMIN";

      return true;
    });
  }, [users, query, filter]);

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      <section className="border-b border-white/10 bg-[#08090d]/90 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 transition hover:text-[#d7ff3f]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to admin
            </Link>

            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d7ff3f] text-black shadow-[0_0_35px_rgba(215,255,63,0.16)]">
                <Users className="h-6 w-6" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d7ff3f]">driveOne Admin</p>
                <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">Users</h1>
              </div>
            </div>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Manage accounts, plan access, quota limits, email verification, and user status.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Total accounts</p>
            <p className="mt-1 text-3xl font-black text-white">{metrics.total}</p>
          </div>
        </div>
      </section>

      <section className="px-4 py-5 md:px-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="grid gap-3 md:grid-cols-5">
            <Metric icon={Users} label="Users" value={String(metrics.total)} />
            <Metric icon={CheckCircle2} label="Active" value={String(metrics.active)} />
            <Metric icon={Ban} label="Disabled" value={String(metrics.disabled)} />
            <Metric icon={BadgeCheck} label="Verified" value={String(metrics.verified)} />
            <Metric icon={Shield} label="Admins" value={String(metrics.admins)} />
          </div>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, email, role, or plan..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-zinc-500" />
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as FilterMode)}
                  className="w-full bg-transparent text-sm font-bold text-white outline-none"
                >
                  <option value="ALL">All users</option>
                  <option value="ACTIVE">Active only</option>
                  <option value="DISABLED">Disabled only</option>
                  <option value="VERIFIED">Verified only</option>
                  <option value="UNVERIFIED">Unverified only</option>
                  <option value="ADMIN">Admins only</option>
                </select>
              </label>
            </div>

            {notice ? (
              <div className="mt-4 rounded-2xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-4 py-3 text-sm font-bold text-[#d7ff3f]">
                {notice}
              </div>
            ) : null}
          </section>

          {loading ? (
            <section className="flex h-72 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.035] text-zinc-400">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />
                Loading users...
              </div>
            </section>
          ) : null}

          {!loading && filteredUsers.length === 0 ? (
            <section className="flex h-72 flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] text-[#d7ff3f]">
                <UserRound className="h-7 w-7" />
              </div>
              <div>
                <p className="font-black text-white">No users found</p>
                <p className="mt-1 text-sm text-zinc-500">Try another keyword or filter.</p>
              </div>
            </section>
          ) : null}

          {!loading && filteredUsers.length > 0 ? (
            <div className="grid gap-4">
              {filteredUsers.map((user) => (
                <article
                  key={user.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/20"
                >
                  <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#d7ff3f]/10 text-[#d7ff3f]">
                            <UserRound className="h-5 w-5" />
                          </span>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-lg font-black text-white">{user.name || "Unnamed user"}</p>
                              <StatusBadge active={!user.disabled} />
                              <VerifiedBadge verified={user.emailVerified} />
                            </div>

                            <p className="mt-1 flex min-w-0 items-center gap-2 truncate text-sm text-zinc-500">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{user.email}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Pill>{user.role}</Pill>
                          <Pill>{user.plan || "Free"}</Pill>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <Info icon={Shield} label="Role" value={user.role} />
                        <Info icon={Database} label="Plan" value={user.plan || "Free"} />
                        <Info icon={HardDrive} label="Storage" value={`${user.storage.used} / ${user.storage.quota}`} />
                        <Info icon={BadgeCheck} label="Verified" value={user.emailVerified ? "Yes" : "No"} />
                        <Info icon={Ban} label="Status" value={user.disabled ? "Disabled" : "Active"} />
                        <Info icon={Clock} label="Created" value={formatDate(user.createdAt)} />
                        <Info icon={Clock} label="Last login" value={user.lastLoginAt ? formatDate(user.lastLoginAt) : "-"} />
                      </div>

                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="font-bold text-zinc-500">Storage usage</span>
                          <span className="font-black text-[#d7ff3f]">{user.storage.percent}%</span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-[#d7ff3f] transition-all"
                            style={{ width: `${Math.min(user.storage.percent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="font-black text-white">Quick settings</p>
                          <p className="mt-1 text-xs text-zinc-500">Changes are saved instantly.</p>
                        </div>

                        {updatingId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[#d7ff3f]" />
                        ) : (
                          <Save className="h-4 w-4 text-zinc-600" />
                        )}
                      </div>

                      <div className="grid gap-3">
                        <label className="text-sm font-bold text-zinc-300">
                          Plan
                          <select
                            defaultValue={user.plan}
                            disabled={updatingId === user.id}
                            onChange={(event) => void patchUser(user.id, { plan: event.target.value })}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-[#08090d] px-3 py-3 text-sm text-white outline-none disabled:opacity-50"
                          >
                            {planOptions.map((plan) => (
                              <option key={plan}>{plan}</option>
                            ))}
                          </select>
                        </label>

                        <label className="text-sm font-bold text-zinc-300">
                          Quota
                          <select
                            defaultValue={user.quotaBytes ?? "unlimited"}
                            disabled={updatingId === user.id}
                            onChange={(event) =>
                              void patchUser(user.id, {
                                quotaBytes: event.target.value === "unlimited" ? null : Number(event.target.value),
                              })
                            }
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-[#08090d] px-3 py-3 text-sm text-white outline-none disabled:opacity-50"
                          >
                            {quotaOptions.map(([label, value]) => (
                              <option key={String(value)} value={value}>
                                {label}
                              </option>
                            ))}
                            <option value="unlimited">Unlimited</option>
                          </select>
                        </label>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => void patchUser(user.id, { emailVerified: !user.emailVerified })}
                            disabled={updatingId === user.id}
                            className="rounded-2xl border border-white/10 px-3 py-3 text-sm font-bold text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
                          >
                            {user.emailVerified ? "Unverify" : "Verify"}
                          </button>

                          <button
                            onClick={() => void patchUser(user.id, { disabled: !user.disabled })}
                            disabled={updatingId === user.id}
                            className={`rounded-2xl border px-3 py-3 text-sm font-bold transition disabled:opacity-50 ${
                              user.disabled
                                ? "border-[#d7ff3f]/30 bg-[#d7ff3f]/10 text-[#d7ff3f] hover:bg-[#d7ff3f]/15"
                                : "border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/15"
                            }`}
                          >
                            {user.disabled ? "Enable" : "Disable"}
                          </button>
                        </div>

                        <button
                          disabled
                          className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 py-3 text-sm font-bold text-zinc-500"
                        >
                          <Save className="h-4 w-4" />
                          Reset email soon
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
      <Icon className="h-5 w-5 text-[#d7ff3f]" />
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-bold text-zinc-100">{value}</p>
    </div>
  );
}

function Pill({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-zinc-300">
      {children}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${
        active ? "bg-[#d7ff3f]/10 text-[#d7ff3f]" : "bg-red-500/10 text-red-200"
      }`}
    >
      {active ? "Active" : "Disabled"}
    </span>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${
        verified ? "bg-blue-500/10 text-blue-200" : "bg-white/10 text-zinc-400"
      }`}
    >
      {verified ? "Verified" : "Unverified"}
    </span>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("id-ID");
}