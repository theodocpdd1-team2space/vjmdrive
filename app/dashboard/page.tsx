import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Clock,
  Folder,
  HardDrive,
  LayoutDashboard,
  Share2,
  Upload,
  User,
} from "lucide-react";
import { findUserById, getCurrentUser, userStoragePath, userStorageRelativePath } from "@/lib/auth";
import { listDriveFolder } from "@/lib/drive-list";
import { readShareLinks } from "@/lib/share-db";
import { directorySize, storageSummary } from "@/lib/storage";
import { LogoutButton } from "@/components/common/logout-button";

export const dynamic = "force-dynamic";

const userNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, active: true },
  { href: "/drive", label: "My Drive", icon: HardDrive },
  { href: "#shared", label: "Shared with Me", icon: Share2 },
  { href: "#account", label: "Account", icon: User },
];

export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");

  const user = await findUserById(session.id);
  if (!user) redirect("/login");

  const [usedBytes, myFiles, shares] = await Promise.all([
    directorySize(userStoragePath(user.id)),
    listDriveFolder({
      path: "",
      scopeRootPath: userStorageRelativePath(user.id),
      urlPrefix: "/api/user/files",
      canDownload: true,
    }).catch(() => ({ items: [] })),
    readShareLinks(),
  ]);

  const storage = storageSummary(usedBytes, user.quotaBytes);
  const now = Date.now();

  const sharedWithMe = shares.filter((share) => {
    if (share.disabledAt) return false;
    if (share.expiresAt && new Date(share.expiresAt).getTime() < now) return false;

    if (share.visibility === "PUBLIC") return true;
    if (share.visibility !== "PRIVATE_EMAILS") return false;

    return share.allowedEmails.includes(user.email);
  });

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      <div className="grid min-h-screen lg:grid-cols-[290px_1fr]">
        <aside className="hidden border-r border-white/10 bg-[#0b0c10]/95 p-4 lg:flex lg:flex-col">
          <SidebarHeader />

          <nav className="mt-6 space-y-1">
            {userNavItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${
                    item.active
                      ? "bg-[#d7ff3f] text-black shadow-[0_0_28px_rgba(215,255,63,0.12)]"
                      : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">Free Plan</p>
                <BarChart3 className="h-4 w-4 text-[#d7ff3f]" />
              </div>

              <p className="mt-1 text-xs text-zinc-500">
                {storage.used} used from {storage.quota}
              </p>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#d7ff3f]" style={{ width: `${storage.percent}%` }} />
              </div>

              <p className="mt-2 text-xs text-zinc-500">Upgrade plans coming soon.</p>
            </div>

            <LogoutButton className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50" />
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08090d]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <SidebarHeader compact />

              <LogoutButton className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 disabled:opacity-50" />
            </div>

            <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 text-xs">
              <Link href="/dashboard" className="shrink-0 rounded-full bg-[#d7ff3f] px-3 py-2 font-black text-black">
                Dashboard
              </Link>

              <Link href="/drive" className="shrink-0 rounded-full border border-white/10 px-3 py-2 font-bold text-zinc-300">
                My Drive
              </Link>

              <Link href="#shared" className="shrink-0 rounded-full border border-white/10 px-3 py-2 font-bold text-zinc-300">
                Shared
              </Link>
            </nav>
          </header>

          <div className="p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
              <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-bold text-[#d7ff3f]">{user.email}</p>
                  <h1 className="mt-1 text-3xl font-black tracking-tight text-white">Dashboard</h1>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
                    Manage your files, open shared folders, and monitor your driveOne storage.
                  </p>
                </div>

                <Link
                  href="/drive"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black transition hover:bg-[#c8ef34]"
                >
                  <Upload className="h-4 w-4" />
                  Upload Files
                </Link>
              </section>

              <div className="grid gap-3 md:grid-cols-3">
                <Metric icon={HardDrive} label="Storage" value={`${storage.used} / ${storage.quota}`} />
                <Metric icon={Folder} label="My files" value={String(myFiles.items.length)} />
                <Metric icon={Share2} label="Shared with me" value={String(sharedWithMe.length)} />
              </div>

              <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-zinc-300">Storage usage</span>
                  <span className="font-black text-[#d7ff3f]">{storage.percent}%</span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#d7ff3f]" style={{ width: `${storage.percent}%` }} />
                </div>

                <p className="mt-3 text-xs text-zinc-500">
                  Plan: <span className="font-bold text-white">{user.plan || "Free"}</span>. Default quota can be upgraded by admin.
                </p>
              </section>

              <div className="grid gap-4 xl:grid-cols-2">
                <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/20">
                  <div className="flex items-center justify-between border-b border-white/10 p-4">
                    <div>
                      <h2 className="font-black text-white">My files</h2>
                      <p className="mt-1 text-xs text-zinc-500">Latest files from your personal drive.</p>
                    </div>

                    <Link
                      href="/drive"
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#d7ff3f] px-3 py-2 text-sm font-black text-black"
                    >
                      <Upload className="h-4 w-4" />
                      Upload
                    </Link>
                  </div>

                  <div className="divide-y divide-white/10">
                    {myFiles.items.slice(0, 8).map((item) => (
                      <div key={item.path} className="flex items-center justify-between gap-3 p-4">
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

                <section
                  id="shared"
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/20"
                >
                  <div className="border-b border-white/10 p-4">
                    <h2 className="font-black text-white">Shared with me</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Public login-protected and private email shares available to you.
                    </p>
                  </div>

                  <div className="grid gap-3 p-3">
                    {sharedWithMe.map((share) => (
                      <div key={share.token} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                        <p className="font-bold text-white">{share.title}</p>

                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                          <span>{share.permission}</span>
                          <span>{share.visibility === "PUBLIC" ? "Public login-protected" : "Private email"}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {share.expiresAt ? new Date(share.expiresAt).toLocaleString("id-ID") : "Never expires"}
                          </span>
                        </div>

                        <Link
                          href={`/share/${share.token}`}
                          className="mt-4 inline-flex rounded-2xl bg-[#d7ff3f] px-3 py-2 text-sm font-black text-black"
                        >
                          Open
                        </Link>
                      </div>
                    ))}

                    {sharedWithMe.length === 0 ? <p className="p-2 text-sm text-zinc-500">No shares are available for this account yet.</p> : null}
                  </div>
                </section>
              </div>

              <section id="account" className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
                <h2 className="font-black text-white">Account</h2>

                <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                  <Info label="Email" value={user.email} />
                  <Info label="Role" value={user.role} />
                  <Info label="Plan" value={user.plan || "Free"} />
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SidebarHeader({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3">
      <div
        className={`${
          compact ? "h-10 w-10" : "h-11 w-11"
        } flex shrink-0 items-center justify-center rounded-2xl bg-[#d7ff3f] text-black shadow-[0_0_35px_rgba(215,255,63,0.18)]`}
      >
        <HardDrive className="h-5 w-5" />
      </div>

      <div className="min-w-0">
        <p className={`${compact ? "text-base" : "text-lg"} truncate font-black tracking-tight text-white`}>driveOne</p>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#d7ff3f]">by VJMRTIM</p>
      </div>
    </Link>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof HardDrive; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
      <Icon className="h-5 w-5 text-[#d7ff3f]" />
      <p className="mt-3 text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
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