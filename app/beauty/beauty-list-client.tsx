"use client";

import { useState } from "react";
import { Copy, Edit3, ExternalLink, Power, RotateCcw, Save, Sparkles, Trash2, X } from "lucide-react";

type BeautyShareCustomText = {
  heroEyebrow?: string;
  heroTitle?: string;
  heroHeadline?: string;
  heroSubtitle?: string;
  heroDescription?: string;
  heroMeta?: string;
  primaryButton?: string;
  primaryButtonText?: string;
  secondaryButton?: string;
  secondaryButtonText?: string;
  downloadButton?: string;
  albumModeLabel?: string;
  albumTitle?: string;
  coverLabel?: string;
  coverSubtitle?: string;
  introEyebrow?: string;
  introTitle?: string;
  introDescription?: string;
  galleryEyebrow?: string;
  galleryTitle?: string;
  gallerySubtitle?: string;
  galleryDescription?: string;
  downloadTitle?: string;
  downloadDescription?: string;
  footerText?: string;
  footerNote?: string;
};

type CustomTextKey = keyof BeautyShareCustomText;

type BeautyShareRow = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  clientName?: string;
  theme: "light" | "dark" | "cream";
  layout: "clean" | "collage" | "grid" | "magazine";
  isActive: boolean;
  viewCount: number;
  downloadCount: number;
  customText?: BeautyShareCustomText;
  publicUrl: string;
};

type EditBasic = {
  title: string;
  subtitle: string;
  clientName: string;
  theme: "light" | "dark" | "cream";
  layout: "clean" | "collage" | "grid" | "magazine";
};

const TEXT_GROUPS: Array<{
  title: string;
  fields: Array<{ key: CustomTextKey; label: string; multiline?: boolean; maxLength: number }>;
}> = [
  {
    title: "Hero",
    fields: [
      { key: "heroEyebrow", label: "Hero eyebrow", maxLength: 120 },
      { key: "heroHeadline", label: "Hero headline", maxLength: 180 },
      { key: "heroDescription", label: "Hero description", multiline: true, maxLength: 320 },
      { key: "heroTitle", label: "Hero title", maxLength: 160 },
      { key: "heroSubtitle", label: "Hero subtitle", multiline: true, maxLength: 260 },
      { key: "heroMeta", label: "Hero meta", maxLength: 160 },
      { key: "primaryButtonText", label: "Primary button text", maxLength: 80 },
      { key: "secondaryButtonText", label: "Secondary button text", maxLength: 80 },
      { key: "downloadButton", label: "Download button text", maxLength: 80 },
    ],
  },
  {
    title: "Album",
    fields: [
      { key: "albumModeLabel", label: "Album mode label", maxLength: 120 },
      { key: "albumTitle", label: "Album title", maxLength: 160 },
      { key: "coverLabel", label: "Cover label", maxLength: 120 },
      { key: "coverSubtitle", label: "Cover subtitle", maxLength: 160 },
      { key: "introEyebrow", label: "Intro eyebrow", maxLength: 120 },
      { key: "introTitle", label: "Intro title", maxLength: 160 },
      { key: "introDescription", label: "Intro description", multiline: true, maxLength: 300 },
    ],
  },
  {
    title: "Gallery",
    fields: [
      { key: "galleryEyebrow", label: "Gallery eyebrow", maxLength: 120 },
      { key: "galleryTitle", label: "Gallery title", maxLength: 180 },
      { key: "gallerySubtitle", label: "Gallery subtitle", maxLength: 220 },
      { key: "galleryDescription", label: "Gallery description", multiline: true, maxLength: 300 },
    ],
  },
  {
    title: "Download",
    fields: [
      { key: "downloadTitle", label: "Download title", maxLength: 160 },
      { key: "downloadDescription", label: "Download description", multiline: true, maxLength: 300 },
    ],
  },
  {
    title: "Footer",
    fields: [
      { key: "footerText", label: "Footer text", maxLength: 180 },
      { key: "footerNote", label: "Footer note", maxLength: 220 },
    ],
  },
];

function cleanTextMap(values: BeautyShareCustomText) {
  return Object.fromEntries(
    (Object.entries(values) as Array<[CustomTextKey, string | undefined]>)
      .map(([key, value]) => [key, value?.trim() || ""])
      .filter(([, value]) => value),
  ) as BeautyShareCustomText;
}

export function BeautyListClient({ initialShares }: { initialShares: BeautyShareRow[] }) {
  const [shares, setShares] = useState(initialShares);
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BeautyShareRow | null>(null);
  const [editTarget, setEditTarget] = useState<BeautyShareRow | null>(null);
  const [editBasic, setEditBasic] = useState<EditBasic>({ title: "", subtitle: "", clientName: "", theme: "light", layout: "clean" });
  const [editText, setEditText] = useState<BeautyShareCustomText>({});
  const [savingText, setSavingText] = useState(false);

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
    setShares((current) => current.map((share) => (share.id === id ? { ...share, ...(data.share || {}), publicUrl: data.publicUrl || share.publicUrl } : share)));
    setNotice(isActive ? "Beauty Share activated." : "Beauty Share disabled.");
  }

  function openEditor(share: BeautyShareRow) {
    setEditTarget(share);
    setEditBasic({
      title: share.title || "",
      subtitle: share.subtitle || "",
      clientName: share.clientName || "",
      theme: share.theme || "light",
      layout: share.layout || "clean",
    });
    setEditText(share.customText || {});
    setNotice("");
  }

  async function saveEditor() {
    if (!editTarget || savingText) return;
    setSavingText(true);

    const res = await fetch(`/api/beauty-shares/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editBasic.title,
        subtitle: editBasic.subtitle,
        clientName: editBasic.clientName,
        theme: editBasic.theme,
        layout: editBasic.layout,
        customText: cleanTextMap(editText),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingText(false);

    if (!res.ok || !data.ok) {
      setNotice(data.message || "Save failed.");
      return;
    }

    const updated = { ...data.share, publicUrl: data.publicUrl || `/b/${data.share?.slug || editTarget.slug}` } as BeautyShareRow;
    setShares((current) => current.map((share) => (share.id === editTarget.id ? updated : share)));
    setEditTarget(updated);
    setEditBasic({
      title: updated.title || "",
      subtitle: updated.subtitle || "",
      clientName: updated.clientName || "",
      theme: updated.theme || "light",
      layout: updated.layout || "clean",
    });
    setEditText(updated.customText || {});
    setNotice("Beauty Share page text saved.");
  }

  async function resetTextToDefault() {
    if (!editTarget || savingText) return;
    if (!window.confirm("Reset custom page text to default? Title, subtitle, and client name will stay unchanged.")) return;
    setSavingText(true);

    const res = await fetch(`/api/beauty-shares/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customText: null }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingText(false);

    if (!res.ok || !data.ok) {
      setNotice(data.message || "Reset failed.");
      return;
    }

    const updated = { ...data.share, publicUrl: data.publicUrl || `/b/${data.share?.slug || editTarget.slug}` } as BeautyShareRow;
    setShares((current) => current.map((share) => (share.id === editTarget.id ? updated : share)));
    setEditTarget(updated);
    setEditText({});
    setNotice("Custom text reset to defaults.");
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
                <button onClick={() => openEditor(share)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10">
                  <Edit3 className="h-4 w-4" />
                  Edit Page
                </button>
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

      {editTarget ? (
        <div className="fixed inset-0 z-[130] flex items-end bg-black/75 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-4">
          <div className="flex max-h-[92vh] w-full flex-col rounded-t-3xl border border-white/10 bg-[#101217] shadow-2xl md:max-w-4xl md:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4 md:p-5">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d7ff3f]">Beauty Share page</p>
                <h2 className="mt-2 truncate text-2xl font-black text-white">Edit text</h2>
                <p className="mt-1 text-sm text-zinc-500">Kosongkan field untuk memakai teks default.</p>
              </div>
              <button type="button" aria-label="Close editor" onClick={() => setEditTarget(null)} className="rounded-full border border-white/10 p-2 text-zinc-300 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
              <details open className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <summary className="cursor-pointer text-sm font-black text-white">Basic</summary>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-bold text-zinc-300">
                    Title
                    <input
                      value={editBasic.title}
                      onChange={(event) => setEditBasic((current) => ({ ...current, title: event.target.value }))}
                      maxLength={160}
                      className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d7ff3f]/50"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold text-zinc-300">
                    Client name
                    <input
                      value={editBasic.clientName}
                      onChange={(event) => setEditBasic((current) => ({ ...current, clientName: event.target.value }))}
                      maxLength={160}
                      className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d7ff3f]/50"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold text-zinc-300 md:col-span-2">
                    Subtitle
                    <textarea
                      value={editBasic.subtitle}
                      onChange={(event) => setEditBasic((current) => ({ ...current, subtitle: event.target.value }))}
                      maxLength={260}
                      rows={3}
                      className="resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d7ff3f]/50"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold text-zinc-500 md:col-span-2">
                    Slug
                    <input value={`/b/${editTarget.slug}`} readOnly className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-zinc-400 outline-none" />
                  </label>
                  <div className="grid gap-1.5 text-sm font-bold text-zinc-300">
                    Template
                    <div className="flex flex-wrap gap-2">
                      {(["clean", "collage", "grid", "magazine"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setEditBasic((current) => ({ ...current, layout: value }))}
                          className={`rounded-xl border px-3 py-2 text-sm capitalize ${
                            editBasic.layout === value ? "border-[#d7ff3f] bg-[#d7ff3f]/10 text-white" : "border-white/10 text-zinc-400 hover:bg-white/10"
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-1.5 text-sm font-bold text-zinc-300">
                    Theme
                    <div className="flex flex-wrap gap-2">
                      {(["light", "dark", "cream"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setEditBasic((current) => ({ ...current, theme: value }))}
                          className={`rounded-xl border px-3 py-2 text-sm capitalize ${
                            editBasic.theme === value ? "border-[#d7ff3f] bg-[#d7ff3f]/10 text-white" : "border-white/10 text-zinc-400 hover:bg-white/10"
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </details>

              {TEXT_GROUPS.map((group) => (
                <details key={group.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <summary className="cursor-pointer text-sm font-black text-white">{group.title}</summary>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {group.fields.map((field) => (
                      <label key={field.key} className={`grid gap-1.5 text-sm font-bold text-zinc-300 ${field.multiline ? "md:col-span-2" : ""}`}>
                        {field.label}
                        {field.multiline ? (
                          <textarea
                            value={editText[field.key] || ""}
                            onChange={(event) => setEditText((current) => ({ ...current, [field.key]: event.target.value }))}
                            maxLength={field.maxLength}
                            rows={3}
                            className="resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d7ff3f]/50"
                          />
                        ) : (
                          <input
                            value={editText[field.key] || ""}
                            onChange={(event) => setEditText((current) => ({ ...current, [field.key]: event.target.value }))}
                            maxLength={field.maxLength}
                            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d7ff3f]/50"
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </details>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => void resetTextToDefault()} disabled={savingText} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-50">
                  <RotateCcw className="h-4 w-4" />
                  Reset Text to Default
                </button>
                <a href={editTarget.publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10">
                  <ExternalLink className="h-4 w-4" />
                  Preview Page
                </a>
              </div>
              <button type="button" onClick={() => void saveEditor()} disabled={savingText} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black disabled:opacity-60">
                <Save className="h-4 w-4" />
                {savingText ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
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
