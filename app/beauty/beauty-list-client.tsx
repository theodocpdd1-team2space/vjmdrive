"use client";

import { useState } from "react";
import { Copy, ExternalLink, Power, Sparkles, Trash2 } from "lucide-react";

type BeautyShareRow = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  theme: "light" | "dark";
  layout: "collage" | "grid" | "magazine";
  isActive: boolean;
  viewCount: number;
  downloadCount: number;
  publicUrl: string;
};

export function BeautyListClient({ initialShares }: { initialShares: BeautyShareRow[] }) {
  const [shares, setShares] = useState(initialShares);
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BeautyShareRow | null>(null);

  async function setShareActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/beauty-shares/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setNotice(data.message || "Update failed.");
      return;
    }
    setShares((current) => current.map((share) => (share.id === id ? { ...share, isActive } : share)));
    setNotice(isActive ? "Beauty Share activated." : "Beauty Share disabled.");
  }

  async function deleteShare() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/beauty-shares/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setNotice(data.message || "Delete failed.");
      return;
    }
    setShares((current) => current.filter((share) => share.id !== deleteTarget.id));
    setNotice("Beauty Share deleted. Original files were not deleted.");
    setDeleteTarget(null);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {notice ? (
        <div className="rounded-2xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-4 py-3 text-sm font-medium text-[#d7ff3f]">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shares.map((share) => {
          const url = typeof window === "undefined" ? share.publicUrl : `${window.location.origin}${share.publicUrl}`;
          return (
            <article key={share.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-white">{share.title}</p>
                  <p className="mt-1 truncate text-sm text-zinc-500">/b/{share.slug}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${share.isActive ? "bg-[#d7ff3f]/10 text-[#d7ff3f]" : "bg-red-300/10 text-red-100"}`}>
                  {share.isActive ? "Active" : "Off"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-500">
                <span>{share.theme}</span>
                <span>{share.layout}</span>
                <span>{share.viewCount} views</span>
                <span>{share.downloadCount} downloads</span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={() => { void navigator.clipboard.writeText(url); setNotice("Link copied."); }} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10">
                  <Copy className="h-4 w-4" />
                  Copy Link
                </button>
                <a href={share.publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#d7ff3f] px-3 py-2 text-sm font-black text-black">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
                {share.isActive ? (
                  <button onClick={() => void setShareActive(share.id, false)} className="inline-flex items-center gap-2 rounded-xl border border-red-300/20 px-3 py-2 text-sm font-bold text-red-100 hover:bg-red-300/10">
                    <Power className="h-4 w-4" />
                    Disable
                  </button>
                ) : (
                  <button onClick={() => void setShareActive(share.id, true)} className="inline-flex items-center gap-2 rounded-xl border border-[#d7ff3f]/30 px-3 py-2 text-sm font-bold text-[#d7ff3f] hover:bg-[#d7ff3f]/10">
                    <Power className="h-4 w-4" />
                    Activate
                  </button>
                )}
                <button onClick={() => setDeleteTarget(share)} className="inline-flex items-center gap-2 rounded-xl border border-red-300/20 px-3 py-2 text-sm font-bold text-red-100 hover:bg-red-300/10">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {shares.length === 0 ? (
        <section className="flex h-72 flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] text-[#d7ff3f]">
            <Sparkles className="h-7 w-7" />
          </div>
          <div>
            <p className="font-black text-white">No Beauty Shares yet</p>
            <p className="mt-1 text-sm text-zinc-500">Create one from a folder in My Drive.</p>
          </div>
        </section>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[120] flex items-end bg-black/70 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-4">
          <div className="w-full rounded-t-3xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:max-w-md md:rounded-3xl">
            <h2 className="text-xl font-black text-white">Delete Beauty Share?</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              This will remove the Beauty Share link /b/{deleteTarget.slug}. Your original files will not be deleted. The slug can be used again.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10">
                Cancel
              </button>
              <button type="button" onClick={() => void deleteShare()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-400 px-4 py-3 text-sm font-black text-black">
                <Trash2 className="h-4 w-4" />
                Delete Beauty Share
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
