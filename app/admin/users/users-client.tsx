"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Database,
  HardDrive,
  Loader2,
  Mail,
  Plus,
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
  role: "ADMIN" | "USER" | string;
  plan: string;
  quotaBytes: number | null;
  storageUsedBytes: number;
  storageLimitBytes: number | null;
  storage: {
    used: string;
    quota: string;
    percent: number;
  };
  emailVerified: boolean;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
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
type RoleFilter = "ALL" | "ADMIN" | "USER";

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pick(raw: RawRecord, keys: string[]) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  }
  return undefined;
}

function safeText(value: unknown, fallback = "-") {
  if (typeof value === "string") {
    const clean = value.trim();
    return clean || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

function safeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "active", "verified"].includes(normalized)) return true;
    if (["false", "0", "no", "disabled", "inactive", "unverified"].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeRole(value: unknown) {
  const role = safeText(value, "USER").toUpperCase();
  return role === "ADMIN" ? "ADMIN" : "USER";
}

function normalizePlan(value: unknown, role: string) {
  const plan = safeText(value, role === "ADMIN" ? "Custom" : "Free");
  return plan === "-" ? (role === "ADMIN" ? "Custom" : "Free") : plan;
}

function bytesFrom(value: unknown, fallback = 0) {
  if (isRecord(value)) {
    return safeNumber(pick(value, ["bytes", "value", "used", "quota", "limit"]), fallback);
  }
  return safeNumber(value, fallback);
}

function nullableBytesFrom(value: unknown) {
  if (value === null || value === "unlimited" || value === "Unlimited") return null;
  const bytes = bytesFrom(value, 0);
  return bytes > 0 ? bytes : 0;
}

function formatBytes(value: unknown) {
  const bytes = bytesFrom(value, 0);
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function formatQuota(value: unknown) {
  if (value === null || value === "unlimited" || value === "Unlimited") return "Unlimited";
  const bytes = bytesFrom(value, 0);
  return bytes > 0 ? formatBytes(bytes) : "0 B";
}

function normalizeUser(value: unknown, index: number): AdminUser {
  const raw = isRecord(value) ? value : {};
  const role = normalizeRole(pick(raw, ["role", "userRole"]));
  const email = safeText(pick(raw, ["email", "mail", "username"]), `unknown-${index + 1}@driveone.local`);
  const id = safeText(pick(raw, ["id", "userId", "_id", "uid"]), email || `user-${index + 1}`);
  const name = safeText(pick(raw, ["name", "displayName", "username"]), email);
  const plan = normalizePlan(pick(raw, ["plan", "planName", "subscriptionPlan"]), role);
  const storage = isRecord(raw.storage) ? raw.storage : {};
  const quotaValue = pick(raw, ["quotaBytes", "storageLimitBytes", "storageLimit", "quota"]);
  const usedValue = pick(raw, ["usedBytes", "storageUsedBytes", "usageBytes"]);
  const storageUsedBytes = bytesFrom(pick(storage, ["usedBytes", "bytes", "usedValue"]) ?? usedValue, bytesFrom(storage.used, 0));
  const storageLimitBytes = nullableBytesFrom(pick(storage, ["quotaBytes", "limitBytes", "quotaValue"]) ?? quotaValue);
  const storagePercent =
    storageLimitBytes && storageLimitBytes > 0
      ? Math.max(0, Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100)))
      : Math.max(0, Math.min(100, safeNumber(storage.percent, 0)));
  const status = safeText(pick(raw, ["status", "isActive"]), "active").toLowerCase();
  const disabled = safeBoolean(raw.disabled, status === "disabled" || status === "inactive");

  return {
    id,
    name,
    email,
    role,
    plan,
    quotaBytes: storageLimitBytes,
    storageUsedBytes,
    storageLimitBytes,
    storage: {
      used: safeText(storage.used, formatBytes(storageUsedBytes)),
      quota: safeText(storage.quota, formatQuota(storageLimitBytes)),
      percent: storagePercent,
    },
    emailVerified: safeBoolean(raw.emailVerified, false),
    disabled,
    createdAt: safeText(pick(raw, ["createdAt", "created_at"]), "-"),
    updatedAt: safeText(pick(raw, ["updatedAt", "updated_at"]), "-"),
    lastLoginAt: typeof raw.lastLoginAt === "string" ? raw.lastLoginAt : null,
  };
}

function parseUsersResponse(data: unknown) {
  if (Array.isArray(data)) return data.map(normalizeUser);
  if (isRecord(data) && Array.isArray(data.users)) return data.users.map(normalizeUser);
  return null;
}

export function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("ALL");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setLoadError("");

    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      const normalizedUsers = parseUsersResponse(data);

      setLoading(false);

      if (res.ok && normalizedUsers) {
        setUsers(normalizedUsers);
        return;
      }

      const message = isRecord(data) && typeof data.message === "string" ? data.message : "Unable to load users. Please check admin data.";
      setUsers([]);
      setLoadError(message);
      setNotice(message);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to load users.";
      setLoading(false);
      setUsers([]);
      setLoadError(message);
      setNotice(message);
    }
  }

  async function patchUser(userId: string, patch: Record<string, unknown>) {
    setNotice("");
    setUpdatingId(userId);

    try {
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
        setNotice(isRecord(data) && typeof data.message === "string" ? data.message : "Update failed.");
        return;
      }

      setNotice("User updated.");
      await loadUsers();
    } catch (caught) {
      setUpdatingId(null);
      setNotice(caught instanceof Error ? caught.message : "Update failed.");
    }
  }

  async function createAdminUser(input: { email: string; password: string; role: "ADMIN" | "USER"; plan: string; quotaBytes: number | null }) {
    setNotice("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(isRecord(data) && typeof data.message === "string" ? data.message : "Create user failed.");
    }
    setNotice("User created.");
    await loadUsers();
  }

  function toggleExpanded(userId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
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
      if (roleFilter !== "ALL" && user.role !== roleFilter) return false;
      if (planFilter !== "ALL" && user.plan !== planFilter) return false;

      if (filter === "ACTIVE") return !user.disabled;
      if (filter === "DISABLED") return user.disabled;
      if (filter === "VERIFIED") return user.emailVerified;
      if (filter === "UNVERIFIED") return !user.emailVerified;
      if (filter === "ADMIN") return user.role === "ADMIN";

      return true;
    });
  }, [users, query, filter, roleFilter, planFilter]);

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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black">
              <Plus className="h-4 w-4" />
              Add User
            </button>
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Total accounts</p>
              <p className="mt-1 text-3xl font-black text-white">{metrics.total}</p>
            </div>
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
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px_190px_auto]">
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
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <Shield className="h-4 w-4 shrink-0 text-zinc-500" />
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)} className="w-full bg-transparent text-sm font-bold text-white outline-none">
                  <option value="ALL">All roles</option>
                  <option value="USER">Users</option>
                  <option value="ADMIN">Admins</option>
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <Database className="h-4 w-4 shrink-0 text-zinc-500" />
                <select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)} className="w-full bg-transparent text-sm font-bold text-white outline-none">
                  <option value="ALL">All plans</option>
                  {planOptions.map((plan) => <option key={plan}>{plan}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => { setQuery(""); setFilter("ALL"); setRoleFilter("ALL"); setPlanFilter("ALL"); }} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-300 hover:bg-white/10">
                Clear
              </button>
            </div>

            {notice ? (
              <div className="mt-4 rounded-2xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-4 py-3 text-sm font-bold text-[#d7ff3f]">
                {notice}
              </div>
            ) : null}
          </section>

          {!loading && loadError ? (
            <section className="rounded-3xl border border-red-300/20 bg-red-300/10 p-5 text-red-50 shadow-2xl shadow-black/20">
              <p className="text-lg font-black">Failed to load users</p>
              <p className="mt-2 text-sm leading-6 text-red-100/80">{loadError}</p>
              <button type="button" onClick={() => void loadUsers()} className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#08090d]">
                Retry
              </button>
            </section>
          ) : null}

          {loading ? (
            <section className="flex h-72 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.035] text-zinc-400">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />
                Loading users...
              </div>
            </section>
          ) : null}

          {!loading && !loadError && filteredUsers.length === 0 ? (
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

          {!loading && !loadError && filteredUsers.length > 0 ? (
            <div className="grid gap-4">
              {filteredUsers.map((user) => {
                const isExpanded = expanded.has(user.id);
                return (
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
                          <button onClick={() => toggleExpanded(user.id)} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-zinc-300 hover:bg-white/10">
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {isExpanded ? "Collapse" : "Expand"}
                          </button>
                        </div>
                      </div>

                      {isExpanded ? (
                      <>
                      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <Info icon={Shield} label="Role" value={user.role} />
                        <Info icon={Database} label="Plan" value={user.plan || "Free"} />
                        <Info icon={HardDrive} label="Storage" value={`${user.storage.used} / ${user.storage.quota}`} />
                        <Info icon={BadgeCheck} label="Verified" value={user.emailVerified ? "Yes" : "No"} />
                        <Info icon={Ban} label="Status" value={user.disabled ? "Disabled" : "Active"} />
                        <Info icon={Clock} label="Created" value={formatDate(user.createdAt)} />
                        <Info icon={Clock} label="Updated" value={formatDate(user.updatedAt)} />
                        <Info icon={Clock} label="Last login" value={formatDate(user.lastLoginAt)} />
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
                      </>
                      ) : null}
                    </div>

                    {isExpanded ? <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
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
                            value={user.plan}
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
                            value={user.quotaBytes === null ? "unlimited" : String(user.quotaBytes)}
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
                    </div> : null}
                  </div>
                </article>
              );
              })}
            </div>
          ) : null}
        </div>
      </section>
      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={async (input) => {
          await createAdminUser(input);
          setAddOpen(false);
        }}
      />
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

function AddUserModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { email: string; password: string; role: "ADMIN" | "USER"; plan: string; quotaBytes: number | null }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");
  const [plan, setPlan] = useState("Free");
  const [quota, setQuota] = useState<string>(String(1024 ** 3));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onCreate({
        email,
        password,
        role,
        plan,
        quotaBytes: quota === "unlimited" ? null : Number(quota),
      });
      setEmail("");
      setPassword("");
      setRole("USER");
      setPlan("Free");
      setQuota(String(1024 ** 3));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Create user failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end bg-black/70 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-4">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-3xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:max-w-xl md:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff3f]">Add User</p>
            <h2 className="mt-2 text-xl font-black text-white">Create account</h2>
          </div>
          <button onClick={onClose} disabled={submitting} className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-50" aria-label="Close add user">
            <Ban className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="text-sm font-bold text-zinc-300">
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none" required />
          </label>
          <label className="text-sm font-bold text-zinc-300">
            Temporary password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none" required />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-bold text-zinc-300">
              Role
              <select value={role} onChange={(event) => setRole(event.target.value as "ADMIN" | "USER")} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none">
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>
            <label className="text-sm font-bold text-zinc-300">
              Plan
              <select value={plan} onChange={(event) => setPlan(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none">
                {planOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold text-zinc-300">
              Quota
              <select value={quota} onChange={(event) => setQuota(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none">
                {quotaOptions.map(([label, value]) => (
                  <option key={String(value)} value={value}>{label}</option>
                ))}
                <option value="unlimited">Unlimited</option>
              </select>
            </label>
          </div>

          {error ? <p className="rounded-2xl border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button onClick={onClose} disabled={submitting} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-50">Cancel</button>
            <button onClick={() => void submit()} disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black disabled:opacity-60">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create User
            </button>
          </div>
        </div>
      </div>
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

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value === "-") return "-";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("id-ID");
}
