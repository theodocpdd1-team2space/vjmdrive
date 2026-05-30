"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type UploadStatus = "pending" | "queued" | "uploading" | "uploaded" | "failed";

type UploadSelection = {
  id: string;
  file: File;
  name: string;
  relativePath: string;
  size: number;
  uploadedBytes: number;
  totalBytes: number;
  percent: number;
  status: UploadStatus;
  speedBytesPerSecond: number;
  etaSeconds: number | null;
  progressMessage?: string;
  errorMessage?: string;
};

type UploadProgress = {
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  speedBytesPerSecond: number;
  etaSeconds: number | null;
};

type UploadApiResponse = {
  ok?: boolean;
  message?: string;
  uploaded?: string[];
  [key: string]: unknown;
};

type ChunkInitResponse = UploadApiResponse & {
  uploadId?: string;
  chunkSize?: number;
  totalChunks?: number;
};

type UploadTotals = {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  activeFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  totalPercent: number;
  totalSpeedBytesPerSecond: number;
  totalEtaSeconds: number | null;
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

const CHUNK_UPLOAD_THRESHOLD = 80 * 1024 * 1024;
const CHUNK_SIZE = 10 * 1024 * 1024;

function uploadId(file: File, relativePath: string) {
  return `${relativePath || file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
}

function createUploadSelection(file: File, relativePath: string): UploadSelection {
  return {
    id: uploadId(file, relativePath),
    file,
    name: file.name,
    relativePath,
    size: file.size,
    uploadedBytes: 0,
    totalBytes: file.size,
    percent: 0,
    status: "pending",
    speedBytesPerSecond: 0,
    etaSeconds: null,
  };
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
    return [createUploadSelection(file, relativePath)];
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
    return createUploadSelection(file, relativePath);
  });
}

function uploadSingleFileWithProgress({
  file,
  currentFolder,
  relativePath,
  onProgress,
}: {
  file: File;
  currentFolder: string;
  relativePath: string;
  onProgress: (progress: UploadProgress) => void;
}) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const form = new FormData();
    form.set("path", currentFolder);
    form.append("files", file);
    form.append("relativePaths", relativePath || file.name);

    const xhr = new XMLHttpRequest();
    const startedAt = performance.now();

    xhr.upload.onprogress = (event) => {
      const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
      const requestTotal = event.lengthComputable ? event.total : file.size;
      const rawPercent = requestTotal ? (event.loaded / requestTotal) * 100 : 0;
      const scaledBytes = requestTotal ? (event.loaded / requestTotal) * file.size : event.loaded;
      const loadedBytes = file.size > 0 ? Math.min(file.size - 1, Math.max(0, scaledBytes)) : 0;
      const speedBytesPerSecond = loadedBytes / elapsedSeconds;
      const remainingBytes = Math.max(file.size - loadedBytes, 0);

      onProgress({
        loadedBytes,
        totalBytes: file.size,
        percent: Math.min(99, Math.max(0, rawPercent)),
        speedBytesPerSecond,
        etaSeconds: speedBytesPerSecond > 0 ? remainingBytes / speedBytesPerSecond : null,
      });
    };

    xhr.onload = () => {
      let data: UploadApiResponse = {};
      try {
        data = xhr.responseText ? (JSON.parse(xhr.responseText) as UploadApiResponse) : {};
      } catch {
        data = {};
      }

      if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
        resolve(data);
        return;
      }

      reject(new Error(data.message || "Upload failed."));
    };

    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.onabort = () => reject(new Error("Upload canceled."));
    xhr.open("POST", "/api/files/upload");
    xhr.send(form);
  });
}

function uploadChunkRequest({
  uploadId,
  chunkIndex,
  chunk,
  onProgress,
}: {
  uploadId: string;
  chunkIndex: number;
  chunk: Blob;
  onProgress: (loadedBytes: number) => void;
}) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const form = new FormData();
    form.set("uploadId", uploadId);
    form.set("chunkIndex", String(chunkIndex));
    form.append("chunk", chunk, `chunk-${chunkIndex}.part`);

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      onProgress(Math.min(event.loaded, chunk.size));
    };
    xhr.onload = () => {
      let data: UploadApiResponse = {};
      try {
        data = xhr.responseText ? (JSON.parse(xhr.responseText) as UploadApiResponse) : {};
      } catch {
        data = {};
      }

      if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
        resolve(data);
        return;
      }

      reject(new Error(data.message || `Chunk ${chunkIndex + 1} upload failed.`));
    };
    xhr.onerror = () => reject(new Error(`Network error while uploading chunk ${chunkIndex + 1}.`));
    xhr.onabort = () => reject(new Error(`Chunk ${chunkIndex + 1} upload canceled.`));
    xhr.open("POST", "/api/files/upload/chunk");
    xhr.send(form);
  });
}

async function postUploadJson<T extends UploadApiResponse>(url: string, body: Record<string, unknown>, fallbackMessage: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok || !data.ok) throw new Error(data.message || fallbackMessage);
  return data;
}

async function abortChunkUpload(uploadId: string) {
  await fetch("/api/files/upload/abort", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId }),
  }).catch(() => undefined);
}

async function uploadChunkedFileWithProgress({
  file,
  currentFolder,
  relativePath,
  onProgress,
}: {
  file: File;
  currentFolder: string;
  relativePath: string;
  onProgress: (progress: UploadProgress & { message?: string }) => void;
}) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const startedAt = performance.now();
  let uploadId = "";

  function emitProgress(loadedBytes: number, message: string) {
    const safeLoadedBytes = file.size > 0 ? Math.min(file.size - 1, Math.max(0, loadedBytes)) : 0;
    const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
    const speedBytesPerSecond = safeLoadedBytes / elapsedSeconds;
    const remainingBytes = Math.max(file.size - safeLoadedBytes, 0);

    onProgress({
      loadedBytes: safeLoadedBytes,
      totalBytes: file.size,
      percent: file.size ? Math.min(99, (safeLoadedBytes / file.size) * 100) : 0,
      speedBytesPerSecond,
      etaSeconds: speedBytesPerSecond > 0 ? remainingBytes / speedBytesPerSecond : null,
      message,
    });
  }

  try {
    const init = await postUploadJson<ChunkInitResponse>(
      "/api/files/upload/init",
      {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        currentPath: currentFolder,
        relativePath: relativePath || file.name,
        totalChunks,
        chunkSize: CHUNK_SIZE,
      },
      "Upload init failed."
    );

    if (!init.uploadId) throw new Error("Upload init failed.");
    uploadId = init.uploadId;
    const serverChunkSize = init.chunkSize || CHUNK_SIZE;
    const serverTotalChunks = init.totalChunks || totalChunks;
    let completedBytes = 0;

    for (let chunkIndex = 0; chunkIndex < serverTotalChunks; chunkIndex += 1) {
      const start = chunkIndex * serverChunkSize;
      const end = Math.min(start + serverChunkSize, file.size);
      const chunk = file.slice(start, end);
      const message = `Uploading chunk ${chunkIndex + 1} / ${serverTotalChunks}`;

      emitProgress(completedBytes, message);
      await uploadChunkRequest({
        uploadId,
        chunkIndex,
        chunk,
        onProgress: (chunkLoadedBytes) => emitProgress(completedBytes + chunkLoadedBytes, message),
      });
      completedBytes += chunk.size;
      emitProgress(completedBytes, message);
    }

    emitProgress(file.size, "Finalizing upload...");
    const completed = await postUploadJson<UploadApiResponse>(
      "/api/files/upload/complete",
      { uploadId },
      "Upload finalizing failed."
    );
    onProgress({
      loadedBytes: file.size,
      totalBytes: file.size,
      percent: 100,
      speedBytesPerSecond: 0,
      etaSeconds: null,
      message: "Queued for preview after complete",
    });
    return completed;
  } catch (caught) {
    if (uploadId) await abortChunkUpload(uploadId);
    throw caught;
  }
}

function uploadFileWithProgress({
  file,
  currentFolder,
  relativePath,
  onProgress,
}: {
  file: File;
  currentFolder: string;
  relativePath: string;
  onProgress: (progress: UploadProgress & { message?: string }) => void;
}) {
  if (file.size > CHUNK_UPLOAD_THRESHOLD) {
    return uploadChunkedFileWithProgress({ file, currentFolder, relativePath, onProgress });
  }

  return uploadSingleFileWithProgress({ file, currentFolder, relativePath, onProgress });
}

function calculateUploadTotals(selections: UploadSelection[]): UploadTotals {
  const totalBytes = selections.reduce((sum, item) => sum + item.totalBytes, 0);
  const uploadedBytes = selections.reduce((sum, item) => sum + Math.min(item.uploadedBytes, item.totalBytes), 0);
  const totalSpeedBytesPerSecond = selections
    .filter((item) => item.status === "uploading")
    .reduce((sum, item) => sum + item.speedBytesPerSecond, 0);
  const remainingBytes = Math.max(totalBytes - uploadedBytes, 0);

  return {
    totalFiles: selections.length,
    completedFiles: selections.filter((item) => item.status === "uploaded").length,
    failedFiles: selections.filter((item) => item.status === "failed").length,
    activeFiles: selections.filter((item) => item.status === "uploading").length,
    totalBytes,
    uploadedBytes,
    totalPercent: totalBytes ? Math.round((uploadedBytes / totalBytes) * 100) : 0,
    totalSpeedBytesPerSecond,
    totalEtaSeconds: totalSpeedBytesPerSecond > 0 ? remainingBytes / totalSpeedBytesPerSecond : null,
  };
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "-";
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;

  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

function formatSpeed(bytesPerSecond: number) {
  if (!bytesPerSecond || !Number.isFinite(bytesPerSecond)) return "-";
  return `${formatBytes(bytesPerSecond)}/s`;
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
  const uploadProgressClockRef = useRef<Record<string, number>>({});

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
    return uploadFileWithProgress({
      file: selection.file,
      currentFolder: path,
      relativePath: selection.relativePath || selection.file.name,
      onProgress: (progress) => {
        const now = performance.now();
        const lastUpdate = uploadProgressClockRef.current[selection.id] || 0;
        if (now - lastUpdate < 250 && progress.percent < 99) return;
        uploadProgressClockRef.current[selection.id] = now;

        setUploadSelections((current) =>
          current.map((item) =>
            item.id === selection.id
              ? {
                  ...item,
                  uploadedBytes: progress.loadedBytes,
                  totalBytes: progress.totalBytes,
                  percent: progress.percent,
                  speedBytesPerSecond: progress.speedBytesPerSecond,
                  etaSeconds: progress.etaSeconds,
                  progressMessage: progress.message,
                }
              : item
          )
        );
      },
    });
  }

  async function uploadSelected() {
    if (uploading) return;
    const selectedForUpload = uploadSelections.filter((item) => item.status === "pending" || item.status === "failed");
    if (!selectedForUpload.length) return;

    setUploading(true);
    setNotice("");
    uploadProgressClockRef.current = {};
    setUploadSelections((current) =>
      current.map((item) =>
        item.status === "pending" || item.status === "failed"
          ? {
              ...item,
              status: "queued",
              uploadedBytes: 0,
              percent: 0,
              speedBytesPerSecond: 0,
              etaSeconds: null,
              progressMessage: undefined,
              errorMessage: undefined,
            }
          : item
      )
    );

    let cursor = 0;
    let failedCount = 0;
    const concurrency = Math.min(3, selectedForUpload.length);

    async function worker() {
      for (;;) {
        const index = cursor;
        cursor += 1;
        const selection = selectedForUpload[index];
        if (!selection) return;

        setUploadSelections((current) =>
          current.map((item) =>
            item.id === selection.id
              ? {
                  ...item,
                  status: "uploading",
                  uploadedBytes: 0,
                  percent: 0,
                  speedBytesPerSecond: 0,
                  etaSeconds: null,
                  progressMessage: undefined,
                  errorMessage: undefined,
                }
              : item
          )
        );

        try {
          await uploadOne(selection);
          setUploadSelections((current) =>
            current.map((item) =>
              item.id === selection.id
                ? {
                    ...item,
                    status: "uploaded",
                    uploadedBytes: item.totalBytes,
                    percent: 100,
                    speedBytesPerSecond: 0,
                    etaSeconds: null,
                    progressMessage: "Queued for preview after complete",
                    errorMessage: undefined,
                  }
                : item
            )
          );
        } catch (caught) {
          failedCount += 1;
          setUploadSelections((current) =>
            current.map((item) =>
              item.id === selection.id
                ? {
                    ...item,
                    status: "failed",
                    speedBytesPerSecond: 0,
                    etaSeconds: null,
                    progressMessage: undefined,
                    errorMessage: caught instanceof Error ? caught.message : "Upload failed.",
                  }
                : item
            )
          );
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    try {
      await load(path);
      setNotice(failedCount ? `Upload finished with ${failedCount} failed.` : "Upload complete.");
    } catch {
      setNotice("Upload finished, but folder refresh failed.");
    } finally {
      setUploading(false);
    }
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
  const totals = calculateUploadTotals(selections);
  const uploaded = totals.completedFiles;
  const failed = totals.failedFiles;
  const pending = selections.filter((item) => item.status === "pending" || item.status === "queued").length;
  const activeSelections = selections.filter((item) => item.status === "uploading");
  const currentNames = activeSelections.map((item) =>
    item.progressMessage ? `${item.relativePath || item.name}: ${item.progressMessage}` : item.relativePath || item.name
  );
  const currentLabel = currentNames.length
    ? `${currentNames[0]}${currentNames.length > 1 ? ` + ${currentNames.length - 1} more` : ""}`
    : uploading
      ? "Refreshing folder list"
      : completeUploadLabel();
  const complete = total > 0 && uploaded + failed === total && !uploading;
  const title = complete
    ? failed
      ? "Upload partially complete"
      : "Upload complete"
    : uploading
      ? activeSelections.length
        ? "Uploading files"
        : "Finishing upload"
      : "Upload files";
  const percent = total ? (complete ? totals.totalPercent : Math.min(totals.totalPercent, 99)) : 0;
  const uploadableCount = selections.filter((item) => item.status === "pending" || item.status === "failed").length;
  const retryOnly = failed > 0 && selections.every((item) => item.status !== "pending" && item.status !== "queued");
  const orderedSelections = [...selections].sort((a, b) => {
    const order: Record<UploadStatus, number> = { uploading: 0, queued: 1, pending: 2, failed: 3, uploaded: 4 };
    return order[a.status] - order[b.status];
  });
  const visibleSelections = orderedSelections.slice(0, 20);
  const hiddenSelections = Math.max(orderedSelections.length - visibleSelections.length, 0);

  function completeUploadLabel() {
    if (!total) return "-";
    if (uploaded) return "Done";
    if (pending) return "Ready";
    return "-";
  }

  function statusClass(status: UploadStatus) {
    if (status === "uploaded") return "bg-[#d7ff3f]/10 text-[#d7ff3f]";
    if (status === "failed") return "bg-red-300/10 text-red-100";
    if (status === "uploading") return "bg-blue-300/10 text-blue-100";
    if (status === "queued") return "bg-amber-300/10 text-amber-100";
    return "bg-white/10 text-zinc-400";
  }

  function statusLabel(item: UploadSelection) {
    if (item.status === "uploading" && item.progressMessage?.startsWith("Finalizing")) return "finalizing";
    return item.status;
  }

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
          <button
            onClick={onClose}
            disabled={uploading}
            title={uploading ? "Upload still running" : "Close upload modal"}
            className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close upload modal"
          >
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
            if (uploading) return;
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
                <p className="mt-1 text-xs text-zinc-500">{formatBytes(totals.uploadedBytes)} / {formatBytes(totals.totalBytes)}</p>
              </div>
              <span className="text-sm font-black text-[#d7ff3f]">{percent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#d7ff3f] transition-all" style={{ width: `${percent}%` }} />
            </div>

            <div className="mt-4 grid gap-2 text-xs text-zinc-300 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#08090d] px-3 py-2">
                <span className="text-zinc-500">Speed: </span>
                <span className="font-bold text-white">{formatSpeed(totals.totalSpeedBytesPerSecond)}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#08090d] px-3 py-2">
                <span className="text-zinc-500">ETA: </span>
                <span className="font-bold text-white">{formatDuration(totals.totalEtaSeconds)}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#08090d] px-3 py-2 sm:col-span-2">
                <span className="text-zinc-500">Current: </span>
                <span className="font-bold text-white">{currentLabel}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#08090d] px-3 py-2">
                <span className="text-zinc-500">Active: </span>
                <span className="font-bold text-white">{totals.activeFiles}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#08090d] px-3 py-2">
                <span className="text-zinc-500">Failed: </span>
                <span className={failed ? "font-bold text-red-100" : "font-bold text-white"}>{failed}</span>
              </div>
            </div>

            <div className="mt-4 max-h-56 space-y-2 overflow-auto pr-1">
              {visibleSelections.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#08090d] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{item.relativePath || item.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                      <span>{formatBytes(item.uploadedBytes)} / {formatBytes(item.totalBytes)}</span>
                      {item.status === "uploading" ? <span>{Math.round(item.percent)}%</span> : null}
                      {item.status === "uploading" ? <span>{formatSpeed(item.speedBytesPerSecond)}</span> : null}
                    </div>
                    {item.progressMessage ? <p className="mt-1 text-xs text-zinc-400">{item.progressMessage}</p> : null}
                    {item.status === "uploading" ? (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-blue-300 transition-all" style={{ width: `${Math.min(item.percent, 99)}%` }} />
                      </div>
                    ) : null}
                    {item.errorMessage ? <p className="mt-1 text-xs text-red-200">{item.errorMessage}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.status === "uploaded" ? <CheckSquare className="h-4 w-4 text-[#d7ff3f]" /> : null}
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusClass(item.status)}`}>
                      {statusLabel(item)}
                    </span>
                    {!uploading && item.status !== "uploaded" ? (
                      <button type="button" onClick={() => onRemove(item.id)} className="rounded-lg p-1 text-zinc-500 hover:bg-white/10 hover:text-white" aria-label={`Remove ${item.name}`}>
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {hiddenSelections ? (
                <div className="rounded-2xl border border-white/10 bg-[#08090d] px-3 py-2 text-xs text-zinc-500">
                  {hiddenSelections} more files hidden for performance.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClear} disabled={uploading || !total} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-50">
            Clear selected files
          </button>
          <button type="button" onClick={onClose} disabled={uploading} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
            {uploading ? "Upload in progress" : "Close"}
          </button>
          <button type="button" onClick={onUpload} disabled={uploading || !uploadableCount} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-60">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {retryOnly && !uploading ? "Retry failed" : uploading ? "Uploading..." : failed && !uploading ? "Upload pending and failed" : "Upload selected files"}
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
