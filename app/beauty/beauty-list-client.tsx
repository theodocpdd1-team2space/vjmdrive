"use client";

import { useState } from "react";
import { Copy, Edit3, ExternalLink, Eye, Power, RotateCcw, Save, Sparkles, Trash2, X } from "lucide-react";

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
  downloadButtonText?: string;
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
  helper: string;
  fields: Array<{ key: CustomTextKey; label: string; multiline?: boolean; maxLength: number }>;
}> = [
  {
    title: "Hero",
    helper: "Controls the first screen clients see when they open the page.",
    fields: [
      { key: "heroEyebrow", label: "Hero eyebrow", maxLength: 120 },
      { key: "heroHeadline", label: "Hero headline", maxLength: 180 },
      { key: "heroDescription", label: "Hero description", multiline: true, maxLength: 320 },
      { key: "heroTitle", label: "Hero title", maxLength: 160 },
      { key: "heroSubtitle", label: "Hero subtitle", multiline: true, maxLength: 260 },
      { key: "heroMeta", label: "Hero meta", maxLength: 160 },
    ],
  },
  {
    title: "Buttons",
    helper: "Labels for the main actions in the hero and download sections.",
    fields: [
      { key: "primaryButtonText", label: "Primary button text", maxLength: 80 },
      { key: "secondaryButtonText", label: "Secondary button text", maxLength: 80 },
      { key: "downloadButtonText", label: "Download button text", maxLength: 80 },
    ],
  },
  {
    title: "Magazine",
    helper: "Used by the Magazine template for the book cover and intro pages.",
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
    helper: "Introduces the gallery and file preview area.",
    fields: [
      { key: "galleryEyebrow", label: "Gallery eyebrow", maxLength: 120 },
      { key: "galleryTitle", label: "Gallery title", maxLength: 180 },
      { key: "gallerySubtitle", label: "Gallery subtitle", maxLength: 220 },
      { key: "galleryDescription", label: "Gallery description", multiline: true, maxLength: 300 },
    ],
  },
  {
    title: "Download Section",
    helper: "Explains what clients can save from the delivery.",
    fields: [
      { key: "downloadTitle", label: "Download title", maxLength: 160 },
      { key: "downloadDescription", label: "Download description", multiline: true, maxLength: 300 },
    ],
  },
  {
    title: "Footer",
    helper: "Small notes shown at the bottom of the public page.",
    fields: [
      { key: "footerText", label: "Footer text", maxLength: 180 },
      { key: "footerNote", label: "Footer note", maxLength: 220 },
    ],
  },
];

const FIELD_PLACEHOLDERS: Record<CustomTextKey, string> = {
  heroEyebrow: "Private Client Delivery",
  heroTitle: "Client Delivery",
  heroHeadline: "Your files are ready.",
  heroSubtitle: "Preview, share, and download everything in one clean page.",
  heroDescription: "A private delivery page prepared for you.",
  heroMeta: "Better than a Google Drive link.",
  primaryButton: "View gallery",
  primaryButtonText: "View gallery",
  secondaryButton: "View files",
  secondaryButtonText: "View files",
  downloadButton: "Download all",
  downloadButtonText: "Download all",
  albumModeLabel: "Magazine Mode",
  albumTitle: "Digital client book",
  coverLabel: "Private Album",
  coverSubtitle: "Client Delivery",
  introEyebrow: "Delivery Notes",
  introTitle: "Your files are ready.",
  introDescription: "Preview, browse, and download your files in one place.",
  galleryEyebrow: "Gallery",
  galleryTitle: "Gallery preview",
  gallerySubtitle: "Browse selected highlights from this delivery.",
  galleryDescription: "Browse selected highlights from this delivery.",
  downloadTitle: "Download your files",
  downloadDescription: "Save the full delivery or download selected files.",
  footerText: "Delivered with driveOne",
  footerNote: "Delivered with driveOne",
};

function cleanTextMap(values: BeautyShareCustomText) {
  return Object.fromEntries(
    (Object.entries(values) as Array<[CustomTextKey, string | undefined]>)
      .map(([key, value]) => [key, value?.trim() || ""])
      .filter(([, value]) => value),
  ) as BeautyShareCustomText;
}

function textValue(values: BeautyShareCustomText, keys: CustomTextKey[], fallback: string) {
  for (const key of keys) {
    const value = values[key]?.trim();
    if (value) return value;
  }
  return fallback;
}

function buildEditorPreviewText(basic: EditBasic, customText: BeautyShareCustomText) {
  const title = basic.title.trim() || FIELD_PLACEHOLDERS.heroTitle;
  const subtitle = basic.subtitle.trim() || FIELD_PLACEHOLDERS.heroSubtitle;

  return {
    eyebrow: textValue(customText, ["heroEyebrow"], FIELD_PLACEHOLDERS.heroEyebrow),
    headline: textValue(customText, ["heroHeadline", "heroTitle"], FIELD_PLACEHOLDERS.heroHeadline),
    description: textValue(customText, ["heroDescription", "heroSubtitle"], subtitle || FIELD_PLACEHOLDERS.heroDescription),
    title: textValue(customText, ["heroTitle"], title),
    subtitle: textValue(customText, ["heroSubtitle"], subtitle),
    meta: textValue(customText, ["heroMeta"], FIELD_PLACEHOLDERS.heroMeta),
    primary: textValue(customText, ["primaryButtonText", "primaryButton"], FIELD_PLACEHOLDERS.primaryButtonText),
    secondary: textValue(customText, ["secondaryButtonText", "secondaryButton"], FIELD_PLACEHOLDERS.secondaryButtonText),
    download: textValue(customText, ["downloadButtonText", "downloadButton"], FIELD_PLACEHOLDERS.downloadButtonText),
    galleryTitle: textValue(customText, ["galleryTitle"], FIELD_PLACEHOLDERS.galleryTitle),
    gallerySubtitle: textValue(customText, ["gallerySubtitle", "galleryDescription"], FIELD_PLACEHOLDERS.gallerySubtitle),
    downloadTitle: textValue(customText, ["downloadTitle"], FIELD_PLACEHOLDERS.downloadTitle),
    downloadDescription: textValue(customText, ["downloadDescription"], FIELD_PLACEHOLDERS.downloadDescription),
    footer: textValue(customText, ["footerNote", "footerText"], FIELD_PLACEHOLDERS.footerNote),
  };
}

function BeautyShareEditorPreview({
  share,
  basic,
  customText,
}: {
  share: BeautyShareRow;
  basic: EditBasic;
  customText: BeautyShareCustomText;
}) {
  const preview = buildEditorPreviewText(basic, customText);
  const clientName = basic.clientName.trim() || share.clientName || share.title;
  const isDark = basic.theme === "dark";
  const shellClass =
    basic.theme === "dark"
      ? "bg-[#07080a] text-white"
      : basic.theme === "cream"
        ? "bg-[#f4eadc] text-[#211b12]"
        : "bg-[#f7f8f3] text-[#141414]";
  const cardClass =
    basic.theme === "dark"
      ? "border-white/10 bg-white/[0.07]"
      : "border-black/10 bg-white/75";
  const mutedClass = basic.theme === "dark" ? "text-white/60" : "text-black/55";

  return (
    <aside className="sticky top-0 rounded-3xl border border-white/10 bg-black/20 p-3 lg:max-h-[calc(94vh-170px)] lg:overflow-y-auto">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d7ff3f]">Live preview</p>
          <p className="mt-1 text-xs text-zinc-500">Unsaved changes preview</p>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-black capitalize text-zinc-300">{basic.layout}</span>
      </div>

      <div className={`overflow-hidden rounded-[1.6rem] border border-white/10 shadow-2xl ${shellClass}`}>
        <div className="relative min-h-[360px] p-4">
          <div className="absolute inset-0 opacity-60">
            <div className="absolute right-[-20%] top-[-12%] h-44 w-44 rounded-full bg-[#d7ff3f]/25 blur-3xl" />
            <div className="absolute bottom-[-18%] left-[-20%] h-48 w-48 rounded-full bg-black/10 blur-3xl" />
          </div>

          {basic.layout === "magazine" ? (
            <MagazinePreview preview={preview} clientName={clientName} cardClass={cardClass} mutedClass={mutedClass} />
          ) : (
            <div className="relative">
              <div className={basic.layout === "grid" ? "space-y-4" : "grid gap-4"}>
                <div className={basic.layout === "collage" ? "grid gap-4" : "space-y-4"}>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7a8f12]">{preview.eyebrow}</p>
                    <h3 className="mt-3 text-3xl font-black leading-[0.95] tracking-tight">{preview.headline}</h3>
                    <p className={`mt-3 text-sm leading-6 ${mutedClass}`}>{preview.description}</p>
                    <p className="mt-3 text-xs font-black">{clientName}</p>
                    <p className={`mt-1 text-[10px] font-black uppercase tracking-[0.18em] ${mutedClass}`}>{preview.meta}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#d7ff3f] px-3 py-2 text-[11px] font-black text-black">{preview.primary}</span>
                    <span className={`rounded-full border px-3 py-2 text-[11px] font-black ${cardClass}`}>{preview.secondary}</span>
                    <span className={`rounded-full border px-3 py-2 text-[11px] font-black ${cardClass}`}>{preview.download}</span>
                  </div>
                </div>

                <PreviewVisual layout={basic.layout} cardClass={cardClass} mutedClass={mutedClass} />
              </div>

              <div className="mt-5 border-t border-current/10 pt-4">
                <h4 className="text-base font-black">{preview.galleryTitle}</h4>
                <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>{preview.gallerySubtitle}</p>
                <div className="mt-4 rounded-2xl border border-current/10 p-3">
                  <p className="text-sm font-black">{preview.downloadTitle}</p>
                  <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>{preview.downloadDescription}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className={`border-t border-current/10 px-4 py-3 text-center text-[10px] font-bold ${mutedClass}`}>
          {preview.footer}
        </footer>
      </div>
    </aside>
  );
}

function PreviewVisual({
  layout,
  cardClass,
  mutedClass,
}: {
  layout: EditBasic["layout"];
  cardClass: string;
  mutedClass: string;
}) {
  if (layout === "collage") {
    return (
      <div className="grid h-56 grid-cols-5 grid-rows-4 gap-2">
        <PreviewBlock className="col-span-3 row-span-3" />
        <PreviewBlock className="col-span-2 row-span-2" tone="lime" />
        <PreviewBlock className="col-span-2 row-span-2" />
        <PreviewBlock className="col-span-2 row-span-1" tone="dark" />
        <PreviewBlock className="col-span-3 row-span-1" tone="lime" />
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className="grid gap-2">
        {[0, 1, 2].map((item) => (
          <div key={item} className={`grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-2 ${cardClass}`}>
            <PreviewBlock className="h-11 w-11" tone={item === 1 ? "lime" : "neutral"} />
            <div className="min-w-0">
              <div className="h-2.5 w-28 rounded-full bg-current/30" />
              <div className={`mt-2 h-2 w-16 rounded-full bg-current/15 ${mutedClass}`} />
            </div>
            <div className="h-7 w-16 rounded-full bg-[#d7ff3f]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`rounded-[1.3rem] border p-3 ${cardClass}`}>
      <div className="grid h-52 grid-cols-6 grid-rows-5 gap-2 overflow-hidden rounded-2xl">
        <PreviewBlock className="col-span-4 row-span-3" />
        <PreviewBlock className="col-span-2 row-span-2" tone="lime" />
        <PreviewBlock className="col-span-2 row-span-3" />
        <PreviewBlock className="col-span-3 row-span-2" tone="dark" />
        <PreviewBlock className="col-span-3 row-span-2" tone="lime" />
      </div>
    </div>
  );
}

function PreviewBlock({ className = "", tone = "neutral" }: { className?: string; tone?: "neutral" | "lime" | "dark" }) {
  const toneClass =
    tone === "lime"
      ? "bg-[linear-gradient(135deg,#d7ff3f,#9fbf22)]"
      : tone === "dark"
        ? "bg-[linear-gradient(135deg,#1f2937,#050608)]"
        : "bg-[linear-gradient(135deg,#d6d1c8,#8d8578)]";
  return <div className={`rounded-xl ${toneClass} ${className}`} />;
}

function MagazinePreview({
  preview,
  clientName,
  cardClass,
  mutedClass,
}: {
  preview: ReturnType<typeof buildEditorPreviewText>;
  clientName: string;
  cardClass: string;
  mutedClass: string;
}) {
  return (
    <div className="relative">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7a8f12]">Magazine template</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className={`flex min-h-64 flex-col justify-between rounded-l-2xl border p-4 ${cardClass}`}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7a8f12]">{preview.eyebrow}</p>
            <h3 className="mt-5 text-2xl font-black leading-none">{preview.headline}</h3>
          </div>
          <PreviewBlock className="h-28" />
        </div>
        <div className={`flex min-h-64 flex-col justify-between rounded-r-2xl border p-4 ${cardClass}`}>
          <div>
            <h4 className="text-lg font-black">{preview.galleryTitle}</h4>
            <p className={`mt-2 text-xs leading-5 ${mutedClass}`}>{preview.gallerySubtitle}</p>
          </div>
          <div>
            <p className="text-xs font-black">{clientName}</p>
            <p className={`mt-1 text-[10px] ${mutedClass}`}>{preview.download}</p>
          </div>
        </div>
      </div>
      <p className={`mt-4 text-xs leading-5 ${mutedClass}`}>{preview.description}</p>
    </div>
  );
}

export function BeautyListClient({ initialShares }: { initialShares: BeautyShareRow[] }) {
  const [shares, setShares] = useState(initialShares);
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BeautyShareRow | null>(null);
  const [editTarget, setEditTarget] = useState<BeautyShareRow | null>(null);
  const [editBasic, setEditBasic] = useState<EditBasic>({ title: "", subtitle: "", clientName: "", theme: "light", layout: "clean" });
  const [editText, setEditText] = useState<BeautyShareCustomText>({});
  const [editorTab, setEditorTab] = useState<"edit" | "preview">("edit");
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
    setEditorTab("edit");
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
          <div className="flex max-h-[94vh] w-full flex-col rounded-t-3xl border border-white/10 bg-[#101217] shadow-2xl md:max-w-6xl md:rounded-3xl">
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

            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1 lg:hidden">
                <button type="button" onClick={() => setEditorTab("edit")} className={`rounded-xl px-3 py-2 text-sm font-black ${editorTab === "edit" ? "bg-[#d7ff3f] text-black" : "text-zinc-400"}`}>
                  Edit
                </button>
                <button type="button" onClick={() => setEditorTab("preview")} className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${editorTab === "preview" ? "bg-[#d7ff3f] text-black" : "text-zinc-400"}`}>
                  <Eye className="h-4 w-4" />
                  Preview
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
                <div className={`space-y-4 ${editorTab === "preview" ? "hidden lg:block" : "block"}`}>
                  <details open className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <summary className="cursor-pointer text-sm font-black text-white">Template & Theme</summary>
                    <p className="mt-3 text-xs leading-5 text-zinc-500">Choose the page style, then set the basic client-facing title. Kosongkan field untuk memakai teks default.</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1.5 text-sm font-bold text-zinc-300">
                        Page title
                        <input
                          value={editBasic.title}
                          onChange={(event) => setEditBasic((current) => ({ ...current, title: event.target.value }))}
                          maxLength={160}
                          placeholder="Client Delivery"
                          className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#d7ff3f]/50"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-bold text-zinc-300">
                        Client name
                        <input
                          value={editBasic.clientName}
                          onChange={(event) => setEditBasic((current) => ({ ...current, clientName: event.target.value }))}
                          maxLength={160}
                          placeholder="The Wibowo Family"
                          className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#d7ff3f]/50"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-bold text-zinc-300 md:col-span-2">
                        Page subtitle
                        <textarea
                          value={editBasic.subtitle}
                          onChange={(event) => setEditBasic((current) => ({ ...current, subtitle: event.target.value }))}
                          maxLength={260}
                          rows={3}
                          placeholder="Preview, share, and download everything in one clean page."
                          className="resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#d7ff3f]/50"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-bold text-zinc-500 md:col-span-2">
                        Public URL
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
                      <p className="mt-3 text-xs leading-5 text-zinc-500">{group.helper}</p>
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
                                placeholder={FIELD_PLACEHOLDERS[field.key]}
                                className="resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#d7ff3f]/50"
                              />
                            ) : (
                              <input
                                value={editText[field.key] || ""}
                                onChange={(event) => setEditText((current) => ({ ...current, [field.key]: event.target.value }))}
                                maxLength={field.maxLength}
                                placeholder={FIELD_PLACEHOLDERS[field.key]}
                                className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#d7ff3f]/50"
                              />
                            )}
                            <span className="text-[11px] font-medium text-zinc-600">Default: {FIELD_PLACEHOLDERS[field.key]}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>

                <div className={`${editorTab === "edit" ? "hidden lg:block" : "block"}`}>
                  <BeautyShareEditorPreview share={editTarget} basic={editBasic} customText={editText} />
                </div>
              </div>
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
