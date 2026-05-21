"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  File,
  Folder,
  HardDrive,
  Home,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Search,
  Share2,
  Upload,
  User,
  X,
} from "lucide-react";
import { EmailChipsInput } from "@/components/common/email-chips-input";
import {
  FileThumbnail,
  formatBytes,
  PreviewModal,
  PreviewStatusBadge,
  type DriveItem,
  type ViewMode,
  ViewToggle,
  typeLabel,
} from "@/components/drive/drive-ui";

type ShareResult = {
  url: string;
  token: string;
  permission: string;
  expiresAt: string | null;
  allowedEmails: string[];
  failedEmails: string[];
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/drive", label: "My Drive", icon: HardDrive, active: true },
  { href: "/dashboard#shared", label: "Shared with Me", icon: Share2 },
  { href: "/dashboard#account", label: "Account", icon: User },
];

export function UserDriveClient({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<DriveItem[]>([]);
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<DriveItem | null>(null);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const load = useCallback(async (nextPath: string) => {
    setLoading(true);
    setNotice("");

    const res = await fetch(`/api/user/files/list?path=${encodeURIComponent(nextPath)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));

    setLoading(false);

    if (res.ok && data.ok) {
      setItems(data.items || []);
      setPath(data.path || "");
      return;
    }

    setNotice(data.message || "Failed to load drive.");
  }, []);

  async function upload(files: FileList | null) {
    if (!files?.length || uploading) return;

    const form = new FormData();
    form.set("path", path);
    Array.from(files).forEach((file) => form.append("files", file));

    setUploading(true);
    setProgress(0);
    setNotice("");

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();

      xhr.open("POST", "/api/files/upload");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        const data = JSON.parse(xhr.responseText || "{}");
        setNotice(xhr.status >= 400 || !data.ok ? data.message || "Upload failed." : "Upload complete.");
        resolve();
      };

      xhr.onerror = () => {
        setNotice("Upload failed.");
        resolve();
      };

      xhr.send(form);
    });

    setUploading(false);
    setProgress(100);
    await load(path);
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/";
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(""), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const breadcrumbs = path.split("/").filter(Boolean);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => item.name.toLowerCase().includes(keyword));
  }, [items, query]);

  const usedBytesDisplayed = filteredItems.reduce((total, item) => total + (item.type === "folder" ? 0 : item.bytes || 0), 0);

  if (embedded) {
    return (
      <>
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search files..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
              />
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black transition hover:bg-[#c8ef34]">
              <Upload className="h-4 w-4" />
              Upload
              <input
                type="file"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(event) => void upload(event.target.files)}
              />
            </label>
          </div>

          <section className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
              <p className="text-sm text-zinc-500">Current folder</p>
              <p className="mt-2 truncate text-lg font-black text-white">{path || "Home"}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
              <p className="text-sm text-zinc-500">Items shown</p>
              <p className="mt-2 text-lg font-black text-white">{filteredItems.length}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
              <p className="text-sm text-zinc-500">Displayed size</p>
              <p className="mt-2 text-lg font-black text-white">{formatBytes(usedBytesDisplayed)}</p>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <nav className="flex flex-wrap items-center gap-1 text-sm">
                <button
                  onClick={() => void load("")}
                  className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 font-bold text-white hover:bg-white/10"
                >
                  <Home className="h-4 w-4 text-[#d7ff3f]" />
                  Home
                </button>
                {breadcrumbs.map((crumb, index) => (
                  <div key={`${crumb}-${index}`} className="flex items-center gap-1">
                    <ChevronRight className="h-4 w-4 text-zinc-600" />
                    <button
                      onClick={() => void load(breadcrumbs.slice(0, index + 1).join("/"))}
                      className="max-w-[160px] truncate rounded-2xl px-3 py-2 text-zinc-300 hover:bg-white/10"
                    >
                      {crumb}
                    </button>
                  </div>
                ))}
              </nav>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">Login protected</span>
                <span className="rounded-xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-3 py-2 text-[#d7ff3f]">1 GB Free</span>
              </div>
            </div>
          </section>

          {notice ? (
            <div className="rounded-2xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-4 py-3 text-sm font-medium text-[#d7ff3f]">
              {notice}
            </div>
          ) : null}

          <FileList
            loading={loading}
            filteredItems={filteredItems}
            viewMode={viewMode}
            setViewMode={setViewMode}
            load={load}
            setPreviewItem={setPreviewItem}
            setShareTarget={(item) => {
              setShareTarget(item);
              setShareResult(null);
            }}
          />
        </div>

        <UserShareModal
          item={shareTarget}
          result={shareResult}
          onClose={() => {
            setShareTarget(null);
            setShareResult(null);
          }}
          onCreated={(result) => setShareResult(result)}
          onNotice={setNotice}
        />

        <PreviewModal
          item={previewItem}
          open={previewItem !== null}
          canDownload
          onClose={() => setPreviewItem(null)}
          onCopy={(text) => {
            void navigator.clipboard.writeText(text).catch(() => undefined);
            setNotice("Link copied.");
          }}
          onShare={(itemPath) => {
            const item = items.find((candidate) => candidate.path === itemPath) || null;
            setPreviewItem(null);
            setShareTarget(item);
            setShareResult(null);
          }}
        />

        {uploading ? (
          <UploadProgress progress={progress} />
        ) : null}
      </>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      {sidebarOpen ? (
        <button
          aria-label="Close sidebar overlay"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[290px] flex-col border-r border-white/10 bg-[#0b0c10]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#d7ff3f] text-black shadow-[0_0_35px_rgba(215,255,63,0.18)]">
              <HardDrive className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black tracking-tight text-white">driveOne</p>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#d7ff3f]">by VJMRTIM</p>
            </div>
          </Link>

          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
            />
          </div>
        </div>

        <nav className="mt-5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${
                  item.active
                    ? "bg-[#d7ff3f] text-black shadow-[0_0_28px_rgba(215,255,63,0.12)]"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Free Plan</p>
              <BarChart3 className="h-4 w-4 text-[#d7ff3f]" />
            </div>
            <p className="mt-1 text-xs text-zinc-500">Default storage quota: 1 GB</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[8%] rounded-full bg-[#d7ff3f]" />
            </div>
            <p className="mt-2 text-xs text-zinc-500">Upgrade plans coming soon.</p>
          </div>

          <button
            onClick={() => void logout()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <section className="min-h-screen lg:pl-[290px]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08090d]/90 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-2xl border border-white/10 p-2 text-zinc-300 hover:bg-white/10 lg:hidden"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d7ff3f]">User Drive</p>
                <h1 className="truncate text-xl font-black tracking-tight text-white md:text-2xl">My Drive</h1>
              </div>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black transition hover:bg-[#c8ef34]">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload</span>
              <input
                type="file"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(event) => void upload(event.target.files)}
              />
            </label>
          </div>
        </header>

        <div className="p-4 md:p-6">
          <div className="mx-auto max-w-7xl space-y-5">
            <section className="grid gap-3 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
                <p className="text-sm text-zinc-500">Current folder</p>
                <p className="mt-2 truncate text-lg font-black text-white">{path || "Home"}</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
                <p className="text-sm text-zinc-500">Items shown</p>
                <p className="mt-2 text-lg font-black text-white">{filteredItems.length}</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
                <p className="text-sm text-zinc-500">Displayed size</p>
                <p className="mt-2 text-lg font-black text-white">{formatBytes(usedBytesDisplayed)}</p>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <nav className="flex flex-wrap items-center gap-1 text-sm">
                  <button
                    onClick={() => void load("")}
                    className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 font-bold text-white hover:bg-white/10"
                  >
                    <Home className="h-4 w-4 text-[#d7ff3f]" />
                    Home
                  </button>

                  {breadcrumbs.map((crumb, index) => (
                    <div key={`${crumb}-${index}`} className="flex items-center gap-1">
                      <ChevronRight className="h-4 w-4 text-zinc-600" />
                      <button
                        onClick={() => void load(breadcrumbs.slice(0, index + 1).join("/"))}
                        className="max-w-[160px] truncate rounded-2xl px-3 py-2 text-zinc-300 hover:bg-white/10"
                      >
                        {crumb}
                      </button>
                    </div>
                  ))}
                </nav>

                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                    Login protected
                  </span>
                  <span className="rounded-xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-3 py-2 text-[#d7ff3f]">
                    1 GB Free
                  </span>
                </div>
              </div>
            </section>

            {notice ? (
              <div className="rounded-2xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-4 py-3 text-sm font-medium text-[#d7ff3f]">
                {notice}
              </div>
            ) : null}

            <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-3 border-b border-white/10 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-black text-white">Files</p>
                  <p className="mt-1 text-xs text-zinc-500">Open, preview, download, or share your own files.</p>
                </div>
                <ViewToggle value={viewMode} onChange={setViewMode} />
              </div>
              {loading ? (
                <div className="flex h-72 items-center justify-center gap-2 text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />
                  Loading drive...
                </div>
              ) : null}

              {!loading && filteredItems.length === 0 ? (
                <div className="flex h-72 flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] text-[#d7ff3f]">
                    <HardDrive className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="font-bold text-white">No files here</p>
                    <p className="mt-1 text-sm text-zinc-500">Upload your first file to this folder.</p>
                  </div>
                </div>
              ) : null}

              {!loading && filteredItems.length > 0 ? (
                <div className={viewMode === "grid" ? "grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3" : "divide-y divide-white/10"}>
                  {filteredItems.map((item) => (
                    <div
                      key={item.path}
                      className={viewMode === "grid"
                        ? "rounded-3xl border border-white/10 bg-black/20 p-3 transition hover:bg-white/[0.05]"
                        : "grid w-full grid-cols-[42px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04] md:grid-cols-[42px_minmax(0,1fr)_120px_120px_250px]"}
                    >
                      <FileThumbnail item={item} size={viewMode === "grid" ? "grid" : "row"} />

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{item.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span>{typeLabel(item)}</span>
                          <PreviewStatusBadge item={item} />
                        </div>
                      </div>

                      <span className={viewMode === "grid" ? "mt-3 block text-xs text-zinc-500" : "hidden text-xs text-zinc-500 md:block"}>
                        {item.size || formatBytes(item.bytes || 0)}
                      </span>

                      <span className={viewMode === "grid" ? "mt-3 block text-xs text-zinc-600" : "hidden text-xs text-zinc-600 md:block"}>
                        {new Date(item.modified).toLocaleString("id-ID")}
                      </span>

                      <div className={viewMode === "grid" ? "mt-4 flex flex-wrap gap-2" : "col-span-2 flex flex-wrap gap-2 md:col-span-1 md:justify-end"}>
                        <button
                          onClick={() => (item.type === "folder" ? void load(item.path) : setPreviewItem(item))}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white"
                        >
                          {item.type === "folder" ? <Folder className="h-4 w-4" /> : <File className="h-4 w-4" />}
                          {item.type === "folder" ? "Open" : "Preview"}
                        </button>
                        {item.directDownloadUrl ? (
                          <a href={item.directDownloadUrl} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white">
                            <Download className="h-4 w-4" />
                            Download
                          </a>
                        ) : null}
                        <button
                          onClick={() => {
                            setShareTarget(item);
                            setShareResult(null);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d7ff3f] px-3 py-2 text-xs font-black text-black hover:bg-[#c8ef34]"
                        >
                          <Share2 className="h-4 w-4" />
                          Share
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </section>

      <UserShareModal
        item={shareTarget}
        result={shareResult}
        onClose={() => {
          setShareTarget(null);
          setShareResult(null);
        }}
        onCreated={(result) => setShareResult(result)}
        onNotice={setNotice}
      />

      <PreviewModal
        item={previewItem}
        open={previewItem !== null}
        canDownload
        onClose={() => setPreviewItem(null)}
        onCopy={(text) => {
          void navigator.clipboard.writeText(text).catch(() => undefined);
          setNotice("Link copied.");
        }}
        onShare={(itemPath) => {
          const item = items.find((candidate) => candidate.path === itemPath) || null;
          setPreviewItem(null);
          setShareTarget(item);
          setShareResult(null);
        }}
      />

      {uploading ? (
        <div className="fixed inset-x-3 bottom-3 z-[70] rounded-3xl border border-white/10 bg-[#101217]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur md:left-auto md:right-6 md:w-96">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-white">Uploading files</p>
              <p className="mt-1 text-xs text-zinc-500">Please keep this page open.</p>
            </div>
            <span className="text-sm font-black text-[#d7ff3f]">{progress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#d7ff3f] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function FileList({
  loading,
  filteredItems,
  viewMode,
  setViewMode,
  load,
  setPreviewItem,
  setShareTarget,
}: {
  loading: boolean;
  filteredItems: DriveItem[];
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
  load: (path: string) => Promise<void>;
  setPreviewItem: (item: DriveItem) => void;
  setShareTarget: (item: DriveItem) => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-3 border-b border-white/10 p-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black text-white">Files</p>
          <p className="mt-1 text-xs text-zinc-500">Open, preview, download, or share your own files.</p>
        </div>
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>
      {loading ? (
        <div className="flex h-72 items-center justify-center gap-2 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />
          Loading drive...
        </div>
      ) : null}

      {!loading && filteredItems.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] text-[#d7ff3f]">
            <HardDrive className="h-7 w-7" />
          </div>
          <div>
            <p className="font-bold text-white">No files here</p>
            <p className="mt-1 text-sm text-zinc-500">Upload your first file to this folder.</p>
          </div>
        </div>
      ) : null}

      {!loading && filteredItems.length > 0 ? (
        <div className={viewMode === "grid" ? "grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3" : "divide-y divide-white/10"}>
          {filteredItems.map((item) => (
            <div
              key={item.path}
              className={viewMode === "grid"
                ? "rounded-3xl border border-white/10 bg-black/20 p-3 transition hover:bg-white/[0.05]"
                : "grid w-full grid-cols-[42px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04] md:grid-cols-[42px_minmax(0,1fr)_120px_120px_250px]"}
            >
              <FileThumbnail item={item} size={viewMode === "grid" ? "grid" : "row"} />

              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{item.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span>{typeLabel(item)}</span>
                  <PreviewStatusBadge item={item} />
                </div>
              </div>

              <span className={viewMode === "grid" ? "mt-3 block text-xs text-zinc-500" : "hidden text-xs text-zinc-500 md:block"}>
                {item.size || formatBytes(item.bytes || 0)}
              </span>

              <span className={viewMode === "grid" ? "mt-3 block text-xs text-zinc-600" : "hidden text-xs text-zinc-600 md:block"}>
                {new Date(item.modified).toLocaleString("id-ID")}
              </span>

              <div className={viewMode === "grid" ? "mt-4 flex flex-wrap gap-2" : "col-span-2 flex flex-wrap gap-2 md:col-span-1 md:justify-end"}>
                <button
                  onClick={() => (item.type === "folder" ? void load(item.path) : setPreviewItem(item))}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white"
                >
                  {item.type === "folder" ? <Folder className="h-4 w-4" /> : <File className="h-4 w-4" />}
                  {item.type === "folder" ? "Open" : "Preview"}
                </button>
                {item.directDownloadUrl ? (
                  <a href={item.directDownloadUrl} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white">
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                ) : null}
                <button
                  onClick={() => setShareTarget(item)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d7ff3f] px-3 py-2 text-xs font-black text-black hover:bg-[#c8ef34]"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function UploadProgress({ progress }: { progress: number }) {
  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] rounded-3xl border border-white/10 bg-[#101217]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur md:left-auto md:right-6 md:w-96">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">Uploading files</p>
          <p className="mt-1 text-xs text-zinc-500">Please keep this page open.</p>
        </div>
        <span className="text-sm font-black text-[#d7ff3f]">{progress}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#d7ff3f] transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function UserShareModal({
  item,
  result,
  onClose,
  onCreated,
  onNotice,
}: {
  item: DriveItem | null;
  result: ShareResult | null;
  onClose: () => void;
  onCreated: (result: ShareResult) => void;
  onNotice: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [permission, setPermission] = useState<"VIEW_ONLY" | "DOWNLOAD">("DOWNLOAD");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE_EMAILS">("PUBLIC");
  const [emails, setEmails] = useState<string[]>([]);
  const [expiry, setExpiry] = useState<"never" | "1d" | "7d" | "30d" | "custom">("never");
  const [customDate, setCustomDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!item) return null;
  const activeItem = item;

  function getExpiresAt() {
    if (expiry === "never") return null;
    if (expiry === "custom") return customDate ? new Date(customDate).toISOString() : null;
    const days = expiry === "1d" ? 1 : expiry === "7d" ? 7 : 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  async function createShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/user/share", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rootPath: activeItem.path,
        title: title.trim() || activeItem.name,
        permission,
        visibility,
        allowedEmails: emails,
        expiresAt: getExpiresAt(),
        note,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok || !data.ok) {
      setError(data.message || "Create share failed.");
      return;
    }

    const url = `${window.location.origin}${data.url}`;
    onCreated({
      url,
      token: data.token,
      permission,
      expiresAt: getExpiresAt(),
      allowedEmails: emails,
      failedEmails: data.invite?.failed || [],
    });
    onNotice(data.invite?.failed?.length ? "Share created, but some invites failed." : "Share link created.");
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-black/70 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-4">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-3xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:max-w-xl md:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff3f]">Share from My Drive</p>
            <h2 className="mt-2 text-xl font-black text-white">{activeItem.name}</h2>
            <p className="mt-1 truncate text-sm text-zinc-500">{activeItem.path}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close share modal">
            <X className="h-5 w-5" />
          </button>
        </div>

        {result ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-3xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 p-4">
              <p className="font-black text-[#d7ff3f]">Share link ready</p>
              <p className="mt-3 break-all rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-zinc-100">{result.url}</p>
              <div className="mt-3 grid gap-2 text-xs text-zinc-300 sm:grid-cols-3">
                <span>{result.permission}</span>
                <span>{result.expiresAt ? new Date(result.expiresAt).toLocaleString("id-ID") : "Never expires"}</span>
                <span>{result.allowedEmails.length ? result.allowedEmails.join(", ") : "Public login"}</span>
              </div>
              {result.failedEmails.length ? <p className="mt-3 text-xs font-semibold text-amber-300">Invite failed: {result.failedEmails.join(", ")}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void navigator.clipboard.writeText(result.url)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10">
                <Copy className="h-4 w-4" />
                Copy
              </button>
              <a href={result.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#d7ff3f] px-3 py-2 text-sm font-black text-black">
                <ExternalLink className="h-4 w-4" />
                Open
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={createShare} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm text-zinc-300">Share title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={activeItem.name} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50" />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setPermission("VIEW_ONLY")} className={`rounded-2xl border p-3 text-left ${permission === "VIEW_ONLY" ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <p className="font-bold text-white">View only</p>
                <p className="mt-1 text-xs text-zinc-500">Preview without download.</p>
              </button>
              <button type="button" onClick={() => setPermission("DOWNLOAD")} className={`rounded-2xl border p-3 text-left ${permission === "DOWNLOAD" ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <Download className="h-4 w-4 text-[#d7ff3f]" />
                <p className="mt-2 font-bold text-white">View + Download</p>
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setVisibility("PUBLIC")} className={`rounded-2xl border p-3 text-left ${visibility === "PUBLIC" ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <p className="font-bold text-white">Public login</p>
                <p className="mt-1 text-xs text-zinc-500">Any logged-in user can open.</p>
              </button>
              <button type="button" onClick={() => setVisibility("PRIVATE_EMAILS")} className={`rounded-2xl border p-3 text-left ${visibility === "PRIVATE_EMAILS" ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <p className="font-bold text-white">Private emails</p>
                <p className="mt-1 text-xs text-zinc-500">Only allowed emails can open.</p>
              </button>
            </div>

            {visibility === "PRIVATE_EMAILS" ? <EmailChipsInput value={emails} onChange={setEmails} placeholder="client@example.com, team@example.com" disabled={submitting} /> : null}

            <div>
              <p className="text-sm text-zinc-300">Expiry</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ["never", "Never"],
                  ["1d", "1 day"],
                  ["7d", "7 days"],
                  ["30d", "30 days"],
                  ["custom", "Custom"],
                ].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setExpiry(value as typeof expiry)} className={`rounded-xl border px-3 py-2 text-sm ${expiry === value ? "border-[#d7ff3f] bg-[#d7ff3f]/10 text-white" : "border-white/10 text-zinc-400"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {expiry === "custom" ? (
                <label className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                  <CalendarClock className="h-4 w-4 text-zinc-500" />
                  <input type="datetime-local" value={customDate} onChange={(event) => setCustomDate(event.target.value)} className="w-full bg-transparent text-sm outline-none" />
                </label>
              ) : null}
            </div>

            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Optional note..." className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-[#d7ff3f]/50" />
            {error ? <p className="rounded-2xl border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
            <button disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              {submitting ? "Generating..." : "Generate Link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
