import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, Folder, HardDrive, Share2, Upload } from "lucide-react";
import { findUserById, getCurrentUser, userStoragePath, userStorageRelativePath } from "@/lib/auth";
import { listDriveFolder } from "@/lib/drive-list";
import { readShareLinks } from "@/lib/share-db";
import { directorySize, storageSummary } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");

  const user = await findUserById(session.id);
  if (!user) redirect("/login");

  const [usedBytes, myFiles, shares] = await Promise.all([
    directorySize(userStoragePath(user.id)),
    listDriveFolder({ path: "", scopeRootPath: userStorageRelativePath(user.id), urlPrefix: "/api/user/files", canDownload: true }).catch(() => ({ items: [] })),
    readShareLinks(),
  ]);
  const storage = storageSummary(usedBytes, user.quotaBytes);
  const now = new Date().getTime();
  const sharedWithMe = shares.filter((share) => {
    if (share.visibility !== "PRIVATE_EMAILS") return false;
    if (!share.allowedEmails.includes(user.email)) return false;
    if (share.disabledAt) return false;
    if (share.expiresAt && new Date(share.expiresAt).getTime() < now) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      <div className="grid min-h-screen lg:grid-cols-[240px_1fr]">
        <aside className="border-b border-white/10 bg-[#0c0d12] p-4 lg:border-b-0 lg:border-r">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d7ff3f] text-black">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#d7ff3f]">VJMRTIM</p>
              <h1 className="font-semibold text-white">VJM Drive</h1>
            </div>
          </div>
          <nav className="grid gap-1 text-sm text-zinc-400">
            <a className="rounded-lg bg-[#d7ff3f] px-3 py-2 text-black">Dashboard</a>
            <a className="rounded-lg px-3 py-2 hover:bg-white/10 hover:text-white">My Drive</a>
            <a className="rounded-lg px-3 py-2 hover:bg-white/10 hover:text-white">Shared with Me</a>
            <a className="rounded-lg px-3 py-2 hover:bg-white/10 hover:text-white">Recent</a>
            <a className="rounded-lg px-3 py-2 hover:bg-white/10 hover:text-white">Account</a>
          </nav>
        </aside>
        <section className="p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[#d7ff3f]">{user.email}</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Dashboard</h2>
            </div>
            <form action="/api/logout" method="post">
              <button className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">Logout</button>
            </form>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Metric icon={HardDrive} label="Storage" value={`${storage.used} / ${storage.quota}`} />
            <Metric icon={Folder} label="My files" value={String(myFiles.items.length)} />
            <Metric icon={Share2} label="Shared with me" value={String(sharedWithMe.length)} />
          </div>

          <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Storage usage</span>
              <span>{storage.percent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#d7ff3f]" style={{ width: `${storage.percent}%` }} />
            </div>
          </section>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg border border-white/10 bg-white/[0.03]">
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <h3 className="font-semibold">My files</h3>
                <button className="inline-flex items-center gap-2 rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black">
                  <Upload className="h-4 w-4" />
                  Upload
                </button>
              </div>
              <div className="divide-y divide-white/10">
                {myFiles.items.slice(0, 8).map((item) => (
                  <div key={item.path} className="flex items-center justify-between gap-3 p-4">
                    <span className="truncate text-sm text-white">{item.name}</span>
                    <span className="text-xs text-zinc-500">{item.size || "Folder"}</span>
                  </div>
                ))}
                {myFiles.items.length === 0 ? <p className="p-4 text-sm text-zinc-500">No uploaded files yet.</p> : null}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.03]">
              <div className="border-b border-white/10 p-4">
                <h3 className="font-semibold">Shared with me</h3>
              </div>
              <div className="grid gap-3 p-3">
                {sharedWithMe.map((share) => (
                  <div key={share.token} className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <p className="font-medium text-white">{share.title}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                      <span>{share.permission}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{share.expiresAt ? new Date(share.expiresAt).toLocaleString("id-ID") : "Never expires"}</span>
                    </div>
                    <Link href={`/share/${share.token}`} className="mt-4 inline-flex rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black">
                      Open
                    </Link>
                  </div>
                ))}
                {sharedWithMe.length === 0 ? <p className="p-2 text-sm text-zinc-500">No private shares for this email yet.</p> : null}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof HardDrive; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <Icon className="h-5 w-5 text-[#d7ff3f]" />
      <p className="mt-3 text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
