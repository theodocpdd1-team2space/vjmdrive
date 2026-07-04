"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckSquare,
  ChevronRight,
  Copy,
  Download,
  Eye,
  ExternalLink,
  File,
  FileText,
  FileVideo,
  Folder,
  FolderPlus,
  HardDrive,
  Home,
  Link,
  Loader2,
  LogOut,
  Menu,
  MoreVertical,
  MoveRight,
  RotateCw,
  Search,
  Settings,
  Share2,
  Shield,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { logoutAndRedirect } from "@/components/common/logout";
import { EmailChipsInput } from "@/components/common/email-chips-input";
import {
  DownloadModeBadge,
  EmptyState,
  FileThumbnail,
  PreviewModal,
  PreviewStatusBadge,
  SelectionCheckbox,
  ViewToggle,
} from "@/components/drive/drive-ui";

type DriveItemType = "folder" | "image" | "video" | "audio" | "pdf" | "document" | "spreadsheet" | "presentation" | "text" | "archive" | "design" | "file";
type PreviewStatus = "native" | "ready" | "missing" | "unsupported" | "queued" | "processing" | "failed";
type ViewMode = "list" | "grid" | "compact";
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
  assetRoot: { label: string; total: string; used: string; free: string; totalBytes?: number; usedBytes?: number; freeBytes?: number };
  cacheRoot: { label: string; used: string; path: string; usedBytes?: number };
  counts: {
    currentFolderItems: number;
    previewReady: number;
    previewMissing: number;
    previewQueued?: number;
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
  title?: string;
  rootPath: string;
  canDownload: boolean;
  visibility?: "PRIVATE" | "PUBLIC_LOGIN" | "PUBLIC";
  allowedEmails?: string[];
  permission?: "VIEW_ONLY" | "DOWNLOAD" | "UPLOAD" | "FULL";
  expiresAt: string | null;
  createdAt: string;
  updatedAt?: string;
  note?: string;
  disabledAt?: string | null;
  pinned?: boolean;
};

const TEXT_PREVIEW_LIMIT = 256 * 1024;

function fileUrl(filePath: string, download = false) {
  const params = new URLSearchParams({ path: filePath });
  if (download) params.set("download", "1");
  return `/api/file?${params.toString()}`;
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

function badgeClass(kind: "ok" | "warn" | "muted" | "danger") {
  if (kind === "ok") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (kind === "warn") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  if (kind === "danger") return "border-red-300/20 bg-red-300/10 text-red-100";
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

export default function AdminDriveApp({ embedded = false }: { embedded?: boolean }) {
  const [authState, setAuthState] = useState<"checking" | "guest" | "admin">(embedded ? "admin" : "checking");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>(embedded ? "drive" : "dashboard");
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
  const [previewModalItem, setPreviewModalItem] = useState<DriveItem | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadSelection, setUploadSelection] = useState<globalThis.File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<DriveItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTargetFolder, setMoveTargetFolder] = useState("");
  const [deleteTargets, setDeleteTargets] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [shareTargetPath, setShareTargetPath] = useState<string | null>(null);
  const [shareResult, setShareResult] = useState<{
    url: string;
    token: string;
    permission: string;
    expiresAt: string | null;
    allowedEmails: string[];
  } | null>(null);
  const [appOrigin, setAppOrigin] = useState("");
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [usersCount, setUsersCount] = useState(0);

  function clearPreview() {
    setPreviewText("");
    setPreviewError("");
    setPreviewLoading(false);
  }

  function clearSelection() {
    setSelectedPaths(new Set());
  }

  function switchView(view: AppView) {
    setActiveView(view);
    setSidebarOpen(false);
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

  const loadUsersCount = useCallback(async () => {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    if (res.ok) setUsersCount(((await res.json()).users || []).length);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppOrigin(window.location.origin);
      void loadDrive("");
      void loadStorage("");
      void loadQueue();
      void loadShares();
      void loadUsersCount();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDrive, loadQueue, loadShares, loadStorage, loadUsersCount]);

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
    setNotice("Logged out.");
    await logoutAndRedirect("/");
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
    setPreviewModalItem(item);
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

  function openCreateFolderModal() {
    setNewFolderName("");
    setFolderModalOpen(true);
  }

  async function createFolderAction() {
    const name = newFolderName.trim();
    if (!name) return;

    try {
      await adminJson("/api/admin/folder", "POST", { path: currentPath, name });
      setNotice("Folder created.");
      setFolderModalOpen(false);
      setNewFolderName("");
      await loadDrive(currentPath);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Folder failed.");
    }
  }

  async function uploadFiles(files: globalThis.File[]) {
    if (!files.length || uploading) return;
    const form = new FormData();
    form.set("path", currentPath);
    files.forEach((file) => form.append("files", file));
    setUploading(true);
    setUploadProgress(0);

    try {
      const data = await new Promise<{ ok?: boolean; uploaded?: string[]; message?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/upload");
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onerror = () => reject(new Error("Upload failed."));
        xhr.onload = () => {
          const payload = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 400 || !payload.ok) reject(new Error(payload.message || "Upload failed."));
          else resolve(payload);
        };
        xhr.send(form);
      });
      setUploadProgress(100);
      setNotice(`Uploaded ${data.uploaded?.length ?? files.length} file(s).`);
      setUploadSelection([]);
      setUploadModalOpen(false);
      await loadDrive(currentPath);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function openRenameModal(item: DriveItem) {
    setRenameTarget(item);
    setRenameValue(item.name);
  }

  async function renameAction() {
    if (!renameTarget) return;
    const newName = renameValue.trim();
    if (!newName || newName === renameTarget.name) {
      setRenameTarget(null);
      return;
    }

    try {
      await adminJson("/api/admin/rename", "POST", { path: renameTarget.path, newName });
      setNotice("Renamed.");
      setRenameTarget(null);
      await loadDrive(currentPath);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Rename failed.");
    }
  }

  function openMoveModal() {
    if (!selectedPaths.size) return;
    setMoveTargetFolder(currentPath);
    setMoveModalOpen(true);
  }

  async function moveSelectedAction() {
    const paths = Array.from(selectedPaths);
    const targetFolder = moveTargetFolder.trim();
    if (!paths.length) return;

    try {
      await movePathsAction(paths, targetFolder);
      setNotice("Moved.");
      setMoveModalOpen(false);
      setMoveTargetFolder("");
      clearSelection();
      await loadDrive(currentPath);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Move failed.");
    }
  }

  async function movePathsAction(paths: string[], targetFolder: string) {
    await adminJson("/api/files/move", "POST", { items: paths, targetFolder });
    setNotice(`Moved ${paths.length} item(s).`);
    await loadDrive(currentPath);
  }

  function openDeleteModal(paths = Array.from(selectedPaths)) {
    if (!paths.length) return;
    setDeleteTargets(paths);
  }

  async function deleteSelectedAction() {
    const paths = deleteTargets || [];
    if (!paths.length || deleting) return;

    try {
      setDeleting(true);
      await adminJson("/api/admin/delete", "DELETE", { paths });
      setNotice("Moved to soft trash.");
      setDeleteTargets(null);
      clearSelection();
      setSelected(null);
      await loadDrive(currentPath);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  function openShareModal(rootPath: string) {
    setShareTargetPath(rootPath);
    setShareResult(null);
  }

  async function createShareAction(input: {
    rootPath: string;
    name: string;
    canDownload: boolean;
    expiresAt: string | null;
    note: string;
    visibility: "PRIVATE" | "PUBLIC_LOGIN" | "PUBLIC";
    allowedEmails: string[];
    permission: "VIEW_ONLY" | "DOWNLOAD";
  }) {
    try {
      const data = await adminJson("/api/admin/share", "POST", {
        rootPath: input.rootPath,
        name: input.name,
        canDownload: input.canDownload,
        expiresAt: input.expiresAt,
        note: input.note,
        visibility: input.visibility,
        allowedEmails: input.allowedEmails,
        permission: input.permission,
      });
      const url = `${appOrigin || window.location.origin}${data.url}`;
      setShareResult({
        url,
        token: data.token,
        permission: input.permission,
        expiresAt: input.expiresAt,
        allowedEmails: input.allowedEmails,
      });
      if (input.visibility === "PUBLIC_LOGIN" && input.allowedEmails.length) {
        const failed = data.invite?.failed || [];
        setNotice(
          failed.length
            ? "Share link created, but email invite failed. Check Resend settings."
            : `Share link created and invitation sent to: ${input.allowedEmails.join(", ")}`
        );
      } else {
        setNotice("Share link created.");
      }
      await copyText(url);
      await loadShares();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Create share failed.");
      throw caught;
    }
  }

  async function updateShareAllowedEmails(token: string, allowedEmails: string[]) {
    await adminJson(`/api/admin/shares/${token}`, "PATCH", {
      allowedEmails,
      visibility: "PUBLIC_LOGIN",
    });
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

  function shareSelectedAction() {
    if (selectedItems.length === 1) {
      openShareModal(selectedItems[0].path);
      return;
    }

    openShareModal(currentPath);
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
              <p className="text-sm font-semibold text-[#d7ff3f]">driveOne </p>
              <h1 className="mt-2 text-4xl font-semibold text-white md:text-6xl">Admin console</h1>
              <p className="mt-4 max-w-lg text-zinc-400">Private access only</p>
            </div>
            <form onSubmit={login} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-xl font-semibold text-white">driveOne Admin</h2>
              <label className="mt-5 block text-sm text-zinc-300" htmlFor="password">Admin password</label>
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

  if (embedded) {
    return (
      <>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search current folder..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ViewToggle value={viewMode} onChange={setViewMode} />
              <button onClick={() => setUploadModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black">
                <Upload className="h-4 w-4" />
                Upload
              </button>
            </div>
          </div>

          {notice ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200">
              {notice}
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
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
              onCreateFolder={openCreateFolderModal}
              onUploadClick={() => setUploadModalOpen(true)}
              onRename={openRenameModal}
              onMove={openMoveModal}
              onMoveItems={(paths, targetFolder) => void movePathsAction(paths, targetFolder)}
              onDownloadSelected={downloadSelectedAction}
              onShareSelected={shareSelectedAction}
              onDelete={openDeleteModal}
              onShare={openShareModal}
              onRequestPreview={(paths) => void requestPreviewAction(paths)}
              onCopy={copyText}
              onRetry={() => void loadDrive(currentPath)}
            />

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
        </div>

        <PreviewModal
          key={previewModalItem?.path || "admin-preview"}
          item={previewModalItem}
          open={previewModalItem !== null}
          canDownload
          isAdmin
          onClose={() => setPreviewModalItem(null)}
          onCopy={copyText}
          onShare={openShareModal}
          onRequestPreview={(path) => void requestPreviewAction([path])}
        />
        <ShareModal
          key={shareTargetPath || "share-modal"}
          targetPath={shareTargetPath}
          result={shareResult}
          origin={appOrigin}
          shares={shares}
          onClose={() => {
            setShareTargetPath(null);
            setShareResult(null);
          }}
          onCreate={createShareAction}
          onCopy={copyText}
          onUpdateShareEmails={updateShareAllowedEmails}
        />
        <UploadModal
          open={uploadModalOpen}
          files={uploadSelection}
          uploading={uploading}
          progress={uploadProgress}
          onClose={() => {
            if (!uploading) {
              setUploadModalOpen(false);
              setUploadSelection([]);
            }
          }}
          onFilesChange={setUploadSelection}
          onUpload={() => void uploadFiles(uploadSelection)}
        />
        <TextInputModal
          open={folderModalOpen}
          title="New Folder"
          label="Folder name"
          value={newFolderName}
          submitLabel="Create Folder"
          onChange={setNewFolderName}
          onClose={() => setFolderModalOpen(false)}
          onSubmit={() => void createFolderAction()}
        />
        <TextInputModal
          open={renameTarget !== null}
          title="Rename"
          label="New name"
          value={renameValue}
          submitLabel="Rename"
          onChange={setRenameValue}
          onClose={() => setRenameTarget(null)}
          onSubmit={() => void renameAction()}
        />
        <MoveModal
          open={moveModalOpen}
          count={selectedPaths.size}
          targetFolder={moveTargetFolder}
          onChange={setMoveTargetFolder}
          onClose={() => setMoveModalOpen(false)}
          onSubmit={() => void moveSelectedAction()}
        />
        <ConfirmModal
          open={deleteTargets !== null}
          title="Move to soft trash?"
          body={`${deleteTargets?.length || 0} item(s) will be moved to cache trash. Original paths stay recoverable from the server trash folder.`}
          confirmLabel="Move to Trash"
          danger
          loading={deleting}
          onClose={() => {
            if (!deleting) setDeleteTargets(null);
          }}
          onConfirm={() => void deleteSelectedAction()}
        />
      </>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      {sidebarOpen ? <button aria-label="Close sidebar overlay" className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}
      <div className="grid min-h-screen lg:grid-cols-[240px_1fr]">
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-white/10 bg-[#0c0d12] p-4 transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#d7ff3f] text-black">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#d7ff3f]"></p>
              <h1 className="font-semibold text-white">driveOne</h1>
            </div>
          </div>
          <nav className="grid gap-1">
            <NavButton icon={BarChart3} label="Dashboard" active={activeView === "dashboard"} onClick={() => switchView("dashboard")} />
            <NavButton icon={Folder} label="Drive" active={activeView === "drive"} onClick={() => switchView("drive")} />
            <a href="/admin/users" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white"><Users className="h-4 w-4" />Users</a>
            <NavButton icon={Share2} label="Shares" active={activeView === "shares"} onClick={() => switchView("shares")} />
            <a href="/admin/access-requests" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white"><Shield className="h-4 w-4" />Access Requests</a>
            <NavButton icon={RotateCw} label="Preview Queue" active={activeView === "queue"} onClick={() => switchView("queue")} />
            <NavButton icon={Settings} label="Settings" active={activeView === "settings"} onClick={() => switchView("settings")} />
            <button type="button" onClick={logout} className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" />Logout</button>
          </nav>
          <p className="mt-8 text-xs text-zinc-600">driveOne Admin</p>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08090d]/95 px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-xl border border-white/10 p-2 text-zinc-200 lg:hidden" aria-label="Open sidebar">
                  <Menu className="h-4 w-4" />
                </button>
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
              <div className="flex items-center gap-2">
                <ViewToggle value={viewMode} onChange={setViewMode} />
                <button onClick={logout} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </header>

          <div className="grid gap-4 p-3 md:p-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              {notice ? (
                <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200">
                  {notice}
                </div>
              ) : null}
              {activeView === "dashboard" && (
                <Dashboard
                  storage={storage}
                  usersCount={usersCount}
                  sharesCount={shares.filter((share) => !isShareExpired(share)).length}
                  onScan={() => void scanCurrentFolderAction()}
                  onDrive={() => setActiveView("drive")}
                  onQueue={() => setActiveView("queue")}
                  onClear={clearSelection}
                />
              )}
              {activeView === "storage" && (
                <Dashboard
                  storage={storage}
                  usersCount={usersCount}
                  sharesCount={shares.filter((share) => !isShareExpired(share)).length}
                  onScan={() => void scanCurrentFolderAction()}
                  onDrive={() => setActiveView("drive")}
                  onQueue={() => setActiveView("queue")}
                  onClear={clearSelection}
                />
              )}
              {activeView === "queue" && <QueueView queue={queue} onRefresh={loadQueue} onRetry={(path) => void requestPreviewAction([path])} />}
              {activeView === "shares" && (
                <SharesView
                  shares={shares}
                  origin={appOrigin}
                  onRefresh={loadShares}
                  onCreate={() => openShareModal(currentPath)}
                  onCopy={copyText}
                />
              )}
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
                  onCreateFolder={openCreateFolderModal}
                  onUploadClick={() => setUploadModalOpen(true)}
                  onRename={openRenameModal}
                  onMove={openMoveModal}
                  onMoveItems={(paths, targetFolder) => void movePathsAction(paths, targetFolder)}
                  onDownloadSelected={downloadSelectedAction}
                  onShareSelected={shareSelectedAction}
                  onDelete={openDeleteModal}
                  onShare={openShareModal}
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
      <PreviewModal
        key={previewModalItem?.path || "admin-preview"}
        item={previewModalItem}
        open={previewModalItem !== null}
        canDownload
        isAdmin
        onClose={() => setPreviewModalItem(null)}
        onCopy={copyText}
        onShare={openShareModal}
        onRequestPreview={(path) => void requestPreviewAction([path])}
      />
      <ShareModal
        key={shareTargetPath || "share-modal"}
        targetPath={shareTargetPath}
        result={shareResult}
        origin={appOrigin}
        shares={shares}
        onClose={() => {
          setShareTargetPath(null);
          setShareResult(null);
        }}
        onCreate={createShareAction}
        onCopy={copyText}
        onUpdateShareEmails={updateShareAllowedEmails}
      />
      <UploadModal
        open={uploadModalOpen}
        files={uploadSelection}
        uploading={uploading}
        progress={uploadProgress}
        onClose={() => {
          if (!uploading) {
            setUploadModalOpen(false);
            setUploadSelection([]);
          }
        }}
        onFilesChange={setUploadSelection}
        onUpload={() => void uploadFiles(uploadSelection)}
      />
      <TextInputModal
        open={folderModalOpen}
        title="New Folder"
        label="Folder name"
        value={newFolderName}
        submitLabel="Create Folder"
        onChange={setNewFolderName}
        onClose={() => setFolderModalOpen(false)}
        onSubmit={() => void createFolderAction()}
      />
      <TextInputModal
        open={renameTarget !== null}
        title="Rename"
        label="New name"
        value={renameValue}
        submitLabel="Rename"
        onChange={setRenameValue}
        onClose={() => setRenameTarget(null)}
        onSubmit={() => void renameAction()}
      />
      <MoveModal
        open={moveModalOpen}
        count={selectedPaths.size}
        targetFolder={moveTargetFolder}
        onChange={setMoveTargetFolder}
        onClose={() => setMoveModalOpen(false)}
        onSubmit={() => void moveSelectedAction()}
      />
      <ConfirmModal
        open={deleteTargets !== null}
        title="Move to soft trash?"
        body={`${deleteTargets?.length || 0} item(s) will be moved to cache trash. Original paths stay recoverable from the server trash folder.`}
        confirmLabel="Move to Trash"
        danger
        loading={deleting}
        onClose={() => {
          if (!deleting) setDeleteTargets(null);
        }}
        onConfirm={() => void deleteSelectedAction()}
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
  usersCount,
  sharesCount,
  onScan,
  onDrive,
  onQueue,
  onClear,
}: {
  storage: StorageData | null;
  usersCount: number;
  sharesCount: number;
  onScan: () => void;
  onDrive: () => void;
  onQueue: () => void;
  onClear: () => void;
}) {
  const cards = [
    ["HDD Total", storage?.assetRoot.total || "-"],
    ["HDD Used", storage?.assetRoot.used || "-"],
    ["HDD Free", storage?.assetRoot.free || "-"],
    ["Preview Cache", storage?.cacheRoot.used || "-"],
    ["Current Items", String(storage?.counts.currentFolderItems ?? "-")],
    ["Preview Ready", String(storage?.counts.previewReady ?? "-")],
    ["Preview Missing", String(storage?.counts.previewMissing ?? "-")],
    ["Queue Pending", String(storage?.counts.previewQueued ?? storage?.counts.previewMissing ?? "-")],
    ["Registered Users", String(usersCount)],
    ["Active Shares", String(sharesCount)],
  ];
  const usedPercent = storage?.assetRoot.totalBytes
    ? Math.min(100, Math.round(((storage.assetRoot.usedBytes || 0) / storage.assetRoot.totalBytes) * 100))
    : 0;

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
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">HDD usage</span>
          <span className="font-medium text-white">{usedPercent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#d7ff3f]" style={{ width: `${usedPercent}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/[0.035] p-3 md:p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-2 text-lg font-semibold text-white md:text-xl">{value}</p>
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

function QueueView({
  queue,
  onRefresh,
  onRetry,
}: {
  queue: QueueItem[];
  onRefresh: () => Promise<void>;
  onRetry: (path: string) => void;
}) {
  async function processNext() {
    await fetch("/api/admin/preview/process-one", { method: "POST" });
    await onRefresh();
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
        <div>
          <h2 className="text-xl font-semibold">Preview Queue</h2>
          <p className="mt-1 text-sm text-zinc-500">Queued previews are processed by the CLI/worker.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void onRefresh()} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">Refresh</button>
          <button onClick={processNext} className="rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black">Process next</button>
        </div>
      </div>
      <div className="divide-y divide-white/10">
        {queue.length === 0 ? <p className="p-4 text-sm text-zinc-500">No preview requests.</p> : null}
        {queue.map((item) => (
          <div key={item.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="truncate text-sm font-medium text-white">{item.path}</p>
              <div className="flex items-center gap-2">
                <span className={`rounded-lg border px-2 py-1 text-xs ${item.status === "failed" ? badgeClass("warn") : badgeClass("muted")}`}>{item.status}</span>
                {item.status === "failed" ? (
                  <button type="button" onClick={() => onRetry(item.path)} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10">
                    Retry
                  </button>
                ) : null}
              </div>
            </div>
            {item.message ? <p className="mt-2 text-xs text-zinc-500">{item.message}</p> : null}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-600">
              <span>Created {formatDate(item.createdAt)}</span>
              <span>Updated {formatDate(item.updatedAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SharesView({
  shares,
  origin,
  onRefresh,
  onCreate,
  onCopy,
}: {
  shares: ShareLink[];
  origin: string;
  onRefresh: () => Promise<void>;
  onCreate: () => void;
  onCopy: (text: string) => void;
}) {
  const [revokeTarget, setRevokeTarget] = useState<ShareLink | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState("");

  async function revoke() {
    if (!revokeTarget || revoking) return;
    setRevoking(true);
    setError("");
    const res = await fetch(`/api/admin/shares/${revokeTarget.token}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setRevoking(false);
    if (!res.ok || !data.ok) {
      setError(data.message || "Disable link failed.");
      return;
    }
    setRevokeTarget(null);
    await onRefresh();
  }

  return (
    <>
      <div className="rounded-lg border border-white/10 bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <div>
            <h2 className="text-xl font-semibold">Shared Links</h2>
            <p className="mt-1 text-sm text-zinc-500">Create client links with view-only or download permission.</p>
          </div>
          <button onClick={onCreate} className="rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black">New Share Link</button>
        </div>
        {error ? <p className="mx-3 mt-3 rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
        <div className="grid gap-3 p-3">
          {shares.length === 0 ? <EmptyState icon={Share2} title="No share links yet" body="Create a link from My Drive or from this page." /> : null}
          {shares.map((share) => (
            <div key={share.token} className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-white">{share.name}</p>
                  <span className={`rounded-md border px-2 py-0.5 text-[11px] ${isShareExpired(share) ? badgeClass("danger") : badgeClass("ok")}`}>
                    {isShareExpired(share) ? "Expired" : "Active"}
                  </span>
                  <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-300">
                    {share.canDownload ? "View + Download" : "View only"}
                  </span>
                  <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-300">
                    {share.visibility === "PUBLIC" ? "Public" : share.visibility === "PRIVATE" ? "Private" : "Login protected"}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs text-zinc-500" title={share.rootPath || "PublicShare"}>{share.rootPath || "PublicShare"}</p>
                {share.note ? <p className="mt-2 text-xs text-zinc-500">{share.note}</p> : null}
                <div className="mt-3 grid gap-2 text-xs text-zinc-500 md:grid-cols-2">
                  <span>Created: {formatDate(share.createdAt)}</span>
                  <span>Expires: {share.expiresAt ? formatDate(share.expiresAt) : "Never"}</span>
                </div>
                {share.allowedEmails?.length ? (
                  <p className="mt-2 text-xs text-zinc-500">Allowed: {share.allowedEmails.join(", ")}</p>
                ) : null}
                <p className="mt-3 truncate rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-zinc-300">
                  {origin}/share/{share.token}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => onCopy(`${origin}/share/${share.token}`)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"><Copy className="h-4 w-4" />Copy Link</button>
                <a href={`/share/${share.token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"><ExternalLink className="h-4 w-4" />Open</a>
                <button onClick={() => setRevokeTarget(share)} className="rounded-lg border border-red-300/20 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10">Disable link</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ConfirmModal
        open={revokeTarget !== null}
        title="Disable share link?"
        body={`All access for ${revokeTarget?.name || "this link"} will stop immediately. Removing a single email should be done from Edit Access instead.`}
        confirmLabel="Disable link"
        danger
        loading={revoking}
        onClose={() => {
          if (!revoking) setRevokeTarget(null);
        }}
        onConfirm={() => void revoke()}
      />
    </>
  );
}

function isShareExpired(share: ShareLink) {
  return Boolean(share.expiresAt && new Date(share.expiresAt).getTime() < Date.now());
}

function ShareModal({
  targetPath,
  result,
  origin,
  shares,
  onClose,
  onCreate,
  onCopy,
  onUpdateShareEmails,
}: {
  targetPath: string | null;
  result: { url: string; token: string; permission: string; expiresAt: string | null; allowedEmails: string[] } | null;
  origin: string;
  shares: ShareLink[];
  onClose: () => void;
  onCreate: (input: {
    rootPath: string;
    name: string;
    canDownload: boolean;
    expiresAt: string | null;
    note: string;
    visibility: "PRIVATE" | "PUBLIC_LOGIN" | "PUBLIC";
    allowedEmails: string[];
    permission: "VIEW_ONLY" | "DOWNLOAD";
  }) => Promise<void>;
  onCopy: (text: string) => void;
  onUpdateShareEmails: (token: string, allowedEmails: string[]) => Promise<void>;
}) {
  const [name, setName] = useState("Client Share");
  const [canDownload, setCanDownload] = useState(true);
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC_LOGIN" | "PUBLIC">("PUBLIC_LOGIN");
  const [emails, setEmails] = useState<string[]>([]);
  const [expiry, setExpiry] = useState<"never" | "1d" | "7d" | "30d" | "custom">("never");
  const [customDate, setCustomDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [accessSearch, setAccessSearch] = useState("");

  if (!targetPath) return null;
  const activeTargetPath = targetPath;
  const existingAccess = shares
    .filter((share) => !share.disabledAt)
    .filter((share) => !share.expiresAt || new Date(share.expiresAt).getTime() >= Date.now())
    .filter((share) => share.rootPath === activeTargetPath);
  const existingEmails = Array.from(new Set(existingAccess.flatMap((share) => share.allowedEmails || [])));
  const accessNeedle = accessSearch.trim().toLowerCase();
  const filteredAccess = existingAccess.flatMap((share) => {
    const allowedEmails = share.allowedEmails || [];
    const emailsForShare = share.visibility === "PUBLIC_LOGIN" && !allowedEmails.length ? ["Login protected"] : allowedEmails;
    return emailsForShare
      .filter((email) => !accessNeedle || [email, share.title, share.permission, share.visibility].join(" ").toLowerCase().includes(accessNeedle))
      .map((email) => ({ share, email }));
  });

  function expiresAt() {
    if (expiry === "never") return null;
    if (expiry === "custom") return customDate ? new Date(customDate).toISOString() : null;
    const days = expiry === "1d" ? 1 : expiry === "7d" ? 7 : 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const allowedEmails = emails;
    setFormError("");
    setSubmitting(true);
    try {
      await onCreate({
        rootPath: activeTargetPath,
        name,
        canDownload,
        expiresAt: expiresAt(),
        note,
        visibility,
        allowedEmails,
        permission: canDownload ? "DOWNLOAD" : "VIEW_ONLY",
      });
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Generate link failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/70 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-4">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:max-w-xl md:rounded-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#d7ff3f]">SHARE ACCESS</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Create Share Link</h2>
            <p className="mt-1 text-sm text-zinc-500">Root: {activeTargetPath || "PublicShare"}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close share modal">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm text-zinc-300">Share name / client</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#d7ff3f]" />
          </label>

          {existingAccess.length ? (
            <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Existing Access</p>
                  <p className="mt-1 text-xs text-zinc-500">Active shares already pointing to this item.</p>
                </div>
                {existingEmails.length ? (
                  <button type="button" onClick={() => setEmails(Array.from(new Set([...emails, ...existingEmails])))} className="rounded-xl border border-[#d7ff3f]/30 px-3 py-2 text-xs font-bold text-[#d7ff3f] hover:bg-[#d7ff3f]/10">
                    Use existing emails
                  </button>
                ) : null}
              </div>
              <label className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-[#08090d] px-3 py-2">
                <Search className="h-4 w-4 text-zinc-500" />
                <input value={accessSearch} onChange={(event) => setAccessSearch(event.target.value)} placeholder="Search existing access..." className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600" />
              </label>
              <div className="mt-3 max-h-40 overflow-auto rounded-xl border border-white/10">
                {filteredAccess.length ? filteredAccess.map(({ share, email }) => (
                  <div key={`${share.token}-${email}`} className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2 last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100">{email}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{share.title} · {share.visibility} · {share.permission} · {share.expiresAt ? formatDate(share.expiresAt) : "Never expires"}</p>
                    </div>
                    {email !== "Login protected" ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Remove email ${email} from "${share.title}"?`)) return;
                          await onUpdateShareEmails(share.token, (share.allowedEmails || []).filter((item) => item !== email));
                        }}
                        className="shrink-0 rounded-xl border border-red-300/20 px-2 py-1 text-xs font-semibold text-red-200 hover:bg-red-300/10"
                      >
                        Remove email
                      </button>
                    ) : null}
                  </div>
                )) : <p className="p-3 text-sm text-zinc-500">No matching existing access.</p>}
              </div>
            </section>
          ) : null}

          <div>
            <p className="text-sm text-zinc-300">Permission</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={submitting} onClick={() => setCanDownload(false)} className={`rounded-lg border p-3 text-left disabled:opacity-50 ${!canDownload ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <Shield className="h-4 w-4 text-[#d7ff3f]" />
                <p className="mt-2 text-sm font-medium text-white">View only</p>
                <p className="mt-1 text-xs text-zinc-500">Preview enabled, download hidden.</p>
              </button>
              <button type="button" disabled={submitting} onClick={() => setCanDownload(true)} className={`rounded-lg border p-3 text-left disabled:opacity-50 ${canDownload ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <Download className="h-4 w-4 text-[#d7ff3f]" />
                <p className="mt-2 text-sm font-medium text-white">View + Download</p>
                <p className="mt-1 text-xs text-zinc-500">Client can preview and download.</p>
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm text-zinc-300">Visibility</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={submitting} onClick={() => setVisibility("PUBLIC")} className={`rounded-lg border p-3 text-left disabled:opacity-50 ${visibility === "PUBLIC" ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <p className="text-sm font-medium text-white">Public link</p>
                <p className="mt-1 text-xs text-zinc-500">Anyone with the link can open it.</p>
              </button>
              <button type="button" disabled={submitting} onClick={() => setVisibility("PUBLIC_LOGIN")} className={`rounded-lg border p-3 text-left disabled:opacity-50 ${visibility === "PUBLIC_LOGIN" ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <p className="text-sm font-medium text-white">Private emails</p>
                <p className="mt-1 text-xs text-zinc-500">Login required, email must match whitelist.</p>
              </button>
            </div>
            {visibility === "PUBLIC_LOGIN" ? (
              <div className="mt-3">
                <span className="text-sm text-zinc-300">Allowed emails</span>
                <div className="mt-2">
                  <EmailChipsInput value={emails} onChange={setEmails} placeholder="client@example.com, team@example.com" disabled={submitting} />
                </div>
              </div>
            ) : null}
          </div>

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
                <button
                  key={value}
                  type="button"
                  onClick={() => setExpiry(value as typeof expiry)}
                  className={`rounded-lg border px-3 py-2 text-sm ${expiry === value ? "border-[#d7ff3f] bg-[#d7ff3f]/10 text-white" : "border-white/10 text-zinc-400"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {expiry === "custom" ? (
              <label className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <CalendarClock className="h-4 w-4 text-zinc-500" />
                <input type="datetime-local" value={customDate} onChange={(event) => setCustomDate(event.target.value)} className="w-full bg-transparent text-sm outline-none" />
              </label>
            ) : null}
          </div>

          <label className="block">
            <span className="text-sm text-zinc-300">Optional note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#d7ff3f]" />
          </label>

          {formError ? <p className="rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm text-red-100">{formError}</p> : null}
          <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? "Generating..." : "Generate Link"}
          </button>
        </form>

        {result ? (
          <div className="mt-5 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
            <p className="text-sm font-medium text-emerald-100">Share link ready</p>
            <p className="mt-2 break-all rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200">{result.url}</p>
            <div className="mt-3 grid gap-2 text-xs text-emerald-50/80 sm:grid-cols-3">
              <span>Permission: {result.permission}</span>
              <span>Expiry: {result.expiresAt ? formatDate(result.expiresAt) : "Never"}</span>
              <span>Emails: {result.allowedEmails.length ? result.allowedEmails.join(", ") : "Public"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => onCopy(result.url)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200"><Copy className="h-4 w-4" />Copy Link</button>
              <a href={result.url || `${origin}/share/${result.token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200"><ExternalLink className="h-4 w-4" />Open</a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UploadModal({
  open,
  files,
  uploading,
  progress,
  onClose,
  onFilesChange,
  onUpload,
}: {
  open: boolean;
  files: globalThis.File[];
  uploading: boolean;
  progress: number;
  onClose: () => void;
  onFilesChange: (files: globalThis.File[]) => void;
  onUpload: () => void;
}) {
  const [minimized, setMinimized] = useState(false);
  if (!open) return null;
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const allDone = progress >= 100 && !uploading;

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-[110] rounded-full border border-white/10 bg-[#101217] px-4 py-3 text-sm font-semibold text-white shadow-2xl md:right-6"
      >
        Uploading files {progress ? `${progress}%` : ""}
      </button>
    );
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[110] md:inset-x-auto md:right-6 md:w-[420px]">
      <div className="max-h-[70vh] w-full overflow-auto rounded-3xl border border-white/10 bg-[#101217]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#d7ff3f]">UPLOAD</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Uploading files</h2>
            <p className="mt-1 text-sm text-zinc-500">Files are added to the current folder.</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMinimized(true)} className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/10 hover:text-white">Min</button>
            <button type="button" onClick={onClose} disabled={uploading && !allDone} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label="Close upload panel">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/20 px-4 py-8 text-center hover:border-[#d7ff3f]/60">
          <Upload className="h-9 w-9 text-[#d7ff3f]" />
          <span className="mt-3 text-sm font-medium text-white">Choose files</span>
          <span className="mt-1 text-xs text-zinc-500">Multiple files supported. No overwrite by default.</span>
          <input
            key={files.length === 0 ? "empty-upload-input" : "selected-upload-input"}
            type="file"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(event) => onFilesChange(Array.from(event.target.files || []))}
          />
        </label>

        <div className="mt-4 rounded-lg border border-white/10 bg-black/20">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-zinc-500">
            <span>{files.length} selected</span>
            <span>{formatBytes(totalBytes)}</span>
          </div>
          {uploading ? (
            <div className="border-b border-white/10 px-3 py-3">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Uploading</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#d7ff3f]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
          <div className="max-h-56 overflow-auto">
            {files.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-zinc-500">No files selected.</p>
            ) : (
              files.map((file) => (
                <div key={`${file.name}-${file.size}-${file.lastModified}`} className="grid grid-cols-[minmax(0,1fr)_80px] gap-3 border-b border-white/10 px-3 py-2 last:border-0">
                  <div className="min-w-0">
                    <span className="truncate text-sm text-zinc-200" title={file.name}>{file.name}</span>
                    <p className="text-xs text-zinc-500">
                      {uploading ? "uploading" : progress >= 100 && /\.(mp4|mov|m4v|webm|avi|mkv|dxv)$/i.test(file.name) ? "queued for preview" : progress >= 100 ? "done" : "waiting"}
                    </p>
                  </div>
                  <span className="text-right text-xs text-zinc-500">{uploading ? `${progress}%` : formatBytes(file.size)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => onFilesChange([])} disabled={uploading || files.length === 0} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-40">
            Clear
          </button>
          <button type="button" onClick={onClose} disabled={uploading} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-40">
            Cancel
          </button>
          <button type="button" onClick={onUpload} disabled={uploading || files.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}

function TextInputModal({
  open,
  title,
  label,
  value,
  submitLabel,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  value: string;
  submitLabel: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/70 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="w-full rounded-t-xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:max-w-md md:rounded-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label={`Close ${title}`}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="mt-5 block">
          <span className="text-sm text-zinc-300">{label}</span>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            autoFocus
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#d7ff3f]"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">Cancel</button>
          <button disabled={!value.trim()} className="rounded-lg bg-[#d7ff3f] px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}

function MoveModal({
  open,
  count,
  targetFolder,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  count: number;
  targetFolder: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/70 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="w-full rounded-t-xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:max-w-lg md:rounded-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#d7ff3f]">MOVE</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Move {count} item(s)</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close move modal">
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="mt-5 block">
          <span className="text-sm text-zinc-300">Target folder path</span>
          <input
            value={targetFolder}
            onChange={(event) => onChange(event.target.value)}
            placeholder="relative/path/from/PublicShare"
            autoFocus
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#d7ff3f]"
          />
        </label>
        <p className="mt-2 text-xs text-zinc-500">Leave empty to move to PublicShare root. The server prevents moving outside ASSET_ROOT.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10">Cancel</button>
          <button className="rounded-lg bg-[#d7ff3f] px-4 py-2 text-sm font-semibold text-black">Move</button>
        </div>
      </form>
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  loading = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/70 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-4">
      <div className="w-full rounded-t-xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:max-w-md md:rounded-xl">
        <div className="flex items-start gap-3">
          <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${danger ? "bg-red-500/10 text-red-200" : "bg-[#d7ff3f]/10 text-[#d7ff3f]"}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={loading} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${danger ? "bg-red-400 text-black" : "bg-[#d7ff3f] text-black"}`}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function canRequestPreview(item: DriveItem) {
  return item.type === "video" && ["missing", "failed", "unsupported"].includes(item.previewStatus);
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
  onMoveItems: (paths: string[], targetFolder: string) => void;
  onDownloadSelected: () => void;
  onShareSelected: () => void;
  onDelete: (paths: string[]) => void;
  onShare: (rootPath: string) => void;
  onRequestPreview: (paths: string[]) => void;
  onCopy: (text: string) => void;
  onRetry: () => void;
}) {
  const selectedVideoPaths = props.selectedItems.filter(canRequestPreview).map((item) => item.path);

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
            <button onClick={() => props.onShare(props.currentPath)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"><Share2 className="h-4 w-4" />Share current</button>
            <button onClick={props.onSelectAll} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"><CheckSquare className="h-4 w-4" />Select all</button>
            <button onClick={props.onClear} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"><X className="h-4 w-4" />Clear</button>
            <ViewToggle value={props.viewMode} onChange={props.onToggleView} />
          </div>
        </div>
        {props.selectedPaths.size > 0 ? (
          <div className="sticky bottom-3 z-30 mt-3 flex flex-wrap gap-2 rounded-lg border border-white/10 bg-[#101217]/95 p-2 shadow-2xl backdrop-blur md:static md:border-t md:bg-transparent md:p-0 md:pt-3 md:shadow-none">
            <span className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200">{props.selectedPaths.size} selected</span>
            <button
              onClick={() => props.onRequestPreview(selectedVideoPaths)}
              disabled={selectedVideoPaths.length === 0}
              className="rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              Request preview
            </button>
            <button onClick={props.onDownloadSelected} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200"><Download className="h-4 w-4" />Download selected</button>
            <button onClick={props.onShareSelected} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200"><Share2 className="h-4 w-4" />Share</button>
            <button onClick={props.onMove} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200"><MoveRight className="h-4 w-4" />Move</button>
            <button onClick={() => props.onDelete(Array.from(props.selectedPaths))} className="inline-flex items-center gap-2 rounded-lg border border-red-300/20 px-3 py-2 text-sm text-red-200"><Trash2 className="h-4 w-4" />Delete</button>
            <button onClick={props.onClear} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200">Clear</button>
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
        ) : props.viewMode === "list" || props.viewMode === "compact" ? (
          <div className="divide-y divide-white/10">
            {props.filtered.map((item) => (
              <DriveRow key={item.path} item={item} checked={props.selectedPaths.has(item.path)} compact={props.viewMode === "compact"} {...props} />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {props.filtered.map((item) => (
              <DriveCard key={item.path} item={item} checked={props.selectedPaths.has(item.path)} {...props} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DriveRow({ item, checked, compact, ...props }: { item: DriveItem; checked: boolean; compact: boolean } & Parameters<typeof DriveView>[0]) {
  const dragPaths = checked ? Array.from(props.selectedPaths) : [item.path];
  return (
    <div
      draggable
      onDragStart={(event) => event.dataTransfer.setData("application/json", JSON.stringify(dragPaths))}
      onDragOver={(event) => {
        if (item.type === "folder") event.preventDefault();
      }}
      onDrop={(event) => {
        if (item.type !== "folder") return;
        event.preventDefault();
        const paths = JSON.parse(event.dataTransfer.getData("application/json") || "[]") as string[];
        props.onMoveItems(paths.filter((candidate) => candidate !== item.path), item.path);
      }}
      className={`grid gap-2 px-3 ${compact ? "py-1.5" : "py-2"} md:grid-cols-[42px_minmax(0,1fr)_90px_90px_120px_74px_44px] md:items-center ${item.type === "folder" ? "hover:bg-[#d7ff3f]/5" : ""}`}
    >
      <SelectionCheckbox checked={checked} onClick={() => props.onToggleSelect(item.path)} />
      <button onClick={() => item.type === "folder" ? props.onOpenFolder(item) : props.onPreview(item)} className="grid min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-3 text-left">
        <FileThumbnail item={item} size="row" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-white" title={item.name}>{item.name}</span>
          <span className="mt-1 block truncate text-xs text-zinc-500">{typeLabel(item)} - {previewStatusLabel(item)} - {downloadModeLabel(item)}</span>
        </span>
      </button>
      <span className="hidden text-sm text-zinc-400 md:block">{typeLabel(item)}</span>
      <span className="hidden text-right text-sm text-zinc-500 md:block">{item.size || "-"}</span>
      <span className="hidden md:block"><PreviewStatusBadge item={item} /></span>
      <span className="hidden md:block"><DownloadModeBadge item={item} /></span>
      <ItemActions item={item} {...props} />
    </div>
  );
}

function DriveCard({ item, checked, ...props }: { item: DriveItem; checked: boolean } & Parameters<typeof DriveView>[0]) {
  const dragPaths = checked ? Array.from(props.selectedPaths) : [item.path];
  return (
    <div
      draggable
      onDragStart={(event) => event.dataTransfer.setData("application/json", JSON.stringify(dragPaths))}
      onDragOver={(event) => {
        if (item.type === "folder") event.preventDefault();
      }}
      onDrop={(event) => {
        if (item.type !== "folder") return;
        event.preventDefault();
        const paths = JSON.parse(event.dataTransfer.getData("application/json") || "[]") as string[];
        props.onMoveItems(paths.filter((candidate) => candidate !== item.path), item.path);
      }}
      className="group flex min-h-[230px] flex-col rounded-lg border border-white/10 bg-black/20 p-3 transition hover:border-[#d7ff3f]/40 hover:bg-white/[0.05]"
    >
      <div className="mb-3 flex items-center justify-between">
        <SelectionCheckbox checked={checked} onClick={() => props.onToggleSelect(item.path)} />
        <ItemActions item={item} {...props} />
      </div>
      <button onClick={() => item.type === "folder" ? props.onOpenFolder(item) : props.onPreview(item)} className="flex flex-1 flex-col text-left">
        <FileThumbnail item={item} />
        <span className="mt-3 line-clamp-2 min-h-10 text-sm font-medium text-white" title={item.name}>{item.name}</span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-300">{typeLabel(item)}</span>
          <PreviewStatusBadge item={item} />
        </span>
        <span className="mt-auto pt-2 text-xs text-zinc-500">{item.size || "Folder"}</span>
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
        {canRequestPreview(item) ? (
          <button onClick={() => props.onRequestPreview([item.path])} className="menu-btn"><RotateCw className="h-4 w-4" />Request preview</button>
        ) : null}
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
      <aside className="hidden rounded-lg border border-white/10 bg-white/[0.035] p-4 xl:sticky xl:top-24 xl:block xl:h-[calc(100vh-7rem)]">
        <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 text-center text-zinc-500">
          <File className="h-9 w-9" />
          <p className="text-sm">Select a file to preview details.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden rounded-lg border border-white/10 bg-white/[0.035] p-4 xl:sticky xl:top-24 xl:block xl:max-h-[calc(100vh-7rem)] xl:overflow-auto">
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
