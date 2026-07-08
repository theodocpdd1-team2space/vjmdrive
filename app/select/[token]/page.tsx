"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  Download,
  Folder,
  Home,
  Loader2,
  Search,
  Send,
  Square,
} from "lucide-react";
import {
  FileThumbnail,
  PreviewModal,
  PreviewStatusBadge,
  type DriveItem,
  type ViewMode,
  ViewToggle,
  formatBytes,
  typeLabel,
} from "@/components/drive/drive-ui";

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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [hasLoadedSubmission, setHasLoadedSubmission] = useState(false);

  const loadFolder = useCallback(
    async (nextPath: string) => {
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
    },
    [hasLoadedSubmission, token]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFolder(""), 0);
    return () => window.clearTimeout(timer);
  }, [loadFolder]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const maxSelected = link?.maxSelectedPhotos || null;
  const selectedCount = selectedPaths.size;
  const maxReached = Boolean(maxSelected && selectedCount >= maxSelected);
  const isSubmittedState = submitted || link?.status === "SUBMITTED";
  const canEditSubmitted = Boolean(link?.allowEditAfterSubmit && link?.status === "SUBMITTED");
  const lockedSubmittedState = isSubmittedState && !canEditSubmitted;
  const counterText = maxSelected ? `${selectedCount} / ${maxSelected} selected` : `${selectedCount} selected`;
  const breadcrumbs = path.split("/").filter(Boolean);
  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => item.name.toLowerCase().includes(keyword));
  }, [items, query]);
  const visibleBytes = filteredItems.reduce((total, item) => total + (item.type === "folder" ? 0 : item.bytes || 0), 0);

  function isSelectable(item: DriveItem) {
    return item.type === "image";
  }

  function openItem(item: DriveItem) {
    if (item.type === "folder") {
      setQuery("");
      void loadFolder(item.path);
      return;
    }
    if (item.canPreview) setPreviewItem(item);
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

  async function submitSelection() {
    if (submitting || lockedSubmittedState) return;
    if (!selectedPaths.size) {
      setNotice("Select at least one photo.");
      return;
    }
    if (!clientName.trim()) {
      setNotice("Client name is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim().toLowerCase())) {
      setNotice("Valid client email is required.");
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

    setSubmitted(true);
    setLink((current) => current ? { ...current, status: "SUBMITTED" } : current);
    setNotice(canEditSubmitted ? "Selection updated." : "Selection submitted.");
  }

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08090d]/95 px-3 py-3 backdrop-blur md:px-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d7ff3f] text-black shadow-[0_0_25px_rgba(215,255,63,0.18)]">
              <CheckSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff3f]">Client Select</p>
              <h1 className="truncate text-lg font-black text-white">{link?.projectName || "Photo Selection"}</h1>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 md:w-80">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search photos..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
              />
            </div>
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-3 p-3 md:p-4">
        {notice ? (
          <div className="rounded-xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-3 py-2 text-sm font-medium text-[#d7ff3f]">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-amber-300/20 bg-amber-300/10 text-amber-300">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Link unavailable</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">{error}</p>
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <nav className="flex flex-wrap items-center gap-1 text-sm">
                    <button
                      onClick={() => void loadFolder("")}
                      className="inline-flex items-center gap-2 rounded-xl px-3 py-2 font-bold text-white hover:bg-white/10"
                    >
                      <Home className="h-4 w-4 text-[#d7ff3f]" />
                      Gallery
                    </button>
                    {breadcrumbs.map((crumb, index) => (
                      <div key={`${crumb}-${index}`} className="flex items-center gap-1">
                        <ChevronRight className="h-4 w-4 text-zinc-600" />
                        <button
                          onClick={() => void loadFolder(breadcrumbs.slice(0, index + 1).join("/"))}
                          className="max-w-[150px] truncate rounded-xl px-3 py-2 text-zinc-300 hover:bg-white/10"
                        >
                          {crumb}
                        </button>
                      </div>
                    ))}
                  </nav>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-zinc-400">
                      {filteredItems.length} item(s)
                    </span>
                    <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-zinc-400">
                      {formatBytes(visibleBytes)}
                    </span>
                  </div>
                </div>
              </div>

              <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 lg:row-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d7ff3f]">Selection</p>
                    <p className="mt-1 text-2xl font-black text-white">{counterText}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 text-[#d7ff3f]">
                    <CheckSquare className="h-6 w-6" />
                  </div>
                </div>

                {maxReached && !isSubmittedState ? (
                  <p className="mt-4 rounded-xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-3 py-2 text-sm font-semibold text-[#d7ff3f]">
                    Selection limit reached.
                  </p>
                ) : null}

                {lockedSubmittedState ? (
                  <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-100">
                    <p className="font-black">Selection submitted. Thank you.</p>
                    <p className="mt-2 text-sm text-emerald-100/75">Your selected filenames have been sent to the owner.</p>
                  </div>
                ) : (
                  <>
                    <div className="mt-4 space-y-3">
                      <label className="block">
                        <span className="text-sm text-zinc-300">Client name</span>
                        <input
                          value={clientName}
                          onChange={(event) => setClientName(event.target.value)}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm text-zinc-300">Client email</span>
                        <input
                          type="email"
                          value={clientEmail}
                          onChange={(event) => setClientEmail(event.target.value)}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm text-zinc-300">Global note</span>
                        <textarea
                          value={globalNote}
                          onChange={(event) => setGlobalNote(event.target.value)}
                          rows={5}
                          placeholder="Optional note for the editor..."
                          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-[#d7ff3f]/50"
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => void submitSelection()}
                      disabled={submitting || !selectedCount}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {submitting ? "Submitting..." : isSubmittedState ? "Update Selection" : "Submit Selection"}
                    </button>
                  </>
                )}

                {link?.allowOriginalDownload ? (
                  <p className="mt-3 text-xs text-zinc-500">Original download is enabled for this selection link.</p>
                ) : null}
              </aside>
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
              {loading ? (
                <div className="flex h-72 items-center justify-center gap-2 text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />
                  Loading gallery...
                </div>
              ) : null}

              {!loading && filteredItems.length === 0 ? (
                <div className="flex h-72 flex-col items-center justify-center gap-3 p-8 text-center">
                  <Folder className="h-10 w-10 text-zinc-500" />
                  <div>
                    <p className="font-bold text-white">No files here</p>
                    <p className="mt-1 text-sm text-zinc-500">Try another folder or search term.</p>
                  </div>
                </div>
              ) : null}

              {!loading && filteredItems.length > 0 ? (
                <div className={viewMode === "grid" ? "grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "divide-y divide-white/10"}>
                  {filteredItems.map((item) => {
                    const selectable = isSelectable(item);
                    const checked = selectedPaths.has(item.path);
                    const blockedByMax = !checked && maxReached;
                    return (
                      <div
                        key={item.path}
                        role="button"
                        tabIndex={0}
                        onClick={() => openItem(item)}
                        className={viewMode === "grid"
                          ? `cursor-pointer rounded-2xl border p-3 transition hover:bg-white/[0.05] ${checked ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`
                          : `grid cursor-pointer grid-cols-[42px_42px_minmax(0,1fr)] items-center gap-3 px-4 py-3 transition hover:bg-white/[0.04] md:grid-cols-[42px_42px_minmax(0,1fr)_120px_150px] ${checked ? "bg-[#d7ff3f]/10" : ""}`}
                      >
                        <button
                          type="button"
                          disabled={!selectable || blockedByMax || lockedSubmittedState}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleSelect(item);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={checked ? "Deselect photo" : "Select photo"}
                        >
                          {checked ? <CheckSquare className="h-5 w-5 text-[#d7ff3f]" /> : <Square className="h-5 w-5" />}
                        </button>
                        <div className="relative">
                          <FileThumbnail item={item} size={viewMode === "grid" ? "grid" : "row"} />
                          {checked ? (
                            <span className="absolute right-2 top-2 rounded-full bg-[#d7ff3f] p-1 text-black shadow-lg">
                              <CheckSquare className="h-4 w-4" />
                            </span>
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{item.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            <span>{typeLabel(item)}</span>
                            <PreviewStatusBadge item={item} />
                          </div>
                        </div>
                        {checked && !lockedSubmittedState ? (
                          <label
                            className={viewMode === "grid" ? "mt-3 block" : "col-span-3 md:col-span-5"}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <span className="text-xs font-semibold text-zinc-400">Note for this photo</span>
                            <textarea
                              value={photoNotes[item.path] || ""}
                              onChange={(event) => setPhotoNotes((current) => ({ ...current, [item.path]: event.target.value }))}
                              rows={2}
                              className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none placeholder:text-zinc-600 focus:border-[#d7ff3f]/50"
                            />
                          </label>
                        ) : null}
                        <span className={viewMode === "grid" ? "mt-3 block text-xs text-zinc-500" : "hidden text-xs text-zinc-500 md:block"}>
                          {item.size || formatBytes(item.bytes || 0)}
                        </span>
                        <div className={viewMode === "grid" ? "mt-4 flex flex-wrap gap-2" : "hidden justify-end gap-2 md:flex"}>
                          {item.directDownloadUrl ? (
                            <a
                              href={item.directDownloadUrl}
                              onClick={(event) => event.stopPropagation()}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          </>
        )}
      </div>

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
