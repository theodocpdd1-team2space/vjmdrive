"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  Copy,
  Download,
  Eye,
  File,
  FileArchive,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  Grid2X2,
  Home,
  List,
  Loader2,
  LogOut,
  MoreVertical,
  Search,
  Square,
  X,
} from "lucide-react";

type DriveItemType = "folder" | "image" | "video" | "pdf" | "text" | "archive" | "file";
type PreviewStatus = "native" | "ready" | "missing" | "unsupported";
type ViewMode = "list" | "grid";

type DriveItem = {
  name: string;
  path: string;
  type: DriveItemType;
  extension: string;
  size: string | null;
  bytes: number;
  modified: string;
  canPreview: boolean;
  previewStatus: PreviewStatus;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  originalUrl: string;
  directDownloadUrl: string | null;
  downloadMode: "direct" | "app";
  isLargeFile: boolean;
};

type AuthState = "checking" | "guest" | "authed";
type SelectionNotice = {
  tone: "info" | "warning";
  message: string;
  links?: DriveItem[];
};

const TEXT_PREVIEW_LIMIT = 256 * 1024;

function fileUrl(filePath: string, download = false) {
  const params = new URLSearchParams({ path: filePath });
  if (download) params.set("download", "1");
  return `/api/file?${params.toString()}`;
}

function iconFor(type: DriveItemType) {
  if (type === "folder") return Folder;
  if (type === "video") return FileVideo;
  if (type === "image") return FileImage;
  if (type === "archive") return FileArchive;
  if (type === "pdf" || type === "text") return FileText;
  return File;
}

function typeLabel(item: DriveItem) {
  if (item.type === "folder") return "Folder";
  if (item.type === "pdf") return "PDF";
  if (item.extension) return item.extension.toUpperCase();
  return "File";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function previewStatusLabel(item: DriveItem) {
  if (item.type === "folder") return "Folder";
  if (item.type === "video" && item.previewStatus === "ready") return "Cached Preview";
  if (item.type === "video" && item.previewStatus === "native") return "Native Preview";
  if (item.type === "video" && item.previewStatus === "missing") return "Preview Missing";
  return item.canPreview ? "Preview available" : "Download only";
}

function videoPreviewBadge(item: DriveItem) {
  if (item.previewStatus === "ready") {
    return {
      label: "Cached Preview",
      className: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    };
  }

  if (item.previewStatus === "native") {
    return {
      label: "Native Preview",
      className: "border-[#d7ff3f]/20 bg-[#d7ff3f]/10 text-[#d7ff3f]",
    };
  }

  return {
    label: "Preview Missing",
    className: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  };
}

function downloadModeLabel(item: DriveItem) {
  return item.downloadMode === "direct" ? "Direct download" : "App download";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/10 py-3 last:border-0">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}

export default function HomePage() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState<DriveItem[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DriveItem | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewTruncated, setPreviewTruncated] = useState(false);
  const [notice, setNotice] = useState<SelectionNotice | null>(null);
  const [copyMessage, setCopyMessage] = useState("");

  function clearPreviewState() {
    setPreviewText("");
    setPreviewError("");
    setPreviewLoading(false);
    setPreviewTruncated(false);
  }

  function clearSelection() {
    setSelectedPaths(new Set());
    setNotice(null);
  }

  function preparePreviewState(item: DriveItem) {
    setPreviewText("");
    setPreviewError("");
    setPreviewLoading(item.type === "text");
    setPreviewTruncated(item.type === "text" && item.bytes > TEXT_PREVIEW_LIMIT);
  }

  const loadDrive = useCallback(async (targetPath: string) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/list?path=${encodeURIComponent(targetPath)}`, {
        cache: "no-store",
      });

      if (res.status === 401) {
        setAuthState("guest");
        setItems([]);
        setSelected(null);
        return false;
      }

      setAuthState("authed");
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Gagal membaca folder.");
      }

      setCurrentPath(data.path || "");
      setItems(data.items || []);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal membaca folder.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDrive("");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDrive]);

  useEffect(() => {
    if (!selected || selected.type !== "text") {
      return;
    }

    const item = selected;
    const controller = new AbortController();
    const shouldTruncate = item.bytes > TEXT_PREVIEW_LIMIT;
    const headers = new Headers();

    if (shouldTruncate) {
      headers.set("Range", `bytes=0-${TEXT_PREVIEW_LIMIT - 1}`);
    }

    async function loadTextPreview() {
      try {
        const res = await fetch(fileUrl(item.path), {
          cache: "no-store",
          headers,
          signal: controller.signal,
        });

        if (!res.ok && res.status !== 206) {
          throw new Error("Text preview gagal dimuat.");
        }

        setPreviewText(await res.text());
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }

        setPreviewError(caught instanceof Error ? caught.message : "Text preview gagal dimuat.");
      } finally {
        setPreviewLoading(false);
      }
    }

    void loadTextPreview();

    return () => controller.abort();
  }, [selected]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setLoggingIn(true);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoggingIn(false);

    if (!res.ok) {
      setLoginError("Password salah.");
      return;
    }

    setPassword("");
    setSelected(null);
    clearPreviewState();
    clearSelection();
    setQuery("");
    await loadDrive("");
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setAuthState("guest");
    setCurrentPath("");
    setItems([]);
    setSelected(null);
    clearPreviewState();
    clearSelection();
    setQuery("");
  }

  function openFolder(item: DriveItem) {
    setSelected(null);
    clearPreviewState();
    clearSelection();
    setQuery("");
    void loadDrive(item.path);
  }

  function previewItem(item: DriveItem) {
    if (item.type === "folder") {
      openFolder(item);
      return;
    }

    preparePreviewState(item);
    setSelected(item);
  }

  function goBreadcrumb(index: number) {
    const segments = currentPath.split("/").filter(Boolean);
    const targetPath = index < 0 ? "" : segments.slice(0, index + 1).join("/");

    setSelected(null);
    clearPreviewState();
    clearSelection();
    setQuery("");
    void loadDrive(targetPath);
  }

  function toggleSelect(path: string) {
    setNotice(null);
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function selectAllDisplayed() {
    setNotice(null);
    setSelectedPaths(new Set(filtered.map((item) => item.path)));
  }

  async function copyLink(item: DriveItem) {
    if (!item.directDownloadUrl) {
      setCopyMessage("Folder tidak punya direct original link.");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.directDownloadUrl);
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = item.directDownloadUrl;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopyMessage("Direct link copied.");
    window.setTimeout(() => setCopyMessage(""), 1800);
  }

  function downloadSelected() {
    const selectedItems = items.filter((item) => selectedPaths.has(item.path));
    const selectedFiles = selectedItems.filter((item) => item.type !== "folder" && item.directDownloadUrl);
    const hasFolder = selectedItems.some((item) => item.type === "folder");

    if (hasFolder) {
      setNotice({
        tone: "warning",
        message:
          "Folder download as ZIP can be slow for huge folders. Open folder and download files directly.",
        links: selectedFiles,
      });
      return;
    }

    selectedFiles.forEach((item) => {
      if (item.directDownloadUrl) {
        window.open(item.directDownloadUrl, "_blank", "noopener,noreferrer");
      }
    });

    setNotice({
      tone: "info",
      message: "Opening selected file downloads. If your browser blocks popups, use these links.",
      links: selectedFiles,
    });
  }

  const breadcrumbs = currentPath.split("/").filter(Boolean);

  const needle = query.toLowerCase().trim();
  const filtered = needle
    ? items.filter((item) => item.name.toLowerCase().includes(needle))
    : items;
  const selectedItems = items.filter((item) => selectedPaths.has(item.path));

  const selectedCount = selectedPaths.size;
  const displayedBytes = filtered.reduce((total, item) => total + (item.type === "folder" ? 0 : item.bytes), 0);
  const allDisplayedSelected = filtered.length > 0 && filtered.every((item) => selectedPaths.has(item.path));
  const selectedVideoPreviewUrl =
    selected?.type === "video" && selected.previewStatus === "ready"
      ? selected.previewUrl
      : selected?.type === "video" && selected.previewStatus === "native"
        ? selected.previewUrl || selected.originalUrl
        : null;

  if (authState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08090d] text-zinc-100">
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />
          Checking drive session...
        </div>
      </main>
    );
  }

  if (authState !== "authed") {
    return (
      <main className="min-h-screen bg-[#08090d] text-zinc-100">
        <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 py-10">
          <div className="grid w-full gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
            <div className="max-w-2xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[#d7ff3f]/30 bg-[#d7ff3f] text-black">
                <Folder className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-[#d7ff3f]">VJMRTIM</p>
              <h1 className="mt-2 text-4xl font-semibold text-white md:text-6xl">
                VJMRTIM Asset Drive
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-zinc-400">
                Private local asset explorer untuk MVP internal.
              </p>
            </div>

            <form
              onSubmit={login}
              className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
            >
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-white">Login</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Local password: <span className="font-semibold text-[#d7ff3f]">admin123</span>
                </p>
              </div>

              <label className="block text-sm font-medium text-zinc-300" htmlFor="drive-password">
                Master password
              </label>
              <input
                id="drive-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-[#d7ff3f]"
                autoComplete="current-password"
              />

              {loginError ? (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {loginError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loggingIn}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-3 font-semibold text-black transition hover:bg-[#c7f02f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Home className="h-4 w-4" />}
                Enter Drive
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08090d]/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d7ff3f] text-black">
              <Folder className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#d7ff3f]">VJMRTIM</p>
              <h1 className="truncate text-lg font-semibold text-white">Asset Drive</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 md:w-96">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search current folder..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
              />
            </div>

            <button
              type="button"
              onClick={logout}
              title="Logout"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-w-0">
          <nav className="mb-4 flex min-h-12 flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm">
            <button
              type="button"
              onClick={() => goBreadcrumb(-1)}
              className="inline-flex items-center gap-2 rounded-lg px-2 py-2 font-medium text-white transition hover:bg-white/10"
            >
              <Home className="h-4 w-4 text-[#d7ff3f]" />
              PublicShare
            </button>

            {breadcrumbs.map((crumb, index) => (
              <div key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-1">
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                <button
                  type="button"
                  onClick={() => goBreadcrumb(index)}
                  className="max-w-[180px] truncate rounded-lg px-2 py-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  title={crumb}
                >
                  {crumb}
                </button>
              </div>
            ))}
          </nav>

          <div className="mb-4 grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="grid gap-2 text-sm text-zinc-400 sm:grid-cols-3">
              <span>
                <b className="text-white">{filtered.length}</b> items
              </span>
              <span>
                <b className="text-white">{formatBytes(displayedBytes)}</b> displayed
              </span>
              <span>
                <b className="text-white">{selectedCount}</b> selected
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAllDisplayed}
                disabled={filtered.length === 0 || allDisplayedSelected}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckSquare className="h-4 w-4" />
                Select all
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={selectedCount === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
              <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  title="List View"
                  className={`rounded-md p-2 ${viewMode === "list" ? "bg-[#d7ff3f] text-black" : "text-zinc-400 hover:text-white"}`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                  className={`rounded-md p-2 ${viewMode === "grid" ? "bg-[#d7ff3f] text-black" : "text-zinc-400 hover:text-white"}`}
                >
                  <Grid2X2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {selectedCount > 0 ? (
            <div className="mb-4 rounded-lg border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-[#d7ff3f]">
                  {selectedCount} selected
                  {selectedItems.some((item) => item.type === "folder")
                    ? " - folder selected"
                    : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={downloadSelected}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black transition hover:bg-[#c7f02f]"
                  >
                    <Download className="h-4 w-4" />
                    Download selected
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                    Clear selection
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-400">
                Folder download as ZIP can be slow for huge folders. Open folder and download files directly.
              </p>
            </div>
          ) : null}

          {notice ? (
            <div
              className={`mb-4 rounded-lg border p-3 text-sm ${
                notice.tone === "warning"
                  ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
                  : "border-white/10 bg-white/[0.04] text-zinc-300"
              }`}
            >
              <p>{notice.message}</p>
              {notice.links?.length ? (
                <div className="mt-2 space-y-1">
                  {notice.links.map((item) => (
                    <a
                      key={item.path}
                      href={item.directDownloadUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-[#d7ff3f] underline-offset-4 hover:underline"
                    >
                      {item.name}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
            {loading ? (
              <div className="flex h-80 items-center justify-center gap-3 text-sm text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />
                Loading files...
              </div>
            ) : error ? (
              <div className="flex h-80 flex-col items-center justify-center gap-3 px-5 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-300" />
                <p className="text-sm font-medium text-white">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadDrive(currentPath)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
                >
                  Retry
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-80 flex-col items-center justify-center gap-3 px-5 text-center">
                <Folder className="h-10 w-10 text-zinc-600" />
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {query ? `No result for "${query}".` : "Folder kosong."}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Browse another folder or clear the current search.
                  </p>
                </div>
              </div>
            ) : viewMode === "list" ? (
              <div>
                <div className="hidden grid-cols-[44px_minmax(0,1fr)_130px_120px_150px] border-b border-white/10 px-4 py-3 text-xs font-medium text-zinc-500 md:grid">
                  <span />
                  <span>Name</span>
                  <span>Modified</span>
                  <span className="text-right">Size</span>
                  <span className="text-right">Actions</span>
                </div>
                <div className="divide-y divide-white/10">
                  {filtered.map((item) => {
                    const Icon = iconFor(item.type);
                    const isPreviewed = selected?.path === item.path;
                    const isChecked = selectedPaths.has(item.path);

                    return (
                      <div
                        key={item.path}
                        className={`grid grid-cols-[36px_minmax(0,1fr)] gap-2 px-3 py-2 transition md:grid-cols-[44px_minmax(0,1fr)_130px_120px_150px] md:items-center ${
                          isPreviewed ? "bg-[#d7ff3f]/10" : "hover:bg-white/[0.045]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSelect(item.path)}
                          title={isChecked ? "Unselect" : "Select"}
                          className="flex h-10 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
                        >
                          {isChecked ? <CheckSquare className="h-5 w-5 text-[#d7ff3f]" /> : <Square className="h-5 w-5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => (item.type === "folder" ? openFolder(item) : previewItem(item))}
                          className="grid min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-lg py-1 text-left"
                        >
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                              item.type === "folder"
                                ? "border-[#d7ff3f]/20 bg-[#d7ff3f]/10 text-[#d7ff3f]"
                                : "border-white/10 bg-black/20 text-zinc-400"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-white">
                              {item.name}
                            </span>
                            <span className="mt-1 block truncate text-xs text-zinc-500">
                              {typeLabel(item)} - {previewStatusLabel(item)} - {item.type === "folder" ? "Open folder" : downloadModeLabel(item)}
                            </span>
                          </span>
                        </button>

                        <span className="hidden text-sm text-zinc-500 md:block">
                          {formatDate(item.modified)}
                        </span>
                        <span className="hidden text-right text-sm text-zinc-500 md:block">
                          {item.size || "-"}
                        </span>

                        <div className="col-span-2 flex flex-wrap justify-end gap-2 md:col-span-1">
                          {item.type === "folder" ? (
                            <button
                              type="button"
                              onClick={() => openFolder(item)}
                              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
                            >
                              Open
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => previewItem(item)}
                                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
                              >
                                <Eye className="h-4 w-4" />
                                Preview
                              </button>
                              <ItemActionMenu item={item} onPreview={previewItem} onCopy={copyLink} />
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((item) => {
                  const Icon = iconFor(item.type);
                  const isChecked = selectedPaths.has(item.path);
                  const isPreviewed = selected?.path === item.path;

                  return (
                    <div
                      key={item.path}
                      className={`rounded-lg border p-3 transition ${
                        isPreviewed
                          ? "border-[#d7ff3f]/40 bg-[#d7ff3f]/10"
                          : "border-white/10 bg-black/20 hover:border-white/20"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSelect(item.path)}
                          title={isChecked ? "Unselect" : "Select"}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
                        >
                          {isChecked ? <CheckSquare className="h-5 w-5 text-[#d7ff3f]" /> : <Square className="h-5 w-5" />}
                        </button>
                        {item.type === "folder" ? (
                          <button
                            type="button"
                            onClick={() => openFolder(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10 hover:text-white"
                          >
                            Open
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        ) : (
                          <ItemActionMenu item={item} onPreview={previewItem} onCopy={copyLink} />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => (item.type === "folder" ? openFolder(item) : previewItem(item))}
                        className="flex w-full flex-col items-start text-left"
                      >
                        <span
                          className={`mb-3 flex h-12 w-12 items-center justify-center rounded-lg border ${
                            item.type === "folder"
                              ? "border-[#d7ff3f]/20 bg-[#d7ff3f]/10 text-[#d7ff3f]"
                              : "border-white/10 bg-black/20 text-zinc-400"
                          }`}
                        >
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className="line-clamp-2 min-h-10 text-sm font-medium text-white">
                          {item.name}
                        </span>
                        <span className="mt-2 text-xs text-zinc-500">
                          {typeLabel(item)} - {item.size || "Folder"}
                        </span>
                        <span className="mt-1 text-xs text-zinc-500">
                          {item.type === "folder" ? "Open folder" : downloadModeLabel(item)}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-auto">
          {!selected ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
              <File className="h-9 w-9 text-zinc-600" />
              <p className="text-sm text-zinc-400">Pilih file untuk melihat detail.</p>
              {copyMessage ? <p className="text-xs text-[#d7ff3f]">{copyMessage}</p> : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#d7ff3f]">DETAIL</p>
                  <h2 className="mt-2 break-words text-xl font-semibold text-white">{selected.name}</h2>
                  <p className="mt-2 text-xs text-zinc-500">{downloadModeLabel(selected)}</p>
                </div>
                {(() => {
                  const Icon = iconFor(selected.type);
                  return (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-zinc-300">
                      <Icon className="h-5 w-5" />
                    </div>
                  );
                })()}
              </div>

              {selected.type === "video" && selected.thumbnailUrl ? (
                <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
                  <Image
                    src={selected.thumbnailUrl}
                    alt={`${selected.name} thumbnail`}
                    width={960}
                    height={540}
                    unoptimized
                    className="max-h-52 w-full object-cover"
                  />
                </div>
              ) : null}

              <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
                {selected.type === "image" ? (
                  <Image
                    src={fileUrl(selected.path)}
                    alt={selected.name}
                    width={1200}
                    height={800}
                    unoptimized
                    className="max-h-[430px] w-full object-contain"
                  />
                ) : null}

                {selected.type === "video" ? (
                  selectedVideoPreviewUrl ? (
                    <video
                      src={selectedVideoPreviewUrl}
                      poster={selected.thumbnailUrl || undefined}
                      controls
                      playsInline
                      preload="metadata"
                      className="max-h-[430px] w-full bg-black"
                    />
                  ) : (
                    <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-4 text-center">
                      <FileVideo className="h-11 w-11 text-zinc-500" />
                      <div>
                        <p className="text-sm font-medium text-white">
                          Preview cache not generated yet.
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Original file can still be downloaded.
                        </p>
                      </div>
                    </div>
                  )
                ) : null}

                {selected.type === "pdf" ? (
                  <iframe
                    src={fileUrl(selected.path)}
                    title={selected.name}
                    className="h-[430px] w-full bg-white"
                  />
                ) : null}

                {selected.type === "text" ? (
                  <div className="max-h-[430px] min-h-72 overflow-auto bg-[#050608] p-4">
                    {previewLoading ? (
                      <div className="flex h-56 items-center justify-center gap-2 text-sm text-zinc-400">
                        <Loader2 className="h-4 w-4 animate-spin text-[#d7ff3f]" />
                        Loading text preview...
                      </div>
                    ) : previewError ? (
                      <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-sm text-amber-200">
                        <AlertTriangle className="h-6 w-6" />
                        {previewError}
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-zinc-200">
                        {previewText}
                      </pre>
                    )}
                  </div>
                ) : null}

                {!selected.canPreview && selected.type !== "video" ? (
                  <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-4 text-center">
                    {(() => {
                      const Icon = iconFor(selected.type);
                      return <Icon className="h-11 w-11 text-zinc-500" />;
                    })()}
                    <div>
                      <p className="text-sm font-medium text-white">Preview unavailable</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {typeLabel(selected)} - {selected.size || "Unknown size"}
                      </p>
                    </div>
                    {selected.directDownloadUrl ? (
                      <a
                        href={selected.directDownloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black transition hover:bg-[#c7f02f]"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {selected.isLargeFile ? (
                <p className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
                  Large file. Download will use direct server route for better speed.
                </p>
              ) : null}

              {selected.type === "video" ? (
                <div className="space-y-2">
                  {(() => {
                    const badge = videoPreviewBadge(selected);

                    return (
                      <span
                        className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    );
                  })()}
                  <p className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
                    If preview does not play, this codec needs generated preview cache.
                  </p>
                </div>
              ) : null}

              {selected.type === "text" && previewTruncated ? (
                <p className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-400">
                  Text preview dipotong di 256 KB.
                </p>
              ) : null}

              <div className="rounded-lg border border-white/10 bg-black/20 px-4">
                <DetailRow label="Nama" value={selected.name} />
                <DetailRow label="Tipe" value={typeLabel(selected)} />
                <DetailRow label="Ukuran" value={selected.size || "-"} />
                <DetailRow label="Modified" value={formatDate(selected.modified)} />
                <DetailRow label="Preview status" value={previewStatusLabel(selected)} />
                <DetailRow label="Download mode" value={downloadModeLabel(selected)} />
              </div>

              <div className="grid gap-2">
                {selected.directDownloadUrl ? (
                  <a
                    href={selected.directDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-3 font-semibold text-black transition hover:bg-[#c7f02f]"
                  >
                    <Download className="h-4 w-4" />
                    Download Original
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => void copyLink(selected)}
                  disabled={!selected.directDownloadUrl}
                  className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Copy className="h-4 w-4" />
                  Copy Direct Link
                </button>
                {copyMessage ? <p className="text-center text-xs text-[#d7ff3f]">{copyMessage}</p> : null}
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function ItemActionMenu({
  item,
  onPreview,
  onCopy,
}: {
  item: DriveItem;
  onPreview: (item: DriveItem) => void;
  onCopy: (item: DriveItem) => Promise<void>;
}) {
  return (
    <details className="relative">
      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/10 hover:text-white">
        <MoreVertical className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-48 rounded-lg border border-white/10 bg-[#101217] p-1 shadow-2xl">
        <button
          type="button"
          onClick={() => onPreview(item)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
        >
          <Eye className="h-4 w-4" />
          Preview
        </button>
        {item.directDownloadUrl ? (
          <a
            href={item.directDownloadUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
            Download Original
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => void onCopy(item)}
          disabled={!item.directDownloadUrl}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Copy className="h-4 w-4" />
          Copy Link
        </button>
      </div>
    </details>
  );
}
