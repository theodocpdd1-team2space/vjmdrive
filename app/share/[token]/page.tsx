"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Download,
  HardDrive,
  Home,
  LockKeyhole,
  Search,
  X,
} from "lucide-react";
import {
  DownloadModeBadge,
  type DriveItem,
  EmptyState,
  FileThumbnail,
  formatDate,
  formatBytes,
  LoadingState,
  PreviewModal,
  PreviewStatusBadge,
  SelectionCheckbox,
  type ViewMode,
  ViewToggle,
  previewStatusLabel,
  typeLabel,
} from "@/components/drive/drive-ui";

type ShareMeta = {
  name: string;
  canDownload: boolean;
  expiresAt: string | null;
  note?: string;
  visibility?: "PUBLIC" | "PRIVATE_EMAILS";
};

type ShareApiError = {
  ok?: false;
  code?: string;
  requiresLogin?: boolean;
  loginUrl?: string;
  message?: string;
};

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [path, setPath] = useState("");
  const [items, setItems] = useState<DriveItem[]>([]);
  const [share, setShare] = useState<ShareMeta>({
    name: "Shared Drive",
    canDownload: true,
    expiresAt: null,
  });
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectingToLogin, setRedirectingToLogin] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [notice, setNotice] = useState("");

  const loginUrl = `/login?next=${encodeURIComponent(`/share/${token}`)}`;

  const handleShareError = useCallback(
    (data: ShareApiError | null, status: number) => {
      const code = data?.code || "";
      const mustLogin = status === 401 || data?.requiresLogin || code === "LOGIN_REQUIRED";

      if (mustLogin) {
        setRedirectingToLogin(true);
        setErrorCode("LOGIN_REQUIRED");
        setError("Please login first to access this share.");
        router.replace(data?.loginUrl || loginUrl);
        return;
      }

      setErrorCode(code);
      setError(data?.message || "Share link expired or not found.");
    },
    [loginUrl, router]
  );

  const loadFolder = useCallback(
    async (nextPath: string) => {
      setLoading(true);
      setError("");
      setErrorCode("");

      const res = await fetch(`/api/share/${token}/list?path=${encodeURIComponent(nextPath)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);

      setLoading(false);

      if (!res.ok || !data?.ok) {
        handleShareError(data, res.status);
        return;
      }

      setPath(data.path || "");
      setItems(data.items || []);
      setShare({
        name: data.share?.name || "Shared Drive",
        canDownload: data.share?.canDownload !== false,
        expiresAt: data.share?.expiresAt || null,
        note: data.share?.note || "",
        visibility: data.share?.visibility || "PUBLIC",
      });
      setSelectedPaths(new Set());
    },
    [handleShareError, token]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFolder(""), 0);
    return () => window.clearTimeout(timer);
  }, [loadFolder]);

  function open(item: DriveItem) {
    if (item.type === "folder") {
      setQuery("");
      setPreviewItem(null);
      void loadFolder(item.path);
    } else {
      setPreviewItem(item);
    }
  }

  function toggleSelect(itemPath: string) {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(itemPath)) next.delete(itemPath);
      else next.add(itemPath);
      return next;
    });
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text).catch(() => undefined);
    setNotice("Link copied.");
    window.setTimeout(() => setNotice(""), 2400);
  }

  function downloadSelected() {
    const selectedFiles = items.filter(
      (item) => selectedPaths.has(item.path) && item.type !== "folder" && item.directDownloadUrl
    );

    if (!selectedFiles.length) {
      setNotice("No downloadable files selected.");
      window.setTimeout(() => setNotice(""), 2400);
      return;
    }

    selectedFiles.forEach((item, index) => {
      window.setTimeout(() => window.open(item.directDownloadUrl || "", "_blank", "noopener,noreferrer"), index * 150);
    });

    setNotice(`Opening ${selectedFiles.length} download link(s).`);
    window.setTimeout(() => setNotice(""), 2400);
  }

  const breadcrumbs = path.split("/").filter(Boolean);
  const filtered = query.trim()
    ? items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase().trim()))
    : items;
  const displayedBytes = filtered.reduce((total, item) => total + (item.type === "folder" ? 0 : item.bytes), 0);

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08090d]/95 px-3 py-3 backdrop-blur md:px-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d7ff3f] text-black shadow-[0_0_25px_rgba(215,255,63,0.18)]">
              <HardDrive className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff3f]">driveOne by VJMRTIM</p>
              <h1 className="truncate font-semibold">{share.name}</h1>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 md:w-80">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search shared folder..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
              />
            </div>
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-3 md:p-4">
        {notice ? (
          <div className="mb-3 rounded-xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-3 py-2 text-sm font-medium text-[#d7ff3f]">
            {notice}
          </div>
        ) : null}

        {redirectingToLogin ? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 text-[#d7ff3f]">
              <LockKeyhole className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Login required</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                This share is protected. Redirecting you to login so you can access it securely.
              </p>
            </div>
            <button
              onClick={() => router.replace(loginUrl)}
              className="rounded-xl bg-[#d7ff3f] px-5 py-3 text-sm font-black text-black"
            >
              Continue to login
            </button>
          </div>
        ) : error ? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-amber-300/20 bg-amber-300/10 text-amber-300">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">
                {errorCode === "EMAIL_NOT_ALLOWED" ? "Access denied" : "Share link unavailable"}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">{error}</p>
            </div>
            {errorCode === "EMAIL_NOT_ALLOWED" ? (
              <button
                onClick={() => router.push("/dashboard")}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                Back to dashboard
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <nav className="flex flex-wrap items-center gap-1 text-sm">
                  <button
                    onClick={() => void loadFolder("")}
                    className="inline-flex items-center gap-2 rounded-xl px-2 py-2 font-medium text-white hover:bg-white/10"
                  >
                    <Home className="h-4 w-4 text-[#d7ff3f]" />
                    Shared Drive
                  </button>
                  {breadcrumbs.map((crumb, index) => (
                    <div key={`${crumb}-${index}`} className="flex items-center gap-1">
                      <ChevronRight className="h-4 w-4 text-zinc-600" />
                      <button
                        onClick={() => void loadFolder(breadcrumbs.slice(0, index + 1).join("/"))}
                        className="max-w-[160px] truncate rounded-xl px-2 py-2 text-zinc-300 hover:bg-white/10"
                      >
                        {crumb}
                      </button>
                    </div>
                  ))}
                </nav>

                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span>
                    <b className="text-white">{filtered.length}</b> items
                  </span>
                  <span>
                    <b className="text-white">{formatBytes(displayedBytes)}</b> displayed
                  </span>
                  <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1">
                    {share.canDownload ? "View + Download" : "View only"}
                  </span>
                  <span className="rounded-lg border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-2 py-1 text-[#d7ff3f]">
                    Login protected
                  </span>
                </div>
              </div>

              {share.note ? <p className="mt-3 text-sm text-zinc-500">{share.note}</p> : null}
              {share.expiresAt ? <p className="mt-2 text-xs text-zinc-600">Expires {formatDate(share.expiresAt)}</p> : null}
            </section>

            {selectedPaths.size > 0 ? (
              <div className="sticky bottom-3 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#101217]/95 p-2 shadow-2xl backdrop-blur">
                <span className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-200">
                  {selectedPaths.size} selected
                </span>
                {share.canDownload ? (
                  <button
                    onClick={downloadSelected}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black"
                  >
                    <Download className="h-4 w-4" />
                    Download selected
                  </button>
                ) : null}
                <button
                  onClick={() => setSelectedPaths(new Set())}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-200"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              </div>
            ) : null}

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {loading ? (
                <LoadingState label="Loading shared files..." />
              ) : filtered.length === 0 ? (
                <EmptyState title="No files here" body="This shared folder is empty or search found nothing." />
              ) : viewMode === "grid" ? (
                <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {filtered.map((item) => (
                    <ShareCard
                      key={item.path}
                      item={item}
                      checked={selectedPaths.has(item.path)}
                      canDownload={share.canDownload}
                      token={token}
                      onOpen={open}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {filtered.map((item) => (
                    <ShareRow
                      key={item.path}
                      item={item}
                      checked={selectedPaths.has(item.path)}
                      compact={viewMode === "compact"}
                      canDownload={share.canDownload}
                      token={token}
                      onOpen={open}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <PreviewModal
        key={previewItem?.path || "share-preview"}
        item={previewItem}
        open={previewItem !== null}
        canDownload={share.canDownload}
        onClose={() => setPreviewItem(null)}
        onCopy={copyText}
      />
    </main>
  );
}

function ShareCard({
  item,
  checked,
  canDownload,
  token,
  onOpen,
  onToggleSelect,
}: {
  item: DriveItem;
  checked: boolean;
  canDownload: boolean;
  token: string;
  onOpen: (item: DriveItem) => void;
  onToggleSelect: (path: string) => void;
}) {
  return (
    <div className="flex min-h-[230px] flex-col rounded-2xl border border-white/10 bg-black/20 p-3 transition hover:border-white/20 hover:bg-white/[0.05]">
      <div className="mb-3 flex items-center justify-between">
        <SelectionCheckbox checked={checked} onClick={() => onToggleSelect(item.path)} />
        {item.type === "folder" && canDownload ? (
          <a
            href={`/api/share/${token}/zip?path=${encodeURIComponent(item.path)}`}
            onClick={(event) => {
              if (!window.confirm("Folder ZIP can be slow for huge folders. For very large assets, download files individually.")) {
                event.preventDefault();
              }
            }}
            className="rounded-xl border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/10"
          >
            ZIP
          </a>
        ) : item.directDownloadUrl && canDownload ? (
          <a
            href={item.directDownloadUrl}
            className="rounded-xl bg-[#d7ff3f] p-2 text-black"
            aria-label={`Download ${item.name}`}
          >
            <Download className="h-4 w-4" />
          </a>
        ) : null}
      </div>

      <button onClick={() => onOpen(item)} className="flex flex-1 flex-col text-left">
        <FileThumbnail item={item} />
        <span className="mt-3 line-clamp-2 min-h-10 text-sm font-medium text-white" title={item.name}>
          {item.name}
        </span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-300">
            {typeLabel(item)}
          </span>
          <PreviewStatusBadge item={item} />
        </span>
        <span className="mt-auto pt-2 text-xs text-zinc-500">{item.size || "Folder"}</span>
      </button>
    </div>
  );
}

function ShareRow({
  item,
  checked,
  compact,
  canDownload,
  token,
  onOpen,
  onToggleSelect,
}: {
  item: DriveItem;
  checked: boolean;
  compact: boolean;
  canDownload: boolean;
  token: string;
  onOpen: (item: DriveItem) => void;
  onToggleSelect: (path: string) => void;
}) {
  return (
    <div
      className={`grid gap-2 px-3 ${
        compact ? "py-1.5" : "py-2"
      } md:grid-cols-[42px_minmax(0,1fr)_100px_120px_74px_56px] md:items-center`}
    >
      <SelectionCheckbox checked={checked} onClick={() => onToggleSelect(item.path)} />

      <button onClick={() => onOpen(item)} className="grid min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-3 text-left">
        <FileThumbnail item={item} size="row" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-white" title={item.name}>
            {item.name}
          </span>
          <span className="mt-1 block truncate text-xs text-zinc-500">
            {typeLabel(item)} - {previewStatusLabel(item)}
          </span>
        </span>
      </button>

      <span className="hidden text-sm text-zinc-400 md:block">{item.size || "Folder"}</span>
      <span className="hidden md:block">
        <PreviewStatusBadge item={item} />
      </span>
      <span className="hidden md:block">
        <DownloadModeBadge item={item} />
      </span>

      <div className="flex gap-2 md:justify-end">
        {item.type === "folder" && canDownload ? (
          <a
            href={`/api/share/${token}/zip?path=${encodeURIComponent(item.path)}`}
            onClick={(event) => {
              if (!window.confirm("Folder ZIP can be slow for huge folders. For very large assets, download files individually.")) {
                event.preventDefault();
              }
            }}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"
          >
            ZIP
          </a>
        ) : item.directDownloadUrl && canDownload ? (
          <a
            href={item.directDownloadUrl}
            className="rounded-xl bg-[#d7ff3f] p-2 text-black"
            aria-label={`Download ${item.name}`}
          >
            <Download className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    </div>
  );
}