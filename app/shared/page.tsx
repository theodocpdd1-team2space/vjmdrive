import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, Share2 } from "lucide-react";
import { findUserById, getCurrentUser } from "@/lib/auth";
import { readShareLinks } from "@/lib/share-db";
import { UserShell } from "@/components/layout/user-shell";

export const dynamic = "force-dynamic";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export default async function SharedWithMePage() {
  const session = await getCurrentUser();

  if (!session) redirect("/login?next=/shared");
  if (session.role === "ADMIN") redirect("/admin");

  const user = await findUserById(session.id);
  if (!user) redirect("/login");

  const now = Date.now();
  const userEmail = normalizeEmail(user.email);
  const shares = await readShareLinks();

  const sharedWithMe = shares.filter((share) => {
    if (share.disabledAt) return false;
    if (share.expiresAt && new Date(share.expiresAt).getTime() < now) return false;
    if (share.visibility !== "PUBLIC_LOGIN") return false;
    if (share.allowedEmails.length === 0) return true;

    return share.allowedEmails.map(normalizeEmail).includes(userEmail);
  });

  return (
    <UserShell
      title="Shared with Me"
      subtitle="Private shares where your email is still allowed."
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d7ff3f]/10 text-[#d7ff3f]">
              <Share2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Private access</h2>
              <p className="mt-1 text-sm text-zinc-500">
                If your email is removed by the owner, the share disappears from this page.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sharedWithMe.map((share) => (
            <article key={share.token} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-white">{share.title}</p>
                  <p className="mt-1 truncate text-sm text-zinc-500">{share.rootPath || "Shared item"}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#d7ff3f]/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#d7ff3f]">
                  Private
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-500">
                <span>{share.permission}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {share.expiresAt ? new Date(share.expiresAt).toLocaleString("id-ID") : "Never expires"}
                </span>
              </div>

              <Link
                href={`/share/${share.token}`}
                className="mt-5 inline-flex rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black"
              >
                Open Share
              </Link>
            </article>
          ))}
        </div>

        {sharedWithMe.length === 0 ? (
          <section className="flex h-72 flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] text-[#d7ff3f]">
              <Share2 className="h-7 w-7" />
            </div>
            <div>
              <p className="font-black text-white">No private shares</p>
              <p className="mt-1 text-sm text-zinc-500">No files are currently shared with your email.</p>
            </div>
          </section>
        ) : null}
      </div>
    </UserShell>
  );
}
