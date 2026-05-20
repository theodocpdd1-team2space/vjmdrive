"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Copy, ExternalLink, Mail, Trash2 } from "lucide-react";
import type { ShareLink } from "@/lib/share-db";

export function AdminSharesClient({ initialShares, origin, now }: { initialShares: ShareLink[]; origin: string; now: number }) {
  const [shares, setShares] = useState(initialShares);
  const [notice, setNotice] = useState("");

  async function refresh() {
    const res = await fetch("/api/admin/shares", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) setShares(data.links || []);
  }

  async function disableShare(token: string) {
    const res = await fetch(`/api/admin/shares/${token}`, { method: "DELETE" });
    setNotice(res.ok ? "Share disabled." : "Failed to disable share.");
    await refresh();
  }

  async function resendInvite(token: string, email: string) {
    const res = await fetch(`/api/admin/shares/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setNotice(res.ok ? `Invite sent to ${email}.` : "Invite failed.");
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setNotice("Link copied.");
  }

  return (
    <main className="min-h-screen bg-[#08090d] p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-[#d7ff3f]"><ArrowLeft className="h-4 w-4" />Back to admin</Link>
        <h1 className="mt-3 text-2xl font-semibold">Shares</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage public and private email share links.</p>
        {notice ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">{notice}</p> : null}
        <div className="mt-5 grid gap-3">
          {shares.map((share) => {
            const url = `${origin}/share/${share.token}`;
            const expired = Boolean(share.expiresAt && new Date(share.expiresAt).getTime() < now);
            return (
              <div key={share.token} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-white">{share.title || share.name}</h2>
                      <span className={`rounded-full px-2 py-1 text-xs ${expired || share.disabledAt ? "bg-red-400/10 text-red-100" : "bg-[#d7ff3f]/10 text-[#d7ff3f]"}`}>
                        {share.disabledAt ? "disabled" : expired ? "expired" : "active"}
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-zinc-300">{share.visibility}</span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-zinc-300">{share.permission}</span>
                    </div>
                    <p className="mt-2 truncate text-sm text-zinc-500">{share.rootPath || "PublicShare"}</p>
                    <p className="mt-2 break-all rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-300">{url}</p>
                    <div className="mt-3 grid gap-2 text-xs text-zinc-500 md:grid-cols-3">
                      <span>Created: {new Date(share.createdAt).toLocaleString("id-ID")}</span>
                      <span>Expires: {share.expiresAt ? new Date(share.expiresAt).toLocaleString("id-ID") : "Never"}</span>
                      <span>Emails: {share.allowedEmails.length ? share.allowedEmails.join(", ") : "-"}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button onClick={() => void copy(url)} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10"><Copy className="h-4 w-4" />Copy</button>
                    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10"><ExternalLink className="h-4 w-4" />Open</a>
                    {share.allowedEmails.map((email) => (
                      <button key={email} onClick={() => void resendInvite(share.token, email)} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10"><Mail className="h-4 w-4" />{email}</button>
                    ))}
                    <button onClick={() => void disableShare(share.token)} className="inline-flex items-center gap-2 rounded-2xl border border-red-300/20 px-3 py-2 text-sm text-red-100 hover:bg-red-500/10"><Trash2 className="h-4 w-4" />Disable</button>
                  </div>
                </div>
              </div>
            );
          })}
          {shares.length === 0 ? <p className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center text-zinc-500">No shares yet.</p> : null}
        </div>
      </div>
    </main>
  );
}
