"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
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
  FolderPlus,
  Grid2X2,
  HardDrive,
  Home,
  Link,
  List,
  Loader2,
  LogOut,
  MoreVertical,
  MoveRight,
  RotateCw,
  Search,
  Settings,
  Share2,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type DriveItemType = "folder" | "image" | "video" | "pdf" | "text" | "archive" | "file";
type PreviewStatus = "native" | "ready" | "missing" | "unsupported" | "queued" | "processing" | "failed";
type ViewMode = "list" | "grid";
type AppView = "dashboard" | "drive" | "queue" | "shares" | "storage" | "settings";

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

type StorageData = {
  assetRoot: { label: string; total: string; used: string; free: string };
  cacheRoot: { label: string; used: string; path: string };
  counts: {
    currentFolderItems: number;
    previewReady: number;
    previewMissing: number;
    previewFailed: number;
  };
};

type QueueItem = {
  id: string;
  path: string;
  status: "queued" | "processing" | "ready" | "failed";
  message: string;
  createdAt: string;
  updatedAt: string;
};

type ShareLink = {
  token: string;
  name: string;
  rootPath: string;
  canDownload: boolean;
  expiresAt: string | null;
  createdAt: string;
};

const TEXT_PREVIEW_LIMIT = 256 * 1024;

function fileUrl(filePath: string, download = false) {
  const params = new URLSearchParams({ path: filePath });
  if (download) params.set("download", "1");
  return `/api/file?${params.toString()}`;
}

function DriveIcon({ type, className }: { type: DriveItemType; className: string }) {
  if (type === "folder") return <Folder className={className} />;
  if (type === "video") return <FileVideo className={className} />;
  if (type === "image") return <FileImage className={className} />;
  if (type === "archive") return <FileArchive className={className} />;
  if (type === "pdf" || type === "text") return <FileText className={className} />;
  return <File className={className} />;
}

function typeLabel(item: DriveItem) {
  if (item.type === "folder") return "Folder";
  if (item.type === "pdf") return "PDF";
  if (item.extension) return item.extension.toUpperCase();
  return "File";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function previewStatusLabel(item: DriveItem) {
  if (item.type === "folder") return "Folder";
  if (item.type === "video" && item.previewStatus === "ready") return "Cached";
  if (item.type === "video" && item.previewStatus === "native") return "Native";
  if (item.type === "video" && item.previewStatus === "queued") return "Queued";
  if (item.type === "video" && item.previewStatus === "processing") return "Processing";
  if (item.type === "video" && item.previewStatus === "failed") return "Failed";
  if (item.type === "video" && item.previewStatus === "missing") return "Missing";
  return item.canPreview ? "Native" : "Unsupported";
}

function downloadModeLabel(item: DriveItem) {
  return item.downloadMode === "direct" ? "Direct" : "App";
}

function badgeClass(kind: "ok" | "warn" | "muted") {
  if (kind === "ok") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (kind === "warn") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function previewBadgeClass(status: PreviewStatus) {
  if (status === "ready" || status === "native") return badgeClass("ok");
  if (status === "missing" || status === "failed") return badgeClass("warn");
  return badgeClass("muted");
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
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [authState, setAuthState] = useState<"checking" | "guest" | "admin">("checking");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState<DriveItem[]>([]);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<DriveItem | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [shares, setShares] = useState<ShareLink[]>([]);

  function clearPreview() {
    setPreviewText("");
    setPreviewError("");
    setPreviewLoading(false);
  }

  function clearSelection() {
    setSelectedPaths(new Set());
  }

  const loadDrive = useCallback(async (path: string) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/list?path=${encodeURIComponent(path)}`, { cache: "no-store" });
      if (res.status === 401) {
        setAuthState("guest");
        return false;
      }

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Folder tidak bisa dibuka.");

      setAuthState("admin");
      setCurrentPath(data.path || "");
      setItems(data.items || []);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Folder tidak bisa dibuka.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStorage = useCallback(async (path: string) => {
    const res = await fetch(`/api/admin/storage?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    if (res.ok) setStorage(await res.json());
  }, []);

  const loadQueue = useCallback(async () => {
    const res = await fetch("/api/admin/preview/queue", { cache: "no-store" });
    if (res.ok) setQueue((await res.json()).queue || []);
  }, []);

  const loadShares = useCallback(async () => {
    const res = await fetch("/api/admin/shares", { cache: "no-store" });
    if (res.ok) setShares((await res.json()).links || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDrive("");
      void loadStorage("");
      void loadQueue();
      void loadShares();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDrive, loadQueue, loadShares, loadStorage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeView === "dashboard" || activeView === "storage") void loadStorage(currentPath);
      if (activeView === "queue") void loadQueue();
      if (activeView === "shares") void loadShares();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeView, currentPath, loadQueue, loadShares, loadStorage]);

  useEffect(() => {
    if (!selected || selected.type !== "text") return;

    const item = selected;
    const controller = new AbortController();
    const headers = new Headers();
    if (item.bytes > TEXT_PREVIEW_LIMIT) headers.set("Range", `bytes=0-${TEXT_PREVIEW_LIMIT - 1}`);

    async function loadText() {
      try {
        const res = await fetch(fileUrl(item.path), { cache: "no-store", headers, signal: controller.signal });
        if (!res.ok && res.status !== 206) throw new Error("Text preview gagal dimuat.");
        setPreviewText(await res.text());
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setPreviewError(caught instanceof Error ? caught.message : "Text preview gagal dimuat.");
      } finally {
        setPreviewLoading(false);
      }
    }

    void loadText();
    return () => controller.abort();
  }, [selected]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError("");

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
    setAuthState("admin");
    setActiveView("dashboard");
    await loadDrive("");
    await loadStorage("");
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setAuthState("guest");
    setItems([]);
    setSelected(null);
    clearSelection();
  }

  function openFolder(item: DriveItem) {
    setSelected(null);
    clearPreview();
    clearSelection();
    setQuery("");
    setActiveView("drive");
    void loadDrive(item.path);
  }

  function previewItem(item: DriveItem) {
    if (item.type === "folder") {
      openFolder(item);
      return;
    }
    clearPreview();
    setPreviewLoading(item.type === "text");
    setSelected(item);
  }

  function goBreadcrumb(index: number) {
    const segments = currentPath.split("/").filter(Boolean);
    const targetPath = index < 0 ? "" : segments.slice(0, index + 1).join("/");
    setSelected(null);
    clearPreview();
    clearSelection();
    void loadDrive(targetPath);
  }

  function toggleSelect(path: string) {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setNotice("Link copied.");
  }

  async function adminJson(url: string, method: string, body: unknown) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.message || "Action failed");
    return data;
  }

  async function createFolderAction() {
    const name = window.prompt("Folder name");
    if (!name) return;
    await adminJson("/api/admin/folder", "POST", { path: currentPath, name });
    setNotice("Folder created.");
    await loadDrive(currentPath);
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    form.set("path", currentPath);
    Array.from(files).forEach((file) => form.append("files", file));
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    if (!res.ok) setNotice("Upload failed.");
    else setNotice("Upload complete.");
    await loadDrive(currentPath);
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  async function renameAction(item: DriveItem) {
    const newName = window.prompt("New name", item.name);
    if (!newName || newName === item.name) return;
    await adminJson("/api/admin/rename", "POST", { path: item.path, newName });
    setNotice("Renamed.");
    await loadDrive(currentPath);
  }

  async function moveSelectedAction() {
    const paths = Array.from(selectedPaths);
    if (!paths.length) return;
    const targetFolder = window.prompt("Move to folder path, relative to PublicShare", currentPath);
    if (targetFolder === null) return;
    await adminJson("/api/admin/move", "POST", { paths, targetFolder });
    setNotice("Moved.");
    clearSelection();
    await loadDrive(currentPath);
  }

  async function deleteSelectedAction(paths = Array.from(selectedPaths)) {
    if (!paths.length) return;
    if (!window.confirm("Move selected item(s) to soft trash?")) return;
    await adminJson("/api/admin/delete", "DELETE", { paths });
    setNotice("Moved to soft trash.");
    clearSelection();
    setSelected(null);
    await loadDrive(currentPath);
  }

  async function createShareAction(rootPath: string) {
    const name = window.prompt("Share name / client name", "Client");
    if (!name) return;
    const data = await adminJson("/api/admin/share", "POST", {
      rootPath,
      name,
      canDownload: true,
      expiresAt: null,
    });
    setNotice(`Share created: ${data.url}`);
    await copyText(`${window.location.origin}${data.url}`);
    await loadShares();
  }

  async function requestPreviewAction(paths: string[]) {
    const data = await adminJson("/api/admin/preview/request", "POST", { paths });
    setNotice(`${data.added} preview request(s) queued.`);
    await loadQueue();
    await loadDrive(currentPath);
  }

  async function scanCurrentFolderAction() {
    const videoPaths = items
      .filter((item) => item.type === "video")
      .filter((item) => item.previewStatus === "missing" || item.previewStatus === "failed")
      .map((item) => item.path);

    if (!videoPaths.length) {
      setNotice("No missing video previews in current folder.");
      return;
    }

    await requestPreviewAction(videoPaths);
  }

  const filtered = query.trim()
    ? items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase().trim()))
    : items;
  const selectedItems = items.filter((item) => selectedPaths.has(item.path));

  function downloadSelectedAction() {
    const folders = selectedItems.filter((item) => item.type === "folder");
    const files = selectedItems.filter((item) => item.type !== "folder" && item.directDownloadUrl);

    if (folders.length) {
      window.alert("Folder download as ZIP can be slow for huge folders. Open folder and download files directly.");
    }

    if (!files.length) {
      setNotice("No downloadable files selected.");
      return;
    }

    files.forEach((item, index) => {
      window.setTimeout(() => {
        window.open(item.directDownloadUrl || "", "_blank", "noopener,noreferrer");
      }, index * 150);
    });

    setNotice(`Opening ${files.length} download link(s).`);
  }

  const displayedBytes = filtered.reduce((total, item) => total + (item.type === "folder" ? 0 : item.bytes), 0);
  const breadcrumbs = currentPath.split("/").filter(Boolean);
  const selectedVideoPreviewUrl =
    selected?.type === "video" && selected.previewStatus === "ready"
      ? selected.previewUrl
      : selected?.type === "video" && selected.previewStatus === "native"
        ? selected.previewUrl || selected.originalUrl
        : null;

  if (authState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08090d] text-zinc-100">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#d7ff3f]" />
        Checking session...
      </main>
    );
  }

  if (authState !== "admin") {
    return (
      <main className="min-h-screen bg-[#08090d] text-zinc-100">
        <section className="mx-auto flex min-h-screen max-w-5xl items-center px-5">
          <div className="grid w-full gap-8 md:grid-cols-[1fr_380px] md:items-center">
            <div>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#d7ff3f] text-black">
                <HardDrive className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-[#d7ff3f]">VJMRTIM</p>
              <h1 className="mt-2 text-4xl font-semibold text-white md:text-6xl">Asset Drive</h1>
              <p className="mt-4 max-w-lg text-zinc-400">Private asset management for preview, sharing, and file organization.</p>
            </div>
            <form onSubmit={login} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-xl font-semibold text-white">Admin Login</h2>
              <label className="mt-5 block text-sm text-zinc-300" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-[#d7ff3f]"
                autoComplete="current-password"
              />
              {loginError ? <p className="mt-3 text-sm text-red-200">{loginError}</p> : null}
              <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-3 font-semibold text-black">
                {loggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Home className="h-4 w-4" />}
                Enter Admin
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      <div className="grid min-h-screen lg:grid-cols-[240px_1fr]">
        <aside className="border-b border-white/10 bg-[#0c0d12] p-4 lg:border-b-0 lg:border-r">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d7ff3f] text-black">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#d7ff3f]">VJMRTIM</p>
              <h1 className="font-semibold text-white">Asset Drive</h1>
            </div>
          </div>
          <nav className="grid gap-1">
            <NavButton icon={BarChart3} label="Dashboard" active={activeView === "dashboard"} onClick={() => setActiveView("dashboard")} />
            <NavButton icon={Folder} label="My Drive" active={activeView === "drive"} onClick={() => setActiveView("drive")} />
            <NavButton icon={RotateCw} label="Preview Queue" active={activeView === "queue"} onClick={() => setActiveView("queue")} />
            <NavButton icon={Share2} label="Shared Links" active={activeView === "shares"} onClick={() => setActiveView("shares")} />
            <NavButton icon={HardDrive} label="Storage" active={activeView === "storage"} onClick={() => setActiveView("storage")} />
            <NavButton icon={Settings} label="Settings" active={activeView === "settings"} onClick={() => setActiveView("settings")} />
          </nav>
          <p className="mt-8 text-xs text-zinc-600">VJMRTIM Asset Drive</p>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08090d]/95 px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-lg border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-3 py-1 text-xs font-semibold text-[#d7ff3f]">
                  Admin
                </div>
                <div className="flex min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 md:w-96">
                  <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search current folder..."
                    className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
                  />
                </div>
              </div>
              <button onClick={logout} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </header>

          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="min-w-0">
              {notice ? (
                <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200">
                  {notice}
                </div>
              ) : null}
              {activeView === "dashboard" && (
                <Dashboard
                  storage={storage}
                  onScan={() => void scanCurrentFolderAction()}
                  onDrive={() => setActiveView("drive")}
                  onQueue={() => setActiveView("queue")}
                  onClear={clearSelection}
                />
              )}
              {activeView === "storage" && (
                <Dashboard
                  storage={storage}
                  onScan={() => void scanCurrentFolderAction()}
                  onDrive={() => setActiveView("drive")}
                  onQueue={() => setActiveView("queue")}
                  onClear={clearSelection}
                />
              )}
              {activeView === "queue" && <QueueView queue={queue} onRefresh={loadQueue} />}
              {activeView === "shares" && <SharesView shares={shares} onRefresh={loadShares} />}
              {activeView === "settings" && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                  <h2 className="text-xl font-semibold">Settings</h2>
                  <p className="mt-2 text-sm text-zinc-400">Direct download can stay empty until router port forwarding is ready. Original files remain read-only for clients.</p>
                </div>
              )}
              {activeView === "drive" && (
                <DriveView
                  breadcrumbs={breadcrumbs}
                  currentPath={currentPath}
                  filtered={filtered}
                  displayedBytes={displayedBytes}
                  selectedPaths={selectedPaths}
                  selectedItems={selectedItems}
                  viewMode={viewMode}
                  loading={loading}
                  error={error}
                  onBreadcrumb={goBreadcrumb}
                  onSelectAll={() => setSelectedPaths(new Set(filtered.map((item) => item.path)))}
                  onClear={clearSelection}
                  onToggleView={setViewMode}
                  onToggleSelect={toggleSelect}
                  onOpenFolder={openFolder}
                  onPreview={previewItem}
                  onCreateFolder={createFolderAction}
                  onUploadClick={() => uploadInputRef.current?.click()}
                  onRename={renameAction}
                  onMove={moveSelectedAction}
                  onDownloadSelected={downloadSelectedAction}
                  onDelete={(paths) => void deleteSelectedAction(paths)}
                  onShare={createShareAction}
                  onRequestPreview={(paths) => void requestPreviewAction(paths)}
                  onCopy={copyText}
                  onRetry={() => void loadDrive(currentPath)}
                />
              )}
            </div>

            <DetailPanel
              selected={selected}
              previewText={previewText}
              previewLoading={previewLoading}
              previewError={previewError}
              videoPreviewUrl={selectedVideoPreviewUrl}
              onCopy={copyText}
              onRequestPreview={(path) => void requestPreviewAction([path])}
            />
          </div>
        </section>
      </div>
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void uploadFiles(event.target.files)}
      />
    </main>
  );
}

function NavButton({ icon: Icon, label, active, onClick }: { icon: typeof Home; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-[#d7ff3f] text-black" : "text-zinc-400 hover:bg-white/10 hover:text-white"}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Dashboard({
  storage,
  onScan,
  onDrive,
  onQueue,
  onClear,
}: {
  storage: StorageData | null;
  onScan: () => void;
  onDrive: () => void;
  onQueue: () => void;
  onClear: () => void;
}) {
  const cards = [
    ["Total capacity HDD", storage?.assetRoot.total || "-"],
    ["Used capacity HDD", storage?.assetRoot.used || "-"],
    ["Free capacity HDD", storage?.assetRoot.free || "-"],
    ["NVMe preview cache", storage?.cacheRoot.used || "-"],
    ["Current folder items", String(storage?.counts.currentFolderItems ?? "-")],
    ["Preview ready", String(storage?.counts.previewReady ?? "-")],
    ["Preview missing", String(storage?.counts.previewMissing ?? "-")],
    ["Failed preview", String(storage?.counts.previewFailed ?? "-")],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="mt-1 text-sm text-zinc-400">Storage, preview cache, and queue summary.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onDrive} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">Browse Drive</button>
          <button onClick={onScan} className="rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black">Scan current folder</button>
          <button onClick={onQueue} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">Preview Queue</button>
          <button onClick={onClear} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">Clear selection</button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-2 text-xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <h3 className="font-semibold">Recent activity</h3>
        <p className="mt-2 text-sm text-zinc-500">Activity feed placeholder. File operations and preview worker events can be wired here later.</p>
      </div>
    </div>
  );
}

function QueueView({ queue, onRefresh }: { queue: QueueItem[]; onRefresh: () => Promise<void> }) {
  async function processNext() {
    await fetch("/api/admin/preview/process-one", { method: "POST" });
    await onRefresh();
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <div>
          <h2 className="text-xl font-semibold">Preview Queue</h2>
          <p className="mt-1 text-sm text-zinc-500">Queued previews are processed by the CLI/worker.</p>
        </div>
        <button onClick={processNext} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">Process next preview</button>
      </div>
      <div className="divide-y divide-white/10">
        {queue.length === 0 ? <p className="p-4 text-sm text-zinc-500">No preview requests.</p> : null}
        {queue.map((item) => (
          <div key={item.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium text-white">{item.path}</p>
              <span className={`rounded-lg border px-2 py-1 text-xs ${item.status === "failed" ? badgeClass("warn") : badgeClass("muted")}`}>{item.status}</span>
            </div>
            {item.message ? <p className="mt-2 text-xs text-zinc-500">{item.message}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SharesView({ shares, onRefresh }: { shares: ShareLink[]; onRefresh: () => Promise<void> }) {
  async function revoke(token: string) {
    if (!window.confirm("Revoke this share link?")) return;
    await fetch(`/api/admin/shares/${token}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 p-4">
        <h2 className="text-xl font-semibold">Shared Links</h2>
        <p className="mt-1 text-sm text-zinc-500">Client access tokens stored in cache JSON.</p>
      </div>
      <div className="divide-y divide-white/10">
        {shares.length === 0 ? <p className="p-4 text-sm text-zinc-500">No share links yet.</p> : null}
        {shares.map((share) => (
          <div key={share.token} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <p className="font-medium text-white">{share.name}</p>
              <p className="mt-1 truncate text-xs text-zinc-500">{share.rootPath || "PublicShare"} - /share/{share.token}</p>
            </div>
            <button onClick={() => revoke(share.token)} className="rounded-lg border border-red-300/20 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10">Revoke</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DriveView(props: {
  breadcrumbs: string[];
  currentPath: string;
  filtered: DriveItem[];
  displayedBytes: number;
  selectedPaths: Set<string>;
  selectedItems: DriveItem[];
  viewMode: ViewMode;
  loading: boolean;
  error: string;
  onBreadcrumb: (index: number) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onToggleView: (view: ViewMode) => void;
  onToggleSelect: (path: string) => void;
  onOpenFolder: (item: DriveItem) => void;
  onPreview: (item: DriveItem) => void;
  onCreateFolder: () => void;
  onUploadClick: () => void;
  onRename: (item: DriveItem) => void;
  onMove: () => void;
  onDownloadSelected: () => void;
  onDelete: (paths: string[]) => void;
  onShare: (rootPath: string) => void;
  onRequestPreview: (paths: string[]) => void;
  onCopy: (text: string) => void;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm">
        <button onClick={() => props.onBreadcrumb(-1)} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 font-medium text-white hover:bg-white/10">
          <Home className="h-4 w-4 text-[#d7ff3f]" />
          PublicShare
        </button>
        {props.breadcrumbs.map((crumb, index) => (
          <div key={`${crumb}-${index}`} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-zinc-600" />
            <button onClick={() => props.onBreadcrumb(index)} className="max-w-[180px] truncate rounded-lg px-2 py-2 text-zinc-300 hover:bg-white/10">{crumb}</button>
          </div>
        ))}
      </nav>

      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
            <span><b className="text-white">{props.filtered.length}</b> items</span>
            <span><b className="text-white">{formatBytes(props.displayedBytes)}</b> displayed</span>
            <span><b className="text-white">{props.selectedPaths.size}</b> selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={props.onCreateFolder} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"><FolderPlus className="h-4 w-4" />New Folder</button>
            <button onClick={props.onUploadClick} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"><Upload className="h-4 w-4" />Upload</button>
            <button onClick={props.onSelectAll} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"><CheckSquare className="h-4 w-4" />Select all</button>
            <button onClick={props.onClear} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"><X className="h-4 w-4" />Clear</button>
            <button onClick={() => props.onToggleView("list")} className={`rounded-lg p-2 ${props.viewMode === "list" ? "bg-[#d7ff3f] text-black" : "border border-white/10 text-zinc-300"}`}><List className="h-4 w-4" /></button>
            <button onClick={() => props.onToggleView("grid")} className={`rounded-lg p-2 ${props.viewMode === "grid" ? "bg-[#d7ff3f] text-black" : "border border-white/10 text-zinc-300"}`}><Grid2X2 className="h-4 w-4" /></button>
          </div>
        </div>
        {props.selectedPaths.size > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
            <button onClick={() => props.onRequestPreview(props.selectedItems.map((item) => item.path))} className="rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black">Request preview</button>
            <button onClick={props.onDownloadSelected} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200"><Download className="h-4 w-4" />Download selected</button>
            <button onClick={props.onMove} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200"><MoveRight className="h-4 w-4" />Move</button>
            <button onClick={() => props.onDelete(Array.from(props.selectedPaths))} className="inline-flex items-center gap-2 rounded-lg border border-red-300/20 px-3 py-2 text-sm text-red-200"><Trash2 className="h-4 w-4" />Delete</button>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
        {props.loading ? (
          <div className="flex h-80 items-center justify-center gap-2 text-zinc-400"><Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />Loading files...</div>
        ) : props.error ? (
          <div className="flex h-80 flex-col items-center justify-center gap-3 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-300" />
            <p>{props.error}</p>
            <button onClick={props.onRetry} className="rounded-lg border border-white/10 px-3 py-2 text-sm">Retry</button>
          </div>
        ) : props.filtered.length === 0 ? (
          <div className="flex h-80 flex-col items-center justify-center gap-2 text-center text-zinc-500">
            <Folder className="h-10 w-10" />
            <p>Folder kosong atau tidak ada hasil search.</p>
          </div>
        ) : props.viewMode === "list" ? (
          <div className="divide-y divide-white/10">
            {props.filtered.map((item) => (
              <DriveRow key={item.path} item={item} checked={props.selectedPaths.has(item.path)} {...props} />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
            {props.filtered.map((item) => (
              <DriveCard key={item.path} item={item} checked={props.selectedPaths.has(item.path)} {...props} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DriveRow({ item, checked, ...props }: { item: DriveItem; checked: boolean } & Parameters<typeof DriveView>[0]) {
  return (
    <div className="grid gap-2 px-3 py-2 md:grid-cols-[42px_minmax(0,1fr)_110px_105px_180px] md:items-center">
      <button onClick={() => props.onToggleSelect(item.path)} className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10">
        {checked ? <CheckSquare className="h-5 w-5 text-[#d7ff3f]" /> : <Square className="h-5 w-5" />}
      </button>
      <button onClick={() => item.type === "folder" ? props.onOpenFolder(item) : props.onPreview(item)} className="grid min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-3 text-left">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg border ${item.type === "folder" ? "border-[#d7ff3f]/20 bg-[#d7ff3f]/10 text-[#d7ff3f]" : "border-white/10 bg-black/20 text-zinc-400"}`}>
          <DriveIcon type={item.type} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-white">{item.name}</span>
          <span className="mt-1 block truncate text-xs text-zinc-500">{typeLabel(item)} - {previewStatusLabel(item)} - {downloadModeLabel(item)}</span>
        </span>
      </button>
      <span className={`hidden rounded-lg border px-2 py-1 text-center text-xs md:inline-block ${previewBadgeClass(item.previewStatus)}`}>{previewStatusLabel(item)}</span>
      <span className="hidden text-right text-sm text-zinc-500 md:block">{item.size || "-"}</span>
      <ItemActions item={item} {...props} />
    </div>
  );
}

function DriveCard({ item, checked, ...props }: { item: DriveItem; checked: boolean } & Parameters<typeof DriveView>[0]) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => props.onToggleSelect(item.path)} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10">{checked ? <CheckSquare className="h-5 w-5 text-[#d7ff3f]" /> : <Square className="h-5 w-5" />}</button>
        <ItemActions item={item} {...props} />
      </div>
      <button onClick={() => item.type === "folder" ? props.onOpenFolder(item) : props.onPreview(item)} className="w-full text-left">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300"><DriveIcon type={item.type} className="h-6 w-6" /></span>
        <span className="line-clamp-2 text-sm font-medium text-white">{item.name}</span>
        <span className="mt-2 block text-xs text-zinc-500">{typeLabel(item)} - {item.size || "Folder"}</span>
      </button>
    </div>
  );
}

function ItemActions({ item, ...props }: { item: DriveItem } & Parameters<typeof DriveView>[0]) {
  return (
    <details className="relative justify-self-end">
      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-white/10 text-zinc-300 hover:bg-white/10">
        <MoreVertical className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-52 rounded-lg border border-white/10 bg-[#101217] p-1 shadow-2xl">
        {item.type === "folder" ? (
          <button onClick={() => props.onOpenFolder(item)} className="menu-btn"><ChevronRight className="h-4 w-4" />Open</button>
        ) : (
          <button onClick={() => props.onPreview(item)} className="menu-btn"><Eye className="h-4 w-4" />Preview</button>
        )}
        {item.directDownloadUrl ? <a href={item.directDownloadUrl} className="menu-btn"><Download className="h-4 w-4" />Download</a> : null}
        {item.type === "folder" ? (
          <a
            href={`/api/zip?path=${encodeURIComponent(item.path)}`}
            onClick={(event) => {
              if (!window.confirm("Folder ZIP can be slow for huge folders. For very large assets, download files individually.")) {
                event.preventDefault();
              }
            }}
            className="menu-btn"
          >
            <Download className="h-4 w-4" />Download as ZIP
          </a>
        ) : null}
        {item.directDownloadUrl ? <button onClick={() => props.onCopy(item.directDownloadUrl || "")} className="menu-btn"><Copy className="h-4 w-4" />Copy link</button> : null}
        <button onClick={() => props.onRequestPreview([item.path])} className="menu-btn"><RotateCw className="h-4 w-4" />Request preview</button>
        <button onClick={() => props.onRename(item)} className="menu-btn"><FileText className="h-4 w-4" />Rename</button>
        <button onClick={() => props.onShare(item.path)} className="menu-btn"><Link className="h-4 w-4" />Share access</button>
        <button onClick={() => props.onDelete([item.path])} className="menu-btn text-red-200"><Trash2 className="h-4 w-4" />Delete</button>
      </div>
    </details>
  );
}

function DetailPanel({
  selected,
  previewText,
  previewLoading,
  previewError,
  videoPreviewUrl,
  onCopy,
  onRequestPreview,
}: {
  selected: DriveItem | null;
  previewText: string;
  previewLoading: boolean;
  previewError: string;
  videoPreviewUrl: string | null;
  onCopy: (text: string) => void;
  onRequestPreview: (path: string) => void;
}) {
  if (!selected) {
    return (
      <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-4 xl:sticky xl:top-24 xl:h-[calc(100vh-7rem)]">
        <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 text-center text-zinc-500">
          <File className="h-9 w-9" />
          <p className="text-sm">Select a file to preview details.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-auto">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-[#d7ff3f]">DETAIL</p>
          <h2 className="mt-2 break-words text-xl font-semibold">{selected.name}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-lg border px-2 py-1 text-xs ${previewBadgeClass(selected.previewStatus)}`}>{previewStatusLabel(selected)}</span>
            <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs">{downloadModeLabel(selected)}</span>
          </div>
        </div>

        {selected.type === "video" && selected.thumbnailUrl ? (
          <Image src={selected.thumbnailUrl} alt={`${selected.name} thumbnail`} width={960} height={540} unoptimized className="max-h-48 w-full rounded-lg object-cover" />
        ) : null}

        <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
          {selected.type === "image" ? <Image src={fileUrl(selected.path)} alt={selected.name} width={1200} height={800} unoptimized className="max-h-[380px] w-full object-contain" /> : null}
          {selected.type === "video" ? (
            videoPreviewUrl ? (
              <video src={videoPreviewUrl} poster={selected.thumbnailUrl || undefined} controls playsInline preload="metadata" className="max-h-[380px] w-full bg-black" />
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-4 text-center">
                <FileVideo className="h-11 w-11 text-zinc-500" />
                <p className="text-sm font-medium">Preview cache not generated yet.</p>
                <p className="text-xs text-zinc-500">Original file can still be downloaded.</p>
                <button onClick={() => onRequestPreview(selected.path)} className="rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black">Request Preview</button>
              </div>
            )
          ) : null}
          {selected.type === "pdf" ? <iframe src={fileUrl(selected.path)} title={selected.name} className="h-[380px] w-full bg-white" /> : null}
          {selected.type === "text" ? (
            <div className="max-h-[380px] min-h-64 overflow-auto p-4">
              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin text-[#d7ff3f]" /> : null}
              {previewError ? <p className="text-sm text-amber-200">{previewError}</p> : <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5">{previewText}</pre>}
            </div>
          ) : null}
          {!selected.canPreview && selected.type !== "video" ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-zinc-500">
              <File className="h-10 w-10" />
              <p>Preview unavailable</p>
            </div>
          ) : null}
        </div>

        {selected.type === "folder" ? (
          <p className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
            Folder ZIP can be slow for huge folders. For very large assets, download files individually.
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
          {selected.directDownloadUrl ? <a href={selected.directDownloadUrl} className="flex items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-3 font-semibold text-black"><Download className="h-4 w-4" />Download Original</a> : null}
          {selected.directDownloadUrl ? <button onClick={() => onCopy(selected.directDownloadUrl || "")} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 font-semibold text-zinc-200"><Copy className="h-4 w-4" />Copy Link</button> : null}
        </div>
      </div>
    </aside>
  );
}
