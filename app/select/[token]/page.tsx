"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  File,
  Folder,
  Grid2X2,
  Home,
  List,
  Loader2,
  Search,
  Send,
  X,
} from "lucide-react";
import { PreviewModal, type DriveItem, type ViewMode } from "@/components/drive/drive-ui";

type ClientSelectMeta = {
  token: string;
  projectName: string;
  clientName: string;
  clientEmail: string;
  maxSelectedPhotos: number | null;
  allowOriginalDownload: boolean;
  allowEditAfterSubmit: boolean;
  expiresAt: string | null;
  status: string;
};

type ClientSelectSubmissionState = {
  selectedFiles: Array<{ path: string; filename: string; note: string }>;
  clientName: string;
  clientEmail: string;
  globalNote: string;
  submittedAt: string;
  updatedAt?: string | null;
};

function extensionLabel(item: DriveItem) {
  if (item.type === "folder") return "Folder";
  return (item.extension || "FILE").toUpperCase();
}

function GalleryMedia({ item }: { item: DriveItem }) {
  const [failedSource, setFailedSource] = useState("");
  const source = item.type === "image" ? item.thumbnailUrl || item.previewUrl || item.originalUrl : null;

  if (item.type === "folder") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#111318] text-[#d7ff3f]">
        <Folder className="h-9 w-9" />
        <span className="mt-2 text-xs font-semibold text-zinc-500">Open folder</span>
      </div>
    );
  }

  if (source && failedSource !== source) {
    return (
      <Image
        src={source}
        alt={item.name}
        fill
        unoptimized
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className="object-cover"
        onError={() => setFailedSource(source)}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#111318] text-zinc-600">
      <File className="h-7 w-7" />
      <span className="mt-2 text-xs font-semibold">{extensionLabel(item)}</span>
    </div>
  );
}

export default function ClientSelectPublicPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [path, setPath] = useState("");
  const [items, setItems] = useState<DriveItem[]>([]);
  const [link, setLink] = useState<ClientSelectMeta | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [photoNotes, setPhotoNotes] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [globalNote, setGlobalNote] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [hasLoadedSubmission, setHasLoadedSubmission] = useState(false);

  const loadFolder = useCallback(async (nextPath: string) => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/select/${token}/list?path=${encodeURIComponent(nextPath)}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok || !data.ok) {
      setError(data.message || "Client Select link is unavailable.");
      return;
    }

    setPath(data.path || "");
    setItems(data.items || []);
    setLink(data.link || null);
    setClientName((current) => current || data.link?.clientName || "");
    setClientEmail((current) => current || data.link?.clientEmail || "");
    if (!hasLoadedSubmission && data.submission) {
      const submission = data.submission as ClientSelectSubmissionState;
      setHasLoadedSubmission(true);
      setSelectedPaths(new Set(submission.selectedFiles.map((file) => file.path)));
      setPhotoNotes(Object.fromEntries(submission.selectedFiles.map((file) => [file.path, file.note || ""])));
      setClientName(submission.clientName || data.link?.clientName || "");
      setClientEmail(submission.clientEmail || data.link?.clientEmail || "");
      setGlobalNote(submission.globalNote || "");
    }
  }, [hasLoadedSubmission, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFolder(""), 0);
    return () => window.clearTimeout(timer);
  }, [loadFolder]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const maxSelected = link?.maxSelectedPhotos || null;
  const selectedCount = selectedPaths.size;
  const maxReached = Boolean(maxSelected && selectedCount >= maxSelected);
  const isSubmittedState = submitted || link?.status === "SUBMITTED";
  const canEditSubmitted = Boolean(link?.allowEditAfterSubmit && link?.status === "SUBMITTED");
  const lockedSubmittedState = isSubmittedState && !canEditSubmitted;
  const selectionLabel = maxSelected ? `Selected ${selectedCount} of ${maxSelected}` : `Selected ${selectedCount}`;
  const compactSelectionLabel = maxSelected ? `${selectedCount}/${maxSelected} selected` : `${selectedCount} selected`;
  const breadcrumbs = path.split("/").filter(Boolean);
  const selectedOrder = useMemo(() => Array.from(selectedPaths), [selectedPaths]);
  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => item.name.toLowerCase().includes(keyword));
  }, [items, query]);

  function isSelectable(item: DriveItem) {
    return item.type === "image";
  }

  function openItem(item: DriveItem) {
    if (item.type === "folder") {
      setQuery("");
      void loadFolder(item.path);
      return;
    }
    if (item.canPreview || item.type === "image") setPreviewItem(item);
  }

  function toggleSelect(item: DriveItem) {
    if (!isSelectable(item) || lockedSubmittedState) return;
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(item.path)) {
        next.delete(item.path);
        return next;
      }
      if (maxSelected && next.size >= maxSelected) {
        setNotice("Selection limit reached.");
        return current;
      }
      next.add(item.path);
      return next;
    });
  }

  function openSubmit() {
    if (!selectedCount) {
      setNotice("Choose at least one photo before submitting.");
      return;
    }
    setSubmitOpen(true);
  }

  async function submitSelection() {
    if (submitting || lockedSubmittedState) return;
    if (!clientName.trim()) {
      setNotice("Please enter your name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim().toLowerCase())) {
      setNotice("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");
    const res = await fetch(`/api/select/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedFiles: Array.from(selectedPaths).map((itemPath) => ({
          path: itemPath,
          note: photoNotes[itemPath] || "",
        })),
        clientName,
        clientEmail,
        globalNote,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok || !data.ok) {
      setNotice(data.message || "Submit selection failed.");
      return;
    }

    setSubmitOpen(false);
    setSubmitted(true);
    setLink((current) => current ? { ...current, status: "SUBMITTED" } : current);
    setNotice(canEditSubmitted ? "Selection updated." : "Selection submitted.");
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08090d] px-5 text-zinc-100">
        <div className="max-w-md text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-500">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h1 className="mt-5 text-xl font-bold text-white">Selection unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{error}</p>
        </div>
      </main>
    );
  }

  if (lockedSubmittedState) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08090d] px-5 text-zinc-100">
        <div className="w-full max-w-lg text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#d7ff3f] text-black">
            <Check className="h-7 w-7" />
          </span>
          <p className="mt-6 text-xs font-bold uppercase text-[#d7ff3f]">Client Select</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Selection submitted. Thank you.</h1>
          <p className="mt-2 text-sm text-zinc-500">{link?.projectName}</p>
          <p className="mt-5 text-sm font-semibold text-zinc-300">{selectionLabel}</p>
          {clientName || clientEmail ? (
            <p className="mt-2 text-xs text-zinc-600">{[clientName, clientEmail].filter(Boolean).join(" · ")}</p>
          ) : null}
          {link?.allowOriginalDownload ? (
            <a
              href={`/api/select/${token}/download-selected-zip`}
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              <Download className="h-4 w-4" />
              Download selected files
            </a>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090d] pb-20 text-zinc-100 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08090d]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1280px] items-center gap-3 px-3 md:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase text-[#d7ff3f]">Client Select</p>
            <h1 className="truncate text-base font-bold text-white md:text-lg">{link?.projectName || "Photo Selection"}</h1>
          </div>

          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <div className="flex w-64 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search photos" className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600" />
            </div>
            <div className="flex rounded-lg border border-white/10 p-1">
              <button type="button" onClick={() => setViewMode("grid")} className={`rounded-md p-1.5 ${viewMode === "grid" ? "bg-white/10 text-white" : "text-zinc-500"}`} title="Grid view" aria-label="Grid view"><Grid2X2 className="h-4 w-4" /></button>
              <button type="button" onClick={() => setViewMode("list")} className={`rounded-md p-1.5 ${viewMode === "list" ? "bg-white/10 text-white" : "text-zinc-500"}`} title="List view" aria-label="List view"><List className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="hidden items-center gap-3 border-l border-white/10 pl-3 md:flex">
            <span className="text-sm font-semibold text-zinc-300">{selectionLabel}</span>
            <button type="button" onClick={openSubmit} disabled={!selectedCount} className="inline-flex items-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-2.5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">
              <Send className="h-4 w-4" />
              {isSubmittedState ? "Update selection" : "Submit selection"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] px-3 py-4 md:px-5 md:py-5">
        <div className="mb-4">
          <p className="text-sm text-zinc-400">Choose your favorite photos for editing.</p>
          <div className="mt-3 flex gap-2 md:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search photos" className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600" />
            </div>
            <button type="button" onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")} className="rounded-lg border border-white/10 p-2.5 text-zinc-400" title="Change view" aria-label="Change view">
              {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid2X2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {notice ? (
          <div className="fixed left-1/2 top-20 z-[80] -translate-x-1/2 rounded-lg border border-[#d7ff3f]/20 bg-[#171a16] px-4 py-2.5 text-sm font-semibold text-[#d7ff3f] shadow-2xl">
            {notice}
          </div>
        ) : null}

        {maxReached && !isSubmittedState ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#d7ff3f]/15 bg-[#d7ff3f]/[0.05] px-3 py-2 text-sm text-[#d7ff3f]">
            <CheckCircle2 className="h-4 w-4" />
            Selection limit reached.
          </div>
        ) : null}

        {canEditSubmitted ? (
          <div className="mb-4 rounded-lg border border-sky-300/15 bg-sky-300/[0.05] px-3 py-2 text-sm text-sky-100">
            Your selection was submitted. You can still update it.
          </div>
        ) : null}

        <nav className="mb-3 flex items-center gap-1 overflow-x-auto text-xs">
          <button type="button" onClick={() => void loadFolder("")} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold text-zinc-300 hover:bg-white/[0.05]">
            <Home className="h-3.5 w-3.5 text-[#d7ff3f]" />
            Gallery
          </button>
          {breadcrumbs.map((crumb, index) => (
            <div key={`${crumb}-${index}`} className="flex shrink-0 items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
              <button type="button" onClick={() => void loadFolder(breadcrumbs.slice(0, index + 1).join("/"))} className="max-w-40 truncate rounded-lg px-2 py-1.5 text-zinc-500 hover:bg-white/[0.05] hover:text-white">
                {crumb}
              </button>
            </div>
          ))}
        </nav>

        {loading ? (
          <div className="flex min-h-[55vh] items-center justify-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />
            Loading gallery...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
            <Folder className="h-9 w-9 text-zinc-700" />
            <p className="mt-3 font-semibold text-zinc-300">No photos here</p>
            <p className="mt-1 text-sm text-zinc-600">Try another folder or search.</p>
          </div>
        ) : (
          <section className={viewMode === "grid" ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "divide-y divide-white/[0.07] border-y border-white/[0.07]"}>
            {filteredItems.map((item) => {
              const selectable = isSelectable(item);
              const checked = selectedPaths.has(item.path);
              const blockedByMax = !checked && maxReached;
              const selectedNumber = selectedOrder.indexOf(item.path) + 1;

              if (viewMode === "list") {
                return (
                  <div key={item.path} className={`flex items-center gap-3 px-2 py-2.5 transition ${checked ? "bg-[#d7ff3f]/[0.05]" : "hover:bg-white/[0.025]"}`}>
                    <button type="button" onClick={() => openItem(item)} className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-[#111318]">
                      <GalleryMedia item={item} />
                    </button>
                    <button type="button" onClick={() => openItem(item)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-semibold text-zinc-200">{item.name}</span>
                      <span className="mt-0.5 block text-xs text-zinc-600">{extensionLabel(item)}{item.size ? ` · ${item.size}` : ""}</span>
                    </button>
                    {selectable ? (
                      <button type="button" disabled={blockedByMax} onClick={() => toggleSelect(item)} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${checked ? "border-[#d7ff3f] bg-[#d7ff3f] text-black" : "border-white/15 text-transparent hover:border-white/40"} disabled:cursor-not-allowed disabled:opacity-30`} aria-label={checked ? "Deselect photo" : "Select photo"}>
                        <Check className="h-4 w-4" />
                      </button>
                    ) : <ChevronRight className="h-4 w-4 text-zinc-700" />}
                    {item.directDownloadUrl ? (
                      <a href={item.directDownloadUrl} className="rounded-md p-2 text-zinc-600 hover:bg-white/10 hover:text-white" title="Download original" aria-label="Download original">
                        <Download className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                );
              }

              return (
                <article key={item.path} className={`group min-w-0 overflow-hidden rounded-lg border transition ${checked ? "border-[#d7ff3f] bg-[#d7ff3f]/[0.04]" : "border-white/[0.08] bg-[#0d0f13] hover:border-white/20"}`}>
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <button type="button" onClick={() => openItem(item)} className="absolute inset-0 z-0 w-full">
                      <GalleryMedia item={item} />
                    </button>
                    {selectable ? (
                      <button
                        type="button"
                        disabled={blockedByMax}
                        onClick={() => toggleSelect(item)}
                        className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border shadow-lg backdrop-blur transition ${checked ? "border-[#d7ff3f] bg-[#d7ff3f] text-black" : "border-white/30 bg-black/45 text-transparent hover:border-white/70"} disabled:cursor-not-allowed disabled:opacity-30`}
                        aria-label={checked ? "Deselect photo" : "Select photo"}
                      >
                        {checked ? <span className="text-xs font-bold">{selectedNumber}</span> : <Check className="h-4 w-4" />}
                      </button>
                    ) : null}
                    {item.directDownloadUrl ? (
                      <a href={item.directDownloadUrl} className="absolute bottom-2 right-2 z-10 rounded-md bg-black/55 p-2 text-zinc-300 opacity-100 backdrop-blur transition hover:text-white md:opacity-0 md:group-hover:opacity-100" title="Download original" aria-label="Download original">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-xs font-semibold text-zinc-200 sm:text-sm">{item.name}</p>
                    <p className="mt-1 text-[11px] text-zinc-600">{extensionLabel(item)}{item.size ? ` · ${item.size}` : ""}</p>
                    {checked ? (
                      <label className="mt-2 block">
                        <span className="sr-only">Note for {item.name}</span>
                        <textarea
                          value={photoNotes[item.path] || ""}
                          onChange={(event) => setPhotoNotes((current) => ({ ...current, [item.path]: event.target.value }))}
                          rows={2}
                          placeholder="Add a note (optional)"
                          className="w-full resize-none rounded-md border border-white/10 bg-black/25 px-2.5 py-2 text-xs leading-5 outline-none placeholder:text-zinc-700 focus:border-[#d7ff3f]/40"
                        />
                      </label>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0d0f13]/95 px-3 py-2.5 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3">
          <span className="text-sm font-semibold text-zinc-300">{compactSelectionLabel}</span>
          <button type="button" onClick={openSubmit} disabled={!selectedCount} className="inline-flex items-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-2.5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">
            <Send className="h-4 w-4" />
            Submit
          </button>
        </div>
      </div>

      {submitOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/75 backdrop-blur-sm md:items-center md:justify-center md:p-4">
          <section className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-[#111318] p-5 shadow-2xl md:max-w-lg md:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-[#d7ff3f]">Confirm selection</p>
                <h2 className="mt-1 text-xl font-bold text-white">{selectionLabel}</h2>
              </div>
              <button type="button" onClick={() => setSubmitOpen(false)} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close confirmation">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-zinc-200">Your name</span>
                <input autoFocus required value={clientName} onChange={(event) => setClientName(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm outline-none focus:border-[#d7ff3f]/50" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-zinc-200">Email</span>
                <input type="email" required value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm outline-none focus:border-[#d7ff3f]/50" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-zinc-200">Note <span className="font-normal text-zinc-600">(optional)</span></span>
                <textarea value={globalNote} onChange={(event) => setGlobalNote(event.target.value)} rows={4} placeholder="Anything the editor should know?" className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-zinc-700 focus:border-[#d7ff3f]/50" />
              </label>
            </div>

            {notice ? <p className="mt-4 text-sm font-medium text-amber-200">{notice}</p> : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setSubmitOpen(false)} disabled={submitting} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-white/10 disabled:opacity-50">Keep editing</button>
              <button type="button" onClick={() => void submitSelection()} disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? "Submitting..." : isSubmittedState ? "Update selection" : "Confirm submit"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <PreviewModal
        item={previewItem}
        open={previewItem !== null}
        canDownload={Boolean(link?.allowOriginalDownload)}
        onClose={() => setPreviewItem(null)}
        onCopy={(text) => {
          void navigator.clipboard.writeText(text).catch(() => undefined);
          setNotice("Link copied.");
        }}
      />
    </main>
  );
}
