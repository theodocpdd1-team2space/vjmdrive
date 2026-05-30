import { redirect } from "next/navigation";
import { HardDrive, Mail, Shield, User } from "lucide-react";
import { findUserById, getCurrentUser, userStoragePath } from "@/lib/auth";
import { directorySize, storageSummary } from "@/lib/storage";
import { planQuotaLabel } from "@/lib/plan-display";
import { UserShell } from "@/components/layout/user-shell";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getCurrentUser();

  if (!session) redirect("/login?next=/account");
  if (session.role === "ADMIN") redirect("/admin");

  const user = await findUserById(session.id);
  if (!user) redirect("/login");

  const usedBytes = await directorySize(userStoragePath(user));
  const storage = storageSummary(usedBytes, user.quotaBytes);
  const planLabel = planQuotaLabel(user.plan, user.quotaBytes);

  return (
    <UserShell title="Account" subtitle="Your driveOne account and storage summary.">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#d7ff3f] text-black">
              <User className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-black text-white">{user.name || "User Account"}</h2>
              <p className="mt-1 truncate text-sm text-zinc-500">{user.email}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-3">
          <Info icon={Mail} label="Email" value={user.email} />
          <Info icon={Shield} label="Role" value={user.role} />
          <Info icon={HardDrive} label="Plan" value={planLabel} />
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-zinc-300">Storage usage</span>
            <span className="font-black text-[#d7ff3f]">{storage.percent}%</span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#d7ff3f]" style={{ width: `${storage.percent}%` }} />
          </div>

          <p className="mt-3 text-sm text-zinc-500">
            {storage.used} used from {storage.quota}
          </p>
        </section>
      </div>
    </UserShell>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
      <Icon className="h-5 w-5 text-[#d7ff3f]" />
      <p className="mt-3 text-xs text-zinc-500">{label}</p>
      <p className="mt-1 break-all text-lg font-black text-white">{value}</p>
    </div>
  );
}
