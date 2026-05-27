"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  CheckSquare,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  File,
  Folder,
  FolderPlus,
  HardDrive,
  Home,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Search,
  Share2,
  Sparkles,
  Square,
  Trash2,
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
  SelectionCheckbox,
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

type UploadStatus = "pending" | "uploading" | "uploaded" | "failed";

type UploadSelection = {
  id: string;
  file: File;
  name: string;
  relativePath: string;
  status: UploadStatus;
  error?: string;
};

type FileSystemEntryLike = {
  name: string;
  fullPath?: string;
  isFile: boolean;
  isDirectory: boolean;
};

type FileSystemFileEntryLike = FileSystemEntryLike & {
  file: (success: (file: File) => void, error?: (error: DOMException) => void) => void;
};

type FileSystemDirectoryEntryLike = FileSystemEntryLike & {
  createReader: () => {
    readEntries: (success: (entries: FileSystemEntryLike[]) => void, error?: (error: DOMException) => void) => void;
  };
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntryLike | null;
};

function uploadId(file: File, relativePath: string) {
  return `${relativePath || file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
}

function fileFromEntry(entry: FileSystemFileEntryLike) {
  return new Promise<File>((resolve, reject) => entry.file(resolve, reject));
}

function readDirectoryEntries(entry: FileSystemDirectoryEntryLike) {
  const reader = entry.createReader();
  const entries: FileSystemEntryLike[] = [];

  return new Promise<FileSystemEntryLike[]>((resolve, reject) => {
    function readBatch() {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readBatch();
      }, reject);
    }

    readBatch();
  });
}

async function selectionsFromEntry(entry: FileSystemEntryLike, parentPath = ""): Promise<UploadSelection[]> {
  const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

  if (entry.isFile) {
    const file = await fileFromEntry(entry as FileSystemFileEntryLike);
    return [{ id: uploadId(file, relativePath), file, name: file.name, relativePath, status: "pending" }];
  }

  if (entry.isDirectory) {
    const children = await readDirectoryEntries(entry as FileSystemDirectoryEntryLike);
    const nested = await Promise.all(children.map((child) => selectionsFromEntry(child, relativePath)));
    return nested.flat();
  }

  return [];
}

async function selectionsFromFileList(files: FileList | File[], folderUpload = false) {
  return Array.from(files).map((file) => {
    const relativePath = folderUpload ? (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name : file.name;
    return { id: uploadId(file, relativePath), file, name: file.name, relativePath, status: "pending" as const };
  });
}

async function selectionsFromDrop(dataTransfer: DataTransfer) {
  const entryItems = Array.from(dataTransfer.items || [])
    .map((item) => (item as DataTransferItemWithEntry).webkitGetAsEntry?.() as FileSystemEntryLike | null | undefined)
    .filter((entry): entry is FileSystemEntryLike => Boolean(entry));

  if (entryItems.length) {
    const nested = await Promise.all(entryItems.map((entry) => selectionsFromEntry(entry)));
    return nested.flat();
  }

  return selectionsFromFileList(dataTransfer.files || []);
}

function suggestSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/drive", label: "My Drive", icon: HardDrive, active: true },
  { href: "/beauty", label: "Beauty Shares", icon: Sparkles },
  { href: "/shared", label: "Shared with Me", icon: Share2 },
  { href: "/account", label: "Account", icon: User },
];

export function UserDriveClient({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<DriveItem[]>([]);
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadSelections, setUploadSelections] = useState<UploadSelection[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<DriveItem | null>(null);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DriveItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

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
      setSelectedPaths(new Set());
      return;
    }

    setNotice(data.message || "Failed to load drive.");
  }, []);

  function addUploadSelections(next: UploadSelection[]) {
    if (!next.length) return;
    setUploadSelections((current) => [...current, ...next]);
    setUploadModalOpen(true);
    setNotice("");
  }

  async function addFiles(files: FileList | null, folderUpload = false) {
    if (!files?.length) return;
    addUploadSelections(await selectionsFromFileList(files, folderUpload));
  }

  async function uploadOne(selection: UploadSelection) {
    const form = new FormData();
    form.set("path", path);
    form.append("files", selection.file);
    form.append("relativePaths", selection.relativePath || selection.file.name);

    const res = await fetch("/api/files/upload", {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      throw new Error(data.message || "Upload failed.");
    }
  }

  async function uploadSelected() {
    if (uploading) return;
    const pending = uploadSelections.filter((item) => item.status === "pending" || item.status === "failed");
    if (!pending.length) return;

    setUploading(true);
    setNotice("");
    setUploadSelections((current) =>
      current.map((item) => (item.status === "failed" ? { ...item, status: "pending", error: undefined } : item))
    );

    let cursor = 0;
    const concurrency = Math.min(3, pending.length);

    async function worker() {
      for (;;) {
        const index = cursor;
        cursor += 1;
        const selection = pending[index];
        if (!selection) return;

        setUploadSelections((current) =>
          current.map((item) => (item.id === selection.id ? { ...item, status: "uploading", error: undefined } : item))
        );

        try {
          await uploadOne(selection);
          setUploadSelections((current) =>
            current.map((item) => (item.id === selection.id ? { ...item, status: "uploaded", error: undefined } : item))
          );
        } catch (caught) {
          setUploadSelections((current) =>
            current.map((item) =>
              item.id === selection.id
                ? { ...item, status: "failed", error: caught instanceof Error ? caught.message : "Upload failed." }
                : item
            )
          );
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    setUploading(false);
    await load(path);
  }

  function currentFolderItem(): DriveItem {
    return {
      name: path || "Home",
      path,
      type: "folder",
      extension: "",
      size: null,
      bytes: 0,
      modified: new Date().toISOString(),
      canPreview: false,
      previewStatus: "unsupported",
      previewUrl: null,
      thumbnailUrl: null,
      originalUrl: `/api/user/files/list?path=${encodeURIComponent(path)}`,
      directDownloadUrl: null,
      downloadMode: "app",
    };
  }

  function toggleSelect(itemPath: string) {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(itemPath)) next.delete(itemPath);
      else next.add(itemPath);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedPaths(new Set(filteredItems.map((item) => item.path)));
  }

  function clearSelection() {
    setSelectedPaths(new Set());
  }

  async function createFolder() {
    if (creatingFolder) return;
    const name = newFolderName.trim();
    if (!name) {
      setNotice("Folder name is required.");
      return;
    }

    setCreatingFolder(true);
    setNotice("");

    const res = await fetch("/api/user/files/folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, name }),
    });
    const data = await res.json().catch(() => ({}));
    setCreatingFolder(false);

    if (!res.ok || !data.ok) {
      setNotice(data.message || "Create folder failed.");
      return;
    }

    setFolderModalOpen(false);
    setNewFolderName("");
    setNotice("Folder created.");
    await load(path);
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/";
  }

  async function deleteItem() {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    setNotice("");

    const res = await fetch("/api/user/files/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: deleteTarget.path,
        type: deleteTarget.type === "folder" ? "folder" : "file",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);

    if (!res.ok || !data.ok) {
      setNotice(data.message || "Delete failed.");
      return;
    }

    setDeleteTarget(null);
    setNotice("Deleted.");
    await load(path);
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

          <UserDriveToolbar
            selectedCount={selectedPaths.size}
            visibleCount={filteredItems.length}
            viewMode={viewMode}
            setViewMode={setViewMode}
            uploading={uploading}
            onNewFolder={() => setFolderModalOpen(true)}
            onOpenUpload={() => setUploadModalOpen(true)}
            onShareCurrent={() => {
              setShareTarget(currentFolderItem());
              setShareResult(null);
            }}
            onSelectAll={selectAllVisible}
            onClear={clearSelection}
          />

          <FileList
            loading={loading}
            filteredItems={filteredItems}
            selectedPaths={selectedPaths}
            viewMode={viewMode}
            load={load}
            setPreviewItem={setPreviewItem}
            toggleSelect={toggleSelect}
            setShareTarget={(item) => {
              setShareTarget(item);
              setShareResult(null);
            }}
            setDeleteTarget={setDeleteTarget}
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

        <UploadModal
          open={uploadModalOpen}
          path={path}
          selections={uploadSelections}
          uploading={uploading}
          onAddFiles={(files, folderUpload) => void addFiles(files, folderUpload)}
          onDropFiles={(dataTransfer) => void selectionsFromDrop(dataTransfer).then(addUploadSelections)}
          onClear={() => setUploadSelections([])}
          onRemove={(id) => setUploadSelections((current) => current.filter((item) => item.id !== id))}
          onUpload={() => void uploadSelected()}
          onClose={() => {
            if (!uploading) setUploadModalOpen(false);
          }}
        />

        <DeleteConfirmModal
          item={deleteTarget}
          deleting={deleting}
          onClose={() => {
            if (!deleting) setDeleteTarget(null);
          }}
          onConfirm={() => void deleteItem()}
        />

        <NewFolderModal
          open={folderModalOpen}
          value={newFolderName}
          creating={creatingFolder}
          onChange={setNewFolderName}
          onClose={() => {
            if (!creatingFolder) setFolderModalOpen(false);
          }}
          onConfirm={() => void createFolder()}
        />
      </>
    );
  }

  return (
    <main className="drive-user-theme min-h-screen bg-[#08090d] text-zinc-100">
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

            <button
              type="button"
              onClick={() => setFolderModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black transition hover:bg-[#c8ef34]"
            >
              <FolderPlus className="h-4 w-4" />
              <span className="hidden sm:inline">New Folder</span>
            </button>
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

            <UserDriveToolbar
              selectedCount={selectedPaths.size}
              visibleCount={filteredItems.length}
              viewMode={viewMode}
              setViewMode={setViewMode}
              uploading={uploading}
              onNewFolder={() => setFolderModalOpen(true)}
              onOpenUpload={() => setUploadModalOpen(true)}
              onShareCurrent={() => {
                setShareTarget(currentFolderItem());
                setShareResult(null);
              }}
              onSelectAll={selectAllVisible}
              onClear={clearSelection}
            />

            <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/20">
              <div className="border-b border-white/10 p-3">
                <div>
                  <p className="text-sm font-black text-white">Files</p>
                  <p className="mt-1 text-xs text-zinc-500">Open, preview, download, or share your own files.</p>
                </div>
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
                        {item.type === "folder" ? (
                          <a href={`/api/user/files/zip?path=${encodeURIComponent(item.path)}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white">
                            <Download className="h-4 w-4" />
                            Download
                          </a>
                        ) : item.directDownloadUrl ? (
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
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300/20 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-300/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
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

      <UploadModal
        open={uploadModalOpen}
        path={path}
        selections={uploadSelections}
        uploading={uploading}
        onAddFiles={(files, folderUpload) => void addFiles(files, folderUpload)}
        onDropFiles={(dataTransfer) => void selectionsFromDrop(dataTransfer).then(addUploadSelections)}
        onClear={() => setUploadSelections([])}
        onRemove={(id) => setUploadSelections((current) => current.filter((item) => item.id !== id))}
        onUpload={() => void uploadSelected()}
        onClose={() => {
          if (!uploading) setUploadModalOpen(false);
        }}
      />

      <DeleteConfirmModal
        item={deleteTarget}
        deleting={deleting}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void deleteItem()}
      />

      <NewFolderModal
        open={folderModalOpen}
        value={newFolderName}
        creating={creatingFolder}
        onChange={setNewFolderName}
        onClose={() => {
          if (!creatingFolder) setFolderModalOpen(false);
        }}
        onConfirm={() => void createFolder()}
      />
    </main>
  );
}

function UserDriveToolbar({
  selectedCount,
  visibleCount,
  viewMode,
  setViewMode,
  uploading,
  onNewFolder,
  onOpenUpload,
  onShareCurrent,
  onSelectAll,
  onClear,
}: {
  selectedCount: number;
  visibleCount: number;
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
  uploading: boolean;
  onNewFolder: () => void;
  onOpenUpload: () => void;
  onShareCurrent: () => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-3 shadow-2xl shadow-black/10">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onNewFolder}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black transition hover:bg-[#c8ef34]"
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>

          <button
            type="button"
            onClick={onOpenUpload}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>

          <button
            type="button"
            onClick={onShareCurrent}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <Share2 className="h-4 w-4" />
            Share current
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={!visibleCount}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckSquare className="h-4 w-4" />
            Select all
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!selectedCount}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Square className="h-4 w-4" />
            Clear
          </button>
          <span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-zinc-500">
            {selectedCount ? `${selectedCount} selected` : `${visibleCount} visible`}
          </span>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>
    </section>
  );
}

function FileList({
  loading,
  filteredItems,
  selectedPaths,
  viewMode,
  load,
  setPreviewItem,
  toggleSelect,
  setShareTarget,
  setDeleteTarget,
}: {
  loading: boolean;
  filteredItems: DriveItem[];
  selectedPaths: Set<string>;
  viewMode: ViewMode;
  load: (path: string) => Promise<void>;
  setPreviewItem: (item: DriveItem) => void;
  toggleSelect: (path: string) => void;
  setShareTarget: (item: DriveItem) => void;
  setDeleteTarget: (item: DriveItem) => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/20">
      <div className="border-b border-white/10 p-3">
        <div>
          <p className="text-sm font-black text-white">Files</p>
          <p className="mt-1 text-xs text-zinc-500">Open, preview, download, or share your own files.</p>
        </div>
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
                ? `rounded-3xl border p-3 transition hover:bg-white/[0.05] ${selectedPaths.has(item.path) ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`
                : `grid w-full grid-cols-[42px_42px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04] md:grid-cols-[42px_42px_minmax(0,1fr)_120px_120px_250px] ${selectedPaths.has(item.path) ? "bg-[#d7ff3f]/10" : ""}`}
            >
              <SelectionCheckbox checked={selectedPaths.has(item.path)} onClick={() => toggleSelect(item.path)} />
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
                {item.type === "folder" ? (
                  <a href={`/api/user/files/zip?path=${encodeURIComponent(item.path)}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white">
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                ) : item.directDownloadUrl ? (
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
                <button
                  onClick={() => setDeleteTarget(item)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300/20 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-300/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function UploadModal({
  open,
  path,
  selections,
  uploading,
  onAddFiles,
  onDropFiles,
  onClear,
  onRemove,
  onUpload,
  onClose,
}: {
  open: boolean;
  path: string;
  selections: UploadSelection[];
  uploading: boolean;
  onAddFiles: (files: FileList | null, folderUpload?: boolean) => void;
  onDropFiles: (dataTransfer: DataTransfer) => void;
  onClear: () => void;
  onRemove: (id: string) => void;
  onUpload: () => void;
  onClose: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  if (!open) return null;

  const total = selections.length;
  const uploaded = selections.filter((item) => item.status === "uploaded").length;
  const failed = selections.filter((item) => item.status === "failed").length;
  const pending = selections.filter((item) => item.status === "pending").length;
  const current = selections.find((item) => item.status === "uploading");
  const complete = total > 0 && uploaded + failed === total && !uploading;
  const title = complete ? (failed ? "Upload partially complete" : "Upload complete") : uploading ? "Uploading files" : "Upload files";
  const percent = total ? Math.round((uploaded / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/70 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-4">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-3xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:max-w-2xl md:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff3f]">Current folder: {path || "Home"}</p>
            <h2 className="mt-2 text-xl font-black text-white">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {total ? `${uploaded} / ${total} uploaded` : "Drag files here or choose files from your device."}
              {failed ? ` · ${failed} failed` : ""}
            </p>
          </div>
          <button onClick={onClose} disabled={uploading} className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-50" aria-label="Close upload modal">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            onDropFiles(event.dataTransfer);
          }}
          className={`mt-5 rounded-3xl border border-dashed p-6 text-center transition ${
            dragActive ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/15 bg-black/20"
          }`}
        >
          <Upload className="mx-auto h-8 w-8 text-[#d7ff3f]" />
          <p className="mt-3 font-black text-white">Drag and drop files or folders</p>
          <p className="mt-1 text-sm text-zinc-500">Folder paths are preserved when your browser provides them.</p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black">
              <File className="h-4 w-4" />
              Browse files
              <input
                type="file"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  onAddFiles(event.target.files, false);
                  event.currentTarget.value = "";
                }}
              />
            </label>

            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10">
              <Folder className="h-4 w-4" />
              Browse folder
              <input
                type="file"
                multiple
                className="hidden"
                disabled={uploading}
                {...{ webkitdirectory: "", directory: "" }}
                onChange={(event) => {
                  onAddFiles(event.target.files, true);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {total ? (
          <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">{uploaded} / {total} uploaded</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Current: {current?.name || (complete ? "Done" : pending ? "Ready" : "-")} · Failed: {failed}
                </p>
              </div>
              <span className="text-sm font-black text-[#d7ff3f]">{percent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#d7ff3f] transition-all" style={{ width: `${percent}%` }} />
            </div>

            <div className="mt-4 max-h-56 space-y-2 overflow-auto pr-1">
              {selections.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#08090d] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{item.relativePath || item.name}</p>
                    {item.error ? <p className="mt-1 text-xs text-red-200">{item.error}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                      item.status === "uploaded"
                        ? "bg-[#d7ff3f]/10 text-[#d7ff3f]"
                        : item.status === "failed"
                          ? "bg-red-300/10 text-red-100"
                          : item.status === "uploading"
                            ? "bg-blue-300/10 text-blue-100"
                            : "bg-white/10 text-zinc-400"
                    }`}>
                      {item.status}
                    </span>
                    {!uploading && item.status !== "uploaded" ? (
                      <button type="button" onClick={() => onRemove(item.id)} className="rounded-lg p-1 text-zinc-500 hover:bg-white/10 hover:text-white" aria-label={`Remove ${item.name}`}>
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClear} disabled={uploading || !total} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-50">
            Clear selected files
          </button>
          <button type="button" onClick={onClose} disabled={uploading} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-50">
            Close
          </button>
          <button type="button" onClick={onUpload} disabled={uploading || !selections.some((item) => item.status === "pending" || item.status === "failed")} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-60">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {failed && !uploading ? "Retry failed" : uploading ? "Uploading..." : "Upload selected files"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  item,
  deleting,
  onClose,
  onConfirm,
}: {
  item: DriveItem | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/70 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-4">
      <div className="w-full rounded-t-3xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:max-w-md md:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-200">Confirm delete</p>
            <h2 className="mt-2 text-xl font-black text-white">{item.name}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              This will remove the selected {item.type === "folder" ? "folder and its contents" : "file"} from your drive.
            </p>
          </div>
          <button onClick={onClose} disabled={deleting} className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-50" aria-label="Close delete confirmation">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={deleting} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-400 px-4 py-3 text-sm font-black text-black disabled:opacity-60">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewFolderModal({
  open,
  value,
  creating,
  onChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  value: string;
  creating: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/70 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-4">
      <div className="w-full rounded-t-3xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:max-w-md md:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff3f]">New Folder</p>
            <h2 className="mt-2 text-xl font-black text-white">Create folder</h2>
            <p className="mt-1 text-sm text-zinc-500">Folder will be created inside your current drive path.</p>
          </div>
          <button onClick={onClose} disabled={creating} className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-50" aria-label="Close folder modal">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-5 block">
          <span className="text-sm text-zinc-300">Folder name</span>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onConfirm();
            }}
            autoFocus
            placeholder="Client delivery"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50"
          />
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={creating} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={creating} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black disabled:opacity-60">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            {creating ? "Creating..." : "Create Folder"}
          </button>
        </div>
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
  const [shareType, setShareType] = useState<"standard" | "private" | "beauty">("standard");
  const [permission, setPermission] = useState<"VIEW_ONLY" | "DOWNLOAD">("DOWNLOAD");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE_EMAILS">("PUBLIC");
  const [emails, setEmails] = useState<string[]>([]);
  const [expiry, setExpiry] = useState<"never" | "1d" | "7d" | "30d" | "custom">("never");
  const [customDate, setCustomDate] = useState("");
  const [note, setNote] = useState("");
  const [beautyClientName, setBeautyClientName] = useState("");
  const [beautySlug, setBeautySlug] = useState("");
  const [beautySubtitle, setBeautySubtitle] = useState("Your files are ready.");
  const [beautyTheme, setBeautyTheme] = useState<"light" | "dark">("light");
  const [beautyLayout, setBeautyLayout] = useState<"collage" | "grid">("collage");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!item) return;
    setTitle("");
    setShareType("standard");
    setVisibility("PUBLIC");
    setEmails([]);
    setNote("");
    setBeautyClientName(item.name);
    setBeautySlug(suggestSlug(item.name));
    setBeautySubtitle("Your files are ready.");
    setBeautyTheme("light");
    setBeautyLayout("collage");
    setError("");
  }, [item]);

  if (!item) return null;
  const activeItem = item;

  function setBeautyName(value: string) {
    setBeautyClientName(value);
    setTitle(value);
    setBeautySlug(suggestSlug(value));
  }

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

  async function createBeautyShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (activeItem.type !== "folder") {
      setError("Beauty Share is available for folders.");
      return;
    }

    setSubmitting(true);
    setError("");

    const name = beautyClientName.trim() || activeItem.name;
    const res = await fetch("/api/beauty-shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rootPath: activeItem.path,
        slug: beautySlug || suggestSlug(name),
        title: title.trim() || name,
        subtitle: beautySubtitle,
        clientName: name,
        theme: beautyTheme,
        layout: beautyLayout,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok || !data.ok) {
      setError(data.message || "Create Beauty Share failed.");
      return;
    }

    onCreated({
      url: `${window.location.origin}${data.publicUrl}`,
      token: data.share?.slug || beautySlug,
      permission: "BEAUTY_SHARE",
      expiresAt: null,
      allowedEmails: [],
      failedEmails: [],
    });
    onNotice("Beauty Share link created.");
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
                <span>{result.permission === "BEAUTY_SHARE" ? "Public no login" : result.allowedEmails.length ? result.allowedEmails.join(", ") : "Public login"}</span>
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
          <div className="mt-5 space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => { setShareType("standard"); setVisibility("PUBLIC"); }} className={`rounded-2xl border p-3 text-left ${shareType === "standard" ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <p className="font-bold text-white">Standard Link</p>
                <p className="mt-1 text-xs text-zinc-500">Login-protected public link.</p>
              </button>
              <button type="button" onClick={() => { setShareType("private"); setVisibility("PRIVATE_EMAILS"); }} className={`rounded-2xl border p-3 text-left ${shareType === "private" ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <p className="font-bold text-white">Private Email</p>
                <p className="mt-1 text-xs text-zinc-500">Only allowed emails.</p>
              </button>
              <button type="button" onClick={() => { setShareType("beauty"); setError(""); }} className={`rounded-2xl border p-3 text-left ${shareType === "beauty" ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <Sparkles className="h-4 w-4 text-[#d7ff3f]" />
                <p className="mt-2 font-bold text-white">Beauty Share</p>
              </button>
            </div>

            {shareType === "beauty" ? (
              <form onSubmit={createBeautyShare} className="space-y-4">
                {activeItem.type !== "folder" ? (
                  <p className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                    Beauty Share is available for folders.
                  </p>
                ) : null}
                <label className="block">
                  <span className="text-sm text-zinc-300">Client / Project Name</span>
                  <input value={beautyClientName} onChange={(event) => setBeautyName(event.target.value)} placeholder={activeItem.name} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-zinc-300">Slug</span>
                    <input value={beautySlug} onChange={(event) => setBeautySlug(suggestSlug(event.target.value))} placeholder={suggestSlug(activeItem.name)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50" />
                  </label>
                  <label className="block">
                    <span className="text-sm text-zinc-300">Title</span>
                    <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={beautyClientName || activeItem.name} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50" />
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm text-zinc-300">Subtitle</span>
                  <input value={beautySubtitle} onChange={(event) => setBeautySubtitle(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50" />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-zinc-300">Theme</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(["light", "dark"] as const).map((value) => (
                        <button key={value} type="button" onClick={() => setBeautyTheme(value)} className={`rounded-xl border px-3 py-2 text-sm capitalize ${beautyTheme === value ? "border-[#d7ff3f] bg-[#d7ff3f]/10 text-white" : "border-white/10 text-zinc-400"}`}>
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-300">Layout</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(["collage", "grid"] as const).map((value) => (
                        <button key={value} type="button" onClick={() => setBeautyLayout(value)} className={`rounded-xl border px-3 py-2 text-sm capitalize ${beautyLayout === value ? "border-[#d7ff3f] bg-[#d7ff3f]/10 text-white" : "border-white/10 text-zinc-400"}`}>
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {error ? <p className="rounded-2xl border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
                <button disabled={submitting || activeItem.type !== "folder"} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {submitting ? "Creating..." : "Create Beauty Link"}
                </button>
              </form>
            ) : (
              <form onSubmit={createShare} className="space-y-4">
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
        )}
      </div>
    </div>
  );
}
