import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, Folder, FolderPlus, HardDrive, Share2, Sparkles, Upload, User } from "lucide-react";
import { findUserById, getCurrentUser, userStoragePath, userStorageRelativePath } from "@/lib/auth";
import { getBeautySharesByOwner } from "@/lib/beauty-share-db";
import { listDriveFolder } from "@/lib/drive-list";
import { readShareLinks } from "@/lib/share-db";
import { directorySize, storageSummary } from "@/lib/storage";
import { planQuotaLabel } from "@/lib/plan-display";
import { UserShell } from "@/components/layout/user-shell";

export const dynamic = "force-dynamic";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isActiveShare(share: { disabledAt?: string | null; expiresAt?: string | null }, now: number) {
  if (share.disabledAt) return false;
  if (share.expiresAt && new Date(share.expiresAt).getTime() < now) return false;
  return true;
}

export default async function DashboardPage() {
  const session = await getCurrentUser();

  if (!session) redirect("/login?next=/dashboard");
  if (session.role === "ADMIN") redirect("/admin");

  const user = await findUserById(session.id);
  if (!user) redirect("/login");

  const [usedBytes, myFiles, shares, beautyShares] = await Promise.all([
    directorySize(userStoragePath(user)),
    listDriveFolder({
      path: "",
      scopeRootPath: userStorageRelativePath(user),
      urlPrefix: "/api/user/files",
      canDownload: true,
    }).catch(() => ({ items: [] })),
    readShareLinks(),
    getBeautySharesByOwner(user.id).catch(() => []),
  ]);

  const storage = storageSummary(usedBytes, user.quotaBytes);
  const planLabel = planQuotaLabel(user.plan, user.quotaBytes);
  const now = Date.now();
  const userEmail = normalizeEmail(user.email);

  const sharedWithMe = shares.filter((share) => {
    if (!isActiveShare(share, now)) return false;
    if (share.visibility !== "PRIVATE_EMAILS") return false;
    return share.allowedEmails.map(normalizeEmail).includes(userEmail);
  });

  return (
    <UserShell title="Dashboard" subtitle="Manage your files, private shares, and driveOne account.">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff3f]">driveOne User</p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white">Welcome back</h2>
              <p className="mt-2 text-sm font-bold text-zinc-300">{user.email}</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
                Manage files, create client delivery folders, and review private shares from one clean workspace.
              </p>
            </div>

            <Link href="/drive" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black transition hover:bg-[#c8ef34]">
              <Upload className="h-4 w-4" />
              Open My Drive
            </Link>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Metric icon={HardDrive} label="Storage used" value={`${storage.used} / ${storage.quota}`} />
          <Metric icon={Folder} label="My files" value={String(myFiles.items.length)} />
          <Metric icon={Share2} label="Shared with me" value={String(sharedWithMe.length)} />
          <Metric icon={Sparkles} label="Beauty Shares" value={String(beautyShares.length)} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-black text-white">Quick actions</h2>
              <p className="mt-1 text-sm text-zinc-500">Start the most common drive workflows.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <QuickAction href="/drive" icon={HardDrive} label="Open My Drive" />
              <QuickAction href="/drive" icon={FolderPlus} label="New Folder" />
              <QuickAction href="/drive" icon={Upload} label="Upload Files" />
              <QuickAction href="/beauty" icon={Sparkles} label="Beauty Shares" />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-zinc-300">Storage usage</span>
            <span className="font-black text-[#d7ff3f]">{storage.percent}%</span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#d7ff3f]" style={{ width: `${storage.percent}%` }} />
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            Plan: <span className="font-bold text-white">{planLabel}</span>
          </p>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/10">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div>
                <h2 className="font-black text-white">Recent files</h2>
                <p className="mt-1 text-xs text-zinc-500">Latest items from your personal drive.</p>
              </div>

              <Link href="/drive" className="inline-flex items-center gap-2 rounded-2xl bg-[#d7ff3f] px-3 py-2 text-sm font-black text-black">
                <Upload className="h-4 w-4" />
                Upload
              </Link>
            </div>

            <div className="divide-y divide-white/10">
              {myFiles.items.slice(0, 8).map((item) => (
                <div key={item.path} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{item.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">{item.type === "folder" ? "Folder" : "File"}</p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">{item.size || "Folder"}</span>
                </div>
              ))}

              {myFiles.items.length === 0 ? <p className="p-4 text-sm text-zinc-500">No uploaded files yet.</p> : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/10">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div>
                <h2 className="font-black text-white">Shared with me</h2>
                <p className="mt-1 text-xs text-zinc-500">Private shares where your email is allowed.</p>
              </div>

              <Link href="/shared" className="rounded-2xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-300 hover:bg-white/10">
                View all
              </Link>
            </div>

            <div className="grid gap-3 p-3">
              {sharedWithMe.slice(0, 6).map((share) => (
                <div key={share.token} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="font-bold text-white">{share.title}</p>

                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                    <span>{share.permission}</span>
                    <span>Private email</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {share.expiresAt ? new Date(share.expiresAt).toLocaleString("id-ID") : "Never expires"}
                    </span>
                  </div>

                  <Link href={`/share/${share.token}`} className="mt-4 inline-flex rounded-2xl bg-[#d7ff3f] px-3 py-2 text-sm font-black text-black">
                    Open
                  </Link>
                </div>
              ))}

              {sharedWithMe.length === 0 ? <p className="p-2 text-sm text-zinc-500">No private shares are available for this account.</p> : null}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10">
          <h2 className="font-black text-white">Account summary</h2>

          <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            <Info label="Email" value={user.email} />
            <Info label="Role" value={user.role} />
            <Info label="Plan" value={planLabel} />
          </div>
        </section>
      </div>
    </UserShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HardDrive;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10">
      <Icon className="h-5 w-5 text-[#d7ff3f]" />
      <p className="mt-3 text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: typeof HardDrive; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white">
      <Icon className="h-4 w-4 text-[#d7ff3f]" />
      {label}
    </Link>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 break-all font-bold text-white">{value}</p>
    </div>
  );
}
