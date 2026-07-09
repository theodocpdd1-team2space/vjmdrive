"use client";

import Link from "next/link";
import type { FormEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  CheckSquare,
  ChevronRight,
  CircleCheck,
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
  MoreHorizontal,
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
  type DriveItem,
  type ViewMode,
  ViewToggle,
  typeLabel,
} from "@/components/drive/drive-ui";
import { planQuotaLabel } from "@/lib/plan-display";

type ShareResult = {
  url: string;
  token: string;
  permission: string;
  expiresAt: string | null;
  allowedEmails: string[];
  failedEmails: string[];
};

type ShareVisibility = "PRIVATE" | "PUBLIC_LOGIN" | "PUBLIC";

type UploadStatus = "pending" | "uploading" | "finalizing" | "verifying" | "uploaded" | "failed";

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
  status?: UploadStatus;
};

type DrivePlanSummary = {
  plan: string;
  quotaBytes: number | null;
  storageUsedBytes: number;
  storagePercent: number;
  planLabel: string;
};

type UploadApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  uploaded?: string[];
  [key: string]: unknown;
};

type ChunkInitResponse = UploadApiResponse & {
  uploadId?: string;
  chunkSize?: number;
  totalChunks?: number;
};

type DriveListResponse = {
  ok?: boolean;
  items?: DriveItem[];
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
const CHUNK_SIZE = 25 * 1024 * 1024;
const CHUNK_UPLOAD_CONCURRENCY = 2;
const UPLOAD_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

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
    xhr.timeout = UPLOAD_REQUEST_TIMEOUT_MS;
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
    xhr.ontimeout = () => reject(new Error(`Timed out while uploading chunk ${chunkIndex + 1}.`));
    xhr.onabort = () => reject(new Error(`Chunk ${chunkIndex + 1} upload canceled.`));
    xhr.open("POST", "/api/files/upload/chunk");
    xhr.send(form);
  });
}

async function postUploadJson<T extends UploadApiResponse>(
  url: string,
  body: Record<string, unknown>,
  fallbackMessage: string,
  timeoutMs = UPLOAD_REQUEST_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as T;
    if (!res.ok || !data.ok) throw new Error(data.message || data.error || fallbackMessage);
    return data;
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") {
      throw new Error(`${fallbackMessage} Request timed out.`);
    }
    throw caught;
  } finally {
    window.clearTimeout(timer);
  }
}

async function abortChunkUpload(uploadId: string) {
  await fetch("/api/files/upload/abort", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId }),
  }).catch(() => undefined);
}

function parentPathFromUpload(currentFolder: string, relativePath: string) {
  const parts = (relativePath || "").split("/").filter(Boolean);
  parts.pop();
  return [currentFolder, ...parts].filter(Boolean).join("/");
}

function baseNameFromUpload(relativePath: string, fallbackName: string) {
  const parts = (relativePath || "").split("/").filter(Boolean);
  return parts.at(-1) || fallbackName;
}

async function uploadedFileExists(currentFolder: string, relativePath: string, file: File) {
  const parentPath = parentPathFromUpload(currentFolder, relativePath || file.name);
  const expectedName = baseNameFromUpload(relativePath || file.name, file.name);
  const res = await fetch(`/api/user/files/list?path=${encodeURIComponent(parentPath)}`, { cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as DriveListResponse;
  if (!res.ok || !data.ok) return false;
  return Boolean(data.items?.some((item) => item.name === expectedName && item.bytes === file.size));
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
      status: message.startsWith("Finalizing") ? "finalizing" : message.startsWith("Verifying") ? "verifying" : "uploading",
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
    let nextChunkIndex = 0;
    let failed = false;
    let firstError: unknown = null;
    const activeChunkBytes = new Map<number, number>();

    function chunkSizeAt(chunkIndex: number) {
      const start = chunkIndex * serverChunkSize;
      const end = Math.min(start + serverChunkSize, file.size);
      return Math.max(end - start, 0);
    }

    function uploadMessage() {
      const active = [...activeChunkBytes.keys()].sort((a, b) => a - b);
      if (!active.length) return `Uploading chunks / ${serverTotalChunks}`;
      if (active.length === 1) return `Uploading chunk ${active[0] + 1} / ${serverTotalChunks}`;

      const first = active[0] + 1;
      const last = active[active.length - 1] + 1;
      return last - first + 1 === active.length
        ? `Uploading chunks ${first}-${last} / ${serverTotalChunks}`
        : `Uploading ${active.length} chunks / ${serverTotalChunks}`;
    }

    function emitChunkProgress() {
      const activeBytes = [...activeChunkBytes.values()].reduce((sum, bytes) => sum + bytes, 0);
      emitProgress(completedBytes + activeBytes, uploadMessage());
    }

    async function uploadChunkWorker() {
      for (;;) {
        if (failed) return;
        const chunkIndex = nextChunkIndex;
        nextChunkIndex += 1;
        if (chunkIndex >= serverTotalChunks) return;

        const start = chunkIndex * serverChunkSize;
        const end = Math.min(start + serverChunkSize, file.size);
        const chunk = file.slice(start, end);
        activeChunkBytes.set(chunkIndex, 0);
        emitChunkProgress();

        try {
          await uploadChunkRequest({
            uploadId,
            chunkIndex,
            chunk,
            onProgress: (chunkLoadedBytes) => {
              activeChunkBytes.set(chunkIndex, Math.min(chunkLoadedBytes, chunk.size));
              emitChunkProgress();
            },
          });
          completedBytes += chunkSizeAt(chunkIndex);
          activeChunkBytes.delete(chunkIndex);
          emitChunkProgress();
        } catch (caught) {
          failed = true;
          firstError = caught;
          activeChunkBytes.delete(chunkIndex);
          emitChunkProgress();
          return;
        }
      }
    }

    emitProgress(0, `Optimized upload: ${formatBytes(serverChunkSize)} chunks · ${CHUNK_UPLOAD_CONCURRENCY} at a time`);
    await Promise.all(
      Array.from({ length: Math.min(CHUNK_UPLOAD_CONCURRENCY, serverTotalChunks) }, () => uploadChunkWorker())
    );
    if (failed) throw firstError instanceof Error ? firstError : new Error("Chunk upload failed.");

    emitProgress(file.size, "Finalizing upload...");
    let completed: UploadApiResponse;
    try {
      completed = await postUploadJson<UploadApiResponse>(
        "/api/files/upload/complete",
        { uploadId },
        "Upload finalizing failed."
      );
    } catch (caught) {
      emitProgress(file.size, "Verifying uploaded file...");
      if (await uploadedFileExists(currentFolder, relativePath || file.name, file)) {
        return { ok: true, uploaded: [relativePath || file.name], recovered: true };
      }
      throw caught;
    }

    onProgress({
      loadedBytes: file.size,
      totalBytes: file.size,
      percent: 100,
      speedBytesPerSecond: 0,
      etaSeconds: null,
      message: "Queued for preview after complete",
      status: "uploaded",
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
    .filter((item) => item.status === "uploading" || item.status === "finalizing" || item.status === "verifying")
    .reduce((sum, item) => sum + item.speedBytesPerSecond, 0);
  const remainingBytes = Math.max(totalBytes - uploadedBytes, 0);

  return {
    totalFiles: selections.length,
    completedFiles: selections.filter((item) => item.status === "uploaded").length,
    failedFiles: selections.filter((item) => item.status === "failed").length,
    activeFiles: selections.filter((item) => item.status === "uploading" || item.status === "finalizing" || item.status === "verifying").length,
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
  { href: "/client-select", label: "Client Select", icon: CheckSquare },
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
  const [shareInitialType, setShareInitialType] = useState<"standard" | "client-select">("standard");
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<DriveItem[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [planSummary, setPlanSummary] = useState<DrivePlanSummary | null>(null);
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
      if ("plan" in data || "planLabel" in data) {
        setPlanSummary({
          plan: typeof data.plan === "string" ? data.plan : "Free",
          quotaBytes: typeof data.quotaBytes === "number" || data.quotaBytes === null ? data.quotaBytes : null,
          storageUsedBytes: typeof data.storageUsedBytes === "number" ? data.storageUsedBytes : 0,
          storagePercent: typeof data.storagePercent === "number" ? data.storagePercent : 0,
          planLabel:
            typeof data.planLabel === "string" ? data.planLabel : planQuotaLabel(data.plan, data.quotaBytes),
        });
      }
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
                  status: progress.status || item.status,
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
              status: "pending",
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

  async function deleteItems() {
    if (!deleteTargets.length || deleting) return;

    setDeleting(true);
    setNotice("");

    const res = await fetch("/api/user/files/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: deleteTargets.map((item) => item.path) }),
    });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);

    if (!res.ok || !data.ok) {
      setNotice(data.message || "Delete failed.");
      return;
    }

    const deletedCount = Array.isArray(data.deleted) ? data.deleted.length : 0;
    const failedCount = Array.isArray(data.failed) ? data.failed.length : 0;
    setDeleteTargets([]);
    setSelectedPaths(new Set());
    setNotice(failedCount ? `Deleted ${deletedCount}. ${failedCount} failed.` : `Deleted ${deletedCount || deleteTargets.length} selected item${deleteTargets.length === 1 ? "" : "s"}.`);
    await load(path);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(""), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let active = true;
    async function loadPlanSummary() {
      const res = await fetch("/api/auth/me", { cache: "no-store" }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      const user = data?.user;
      if (!active || !user) return;
      setPlanSummary({
        plan: typeof user.plan === "string" ? user.plan : "Free",
        quotaBytes: typeof user.quotaBytes === "number" || user.quotaBytes === null ? user.quotaBytes : null,
        storageUsedBytes: typeof user.storageUsedBytes === "number" ? user.storageUsedBytes : 0,
        storagePercent: typeof user.storagePercent === "number" ? user.storagePercent : 0,
        planLabel:
          typeof user.planLabel === "string" ? user.planLabel : planQuotaLabel(user.plan, user.quotaBytes),
      });
    }
    void loadPlanSummary();
    return () => {
      active = false;
    };
  }, []);

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

  const selectedItems = useMemo(
    () => items.filter((item) => selectedPaths.has(item.path)),
    [items, selectedPaths]
  );

  const usedBytesDisplayed = filteredItems.reduce((total, item) => total + (item.type === "folder" ? 0 : item.bytes || 0), 0);
  const drivePlanLabel = planSummary?.planLabel || "Drive plan";
  const drivePlanTitle = planSummary?.plan ? `${planSummary.plan} Plan` : "Drive Plan";
  const driveQuotaText =
    planSummary?.quotaBytes === null
      ? "Unlimited storage quota"
      : planSummary
        ? `${formatBytes(planSummary.quotaBytes)} storage quota`
        : "Storage quota";
  const driveUsageText = planSummary
    ? `${formatBytes(planSummary.storageUsedBytes)} used${planSummary.quotaBytes === null ? "" : ` of ${formatBytes(planSummary.quotaBytes)}`}`
    : "Storage usage loading";
  const driveUsagePercent = Math.max(0, Math.min(100, planSummary?.storagePercent || 0));

  if (embedded) {
    return (
      <>
        <div className="mx-auto max-w-7xl space-y-3 md:space-y-5">
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

          <section className="grid grid-cols-3 gap-2 md:gap-3">
            <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-3 md:p-4">
              <p className="truncate text-[11px] text-zinc-500 md:text-sm">Current folder</p>
              <p className="mt-1 truncate text-sm font-bold text-white md:text-base">{path || "Home"}</p>
            </div>
            <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-3 md:p-4">
              <p className="truncate text-[11px] text-zinc-500 md:text-sm">Items shown</p>
              <p className="mt-1 text-sm font-bold text-white md:text-base">{filteredItems.length}</p>
            </div>
            <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-3 md:p-4">
              <p className="truncate text-[11px] text-zinc-500 md:text-sm">Displayed size</p>
              <p className="mt-1 truncate text-sm font-bold text-white md:text-base">{formatBytes(usedBytesDisplayed)}</p>
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
                <span className="rounded-xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-3 py-2 text-[#d7ff3f]">{drivePlanLabel}</span>
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
              setShareInitialType("standard");
              setShareTarget(currentFolderItem());
              setShareResult(null);
            }}
            onClientSelectCurrent={() => {
              setShareInitialType("client-select");
              setShareTarget(currentFolderItem());
              setShareResult(null);
            }}
            onSelectAll={selectAllVisible}
            onClear={clearSelection}
            onDeleteSelected={() => setDeleteTargets(selectedItems)}
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
              setShareInitialType("standard");
              setShareTarget(item);
              setShareResult(null);
            }}
            setClientSelectTarget={(item) => {
              setShareInitialType("client-select");
              setShareTarget(item);
              setShareResult(null);
            }}
            setDeleteTarget={(item) => setDeleteTargets([item])}
          />
        </div>

        <UserShareModal
          key={`${shareInitialType}:${shareTarget?.path || ""}`}
          item={shareTarget}
          initialType={shareInitialType}
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
            setShareInitialType("standard");
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
          items={deleteTargets}
          deleting={deleting}
          onClose={() => {
            if (!deleting) setDeleteTargets([]);
          }}
          onConfirm={() => void deleteItems()}
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
              <p className="text-sm font-bold text-white">{drivePlanTitle}</p>
              <BarChart3 className="h-4 w-4 text-[#d7ff3f]" />
            </div>
            <p className="mt-1 text-xs text-zinc-500">{driveQuotaText}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#d7ff3f]" style={{ width: `${driveUsagePercent}%` }} />
            </div>
            <p className="mt-2 text-xs text-zinc-500">{driveUsageText}</p>
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
          <div className="mx-auto max-w-7xl space-y-3 md:space-y-5">
            <section className="grid grid-cols-3 gap-2 md:gap-3">
              <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-3 md:p-4">
                <p className="truncate text-[11px] text-zinc-500 md:text-sm">Current folder</p>
                <p className="mt-1 truncate text-sm font-bold text-white md:text-base">{path || "Home"}</p>
              </div>

              <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-3 md:p-4">
                <p className="truncate text-[11px] text-zinc-500 md:text-sm">Items shown</p>
                <p className="mt-1 text-sm font-bold text-white md:text-base">{filteredItems.length}</p>
              </div>

              <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-3 md:p-4">
                <p className="truncate text-[11px] text-zinc-500 md:text-sm">Displayed size</p>
                <p className="mt-1 truncate text-sm font-bold text-white md:text-base">{formatBytes(usedBytesDisplayed)}</p>
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
                    {drivePlanLabel}
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
                setShareInitialType("standard");
                setShareTarget(currentFolderItem());
                setShareResult(null);
              }}
              onClientSelectCurrent={() => {
                setShareInitialType("client-select");
                setShareTarget(currentFolderItem());
                setShareResult(null);
              }}
              onSelectAll={selectAllVisible}
              onClear={clearSelection}
              onDeleteSelected={() => setDeleteTargets(selectedItems)}
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
                setShareInitialType("standard");
                setShareTarget(item);
                setShareResult(null);
              }}
              setClientSelectTarget={(item) => {
                setShareInitialType("client-select");
                setShareTarget(item);
                setShareResult(null);
              }}
              setDeleteTarget={(item) => setDeleteTargets([item])}
            />
          </div>
        </div>
      </section>

      <UserShareModal
        key={`${shareInitialType}:${shareTarget?.path || ""}`}
        item={shareTarget}
        initialType={shareInitialType}
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
          setShareInitialType("standard");
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
        items={deleteTargets}
        deleting={deleting}
        onClose={() => {
          if (!deleting) setDeleteTargets([]);
        }}
        onConfirm={() => void deleteItems()}
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
  onClientSelectCurrent,
  onSelectAll,
  onClear,
  onDeleteSelected,
}: {
  selectedCount: number;
  visibleCount: number;
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
  uploading: boolean;
  onNewFolder: () => void;
  onOpenUpload: () => void;
  onShareCurrent: () => void;
  onClientSelectCurrent: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onDeleteSelected: () => void;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.025] p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewFolder}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-3 text-sm font-bold text-black transition hover:bg-[#c8ef34]"
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>

          <button
            type="button"
            onClick={onOpenUpload}
            disabled={uploading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>

          <button
            type="button"
            onClick={onShareCurrent}
            className="hidden h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <Share2 className="h-4 w-4" />
            Share current
          </button>

          <button
            type="button"
            onClick={onClientSelectCurrent}
            className="hidden h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white md:inline-flex"
          >
            <CheckSquare className="h-4 w-4" />
            Create Client Select
          </button>

          <details className="relative md:hidden">
            <summary
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden"
              title="More folder actions"
              aria-label="More folder actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </summary>
            <div className="absolute left-0 top-11 z-40 w-52 overflow-hidden rounded-lg border border-white/10 bg-[#15171d] p-1 shadow-2xl">
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  onShareCurrent();
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/10"
              >
                <Share2 className="h-4 w-4" />
                Share current folder
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  onClientSelectCurrent();
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/10"
              >
                <CheckSquare className="h-4 w-4" />
                Create Client Select
              </button>
            </div>
          </details>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={!visibleCount}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            title="Select all visible items"
          >
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Select all</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!selectedCount}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            title="Clear selection"
          >
            <Square className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>
          {selectedCount ? (
            <button
              type="button"
              onClick={onDeleteSelected}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10"
              title="Delete selected items"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          ) : null}
          <span className="hidden rounded-md px-2 py-1 text-xs font-medium text-zinc-600 sm:inline">
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
  setClientSelectTarget,
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
  setClientSelectTarget: (item: DriveItem) => void;
  setDeleteTarget: (item: DriveItem) => void;
}) {
  function openItem(item: DriveItem) {
    if (item.type === "folder") {
      void load(item.path);
      return;
    }
    setPreviewItem(item);
  }

  function handleItemKeyDown(event: KeyboardEvent<HTMLElement>, item: DriveItem) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button,a,input,summary,details")) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openItem(item);
  }

  function modifiedDate(value: string) {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.025]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
        <p className="text-sm font-semibold text-white">Files</p>
        <span className="text-xs text-zinc-600">{filteredItems.length} items</span>
      </div>
      {loading ? (
        <div className="flex h-72 items-center justify-center gap-2 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />
          Loading drive...
        </div>
      ) : null}

      {!loading && filteredItems.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[#d7ff3f]">
            <HardDrive className="h-7 w-7" />
          </div>
          <div>
            <p className="font-bold text-white">No files here</p>
            <p className="mt-1 text-sm text-zinc-500">Upload your first file to this folder.</p>
          </div>
        </div>
      ) : null}

      {!loading && filteredItems.length > 0 ? (
        <div className={viewMode === "grid" ? "grid grid-cols-2 gap-2.5 p-2.5 sm:grid-cols-3 xl:grid-cols-4" : "divide-y divide-white/[0.07]"}>
          {filteredItems.map((item) => {
            const selected = selectedPaths.has(item.path);
            const downloadUrl = item.type === "folder"
              ? `/api/user/files/zip?path=${encodeURIComponent(item.path)}`
              : item.directDownloadUrl;

            return (
              <article
                key={item.path}
                role="button"
                tabIndex={0}
                title={item.type === "folder" ? `Open ${item.name}` : `Preview ${item.name}`}
                aria-label={item.type === "folder" ? `Open folder ${item.name}` : `Preview file ${item.name}`}
                onClick={() => openItem(item)}
                onKeyDown={(event) => handleItemKeyDown(event, item)}
                className={viewMode === "grid"
                  ? `relative cursor-pointer rounded-lg border bg-black/20 transition focus:outline-none focus:ring-2 focus:ring-[#d7ff3f]/40 ${selected ? "border-[#d7ff3f]/80 bg-[#d7ff3f]/[0.04]" : "border-white/[0.08] hover:border-white/20 hover:bg-white/[0.035]"}`
                  : `grid min-h-16 w-full cursor-pointer grid-cols-[34px_42px_minmax(0,1fr)_36px] items-center gap-2.5 px-2.5 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#d7ff3f]/40 sm:grid-cols-[34px_42px_minmax(0,1fr)_90px_110px_36px] ${selected ? "bg-[#d7ff3f]/[0.05]" : "hover:bg-white/[0.03]"}`}
              >
                {viewMode === "grid" ? (
                  <>
                    <div className="relative">
                      <FileThumbnail item={item} size="grid" quietFallback />
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSelect(item.path);
                        }}
                        className={`absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md border shadow-lg backdrop-blur transition ${selected ? "border-[#d7ff3f] bg-[#d7ff3f] text-black" : "border-white/25 bg-black/45 text-white/70 hover:border-white/60"}`}
                        aria-label={selected ? `Deselect ${item.name}` : `Select ${item.name}`}
                      >
                        {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                      <FileActionMenu
                        item={item}
                        downloadUrl={downloadUrl}
                        onOpen={() => openItem(item)}
                        onShare={() => setShareTarget(item)}
                        onClientSelect={() => setClientSelectTarget(item)}
                        onDelete={() => setDeleteTarget(item)}
                        overlay
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="line-clamp-2 min-h-9 break-words text-sm font-semibold leading-[1.15rem] text-white">{item.name}</p>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-600">
                        <span className="max-w-16 truncate uppercase">{item.extension || typeLabel(item)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{item.size || formatBytes(item.bytes || 0)}</span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-zinc-700">{modifiedDate(item.modified)}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSelect(item.path);
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded-md transition ${selected ? "text-[#d7ff3f]" : "text-zinc-600 hover:bg-white/10 hover:text-zinc-300"}`}
                      aria-label={selected ? `Deselect ${item.name}` : `Select ${item.name}`}
                    >
                      {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                    <FileThumbnail item={item} size="row" quietFallback />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-zinc-600 sm:hidden">
                        {(item.extension || typeLabel(item)).toUpperCase()} · {item.size || formatBytes(item.bytes || 0)} · {modifiedDate(item.modified)}
                      </p>
                      <p className="mt-0.5 hidden truncate text-[11px] text-zinc-600 sm:block">{typeLabel(item)}</p>
                    </div>
                    <span className="hidden truncate text-xs text-zinc-500 sm:block">{item.size || formatBytes(item.bytes || 0)}</span>
                    <span className="hidden truncate text-xs text-zinc-600 sm:block">{modifiedDate(item.modified)}</span>
                    <FileActionMenu
                      item={item}
                      downloadUrl={downloadUrl}
                      onOpen={() => openItem(item)}
                      onShare={() => setShareTarget(item)}
                      onClientSelect={() => setClientSelectTarget(item)}
                      onDelete={() => setDeleteTarget(item)}
                    />
                  </>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function FileActionMenu({
  item,
  downloadUrl,
  onOpen,
  onShare,
  onClientSelect,
  onDelete,
  overlay = false,
}: {
  item: DriveItem;
  downloadUrl: string | null;
  onOpen: () => void;
  onShare: () => void;
  onClientSelect: () => void;
  onDelete: () => void;
  overlay?: boolean;
}) {
  function close(details: Element | null) {
    details?.removeAttribute("open");
  }

  return (
    <details
      className={overlay ? "absolute right-2 top-2 z-20" : "relative z-20"}
      onClick={(event) => event.stopPropagation()}
    >
      <summary
        className={`flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border transition [&::-webkit-details-marker]:hidden ${
          overlay
            ? "border-white/20 bg-black/50 text-white/80 shadow-lg backdrop-blur hover:border-white/50 hover:text-white"
            : "border-transparent text-zinc-500 hover:border-white/10 hover:bg-white/10 hover:text-white"
        }`}
        title={`More actions for ${item.name}`}
        aria-label={`More actions for ${item.name}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 top-10 z-30 w-52 overflow-hidden rounded-lg border border-white/10 bg-[#15171d] p-1 shadow-2xl">
        <button
          type="button"
          onClick={(event) => {
            close(event.currentTarget.closest("details"));
            onOpen();
          }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          {item.type === "folder" ? <Folder className="h-4 w-4" /> : <File className="h-4 w-4" />}
          {item.type === "folder" ? "Open" : "Preview"}
        </button>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            onClick={(event) => close(event.currentTarget.closest("details"))}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        ) : null}
        <button
          type="button"
          onClick={(event) => {
            close(event.currentTarget.closest("details"));
            onShare();
          }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
        {item.type === "folder" ? (
          <button
            type="button"
            onClick={(event) => {
              close(event.currentTarget.closest("details"));
              onClientSelect();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            <CheckSquare className="h-4 w-4" />
            Create Client Select
          </button>
        ) : null}
        <div className="my-1 border-t border-white/10" />
        <button
          type="button"
          onClick={(event) => {
            close(event.currentTarget.closest("details"));
            onDelete();
          }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-200 hover:bg-red-300/10"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </details>
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
  const [closing, setClosing] = useState(false);

  const total = selections.length;
  const totals = calculateUploadTotals(selections);
  const uploaded = totals.completedFiles;
  const failed = totals.failedFiles;
  const pending = selections.filter((item) => item.status === "pending").length;
  const activeSelections = selections.filter(
    (item) => item.status === "uploading" || item.status === "finalizing" || item.status === "verifying"
  );
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
  const retryOnly = failed > 0 && selections.every((item) => item.status !== "pending");
  const orderedSelections = [...selections].sort((a, b) => {
    const order: Record<UploadStatus, number> = { uploading: 0, finalizing: 1, verifying: 2, pending: 3, failed: 4, uploaded: 5 };
    return order[a.status] - order[b.status];
  });
  const visibleSelections = orderedSelections.slice(0, 20);
  const hiddenSelections = Math.max(orderedSelections.length - visibleSelections.length, 0);
  const hasChunkedFiles = selections.some((item) => item.size > CHUNK_UPLOAD_THRESHOLD);
  const successComplete = complete && failed === 0;

  const beginClose = useCallback(() => {
    if (uploading) return;
    setClosing(true);
    window.setTimeout(() => onClose(), 260);
  }, [onClose, uploading]);

  useEffect(() => {
    if (open) setClosing(false);
  }, [open]);

  useEffect(() => {
    if (!open || !successComplete || uploading) return;
    const timer = window.setTimeout(() => beginClose(), 2300);
    return () => window.clearTimeout(timer);
  }, [beginClose, open, successComplete, uploading]);

  if (!open) return null;

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
    if (status === "finalizing" || status === "verifying") return "bg-amber-300/10 text-amber-100";
    return "bg-white/10 text-zinc-400";
  }

  function statusLabel(item: UploadSelection) {
    return item.status;
  }

  return (
    <div className={`fixed inset-0 z-[110] flex items-end bg-black/70 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-4 ${closing ? "upload-modal-backdrop-exit" : ""}`}>
      <div className={`upload-modal-panel max-h-[92vh] w-full overflow-auto rounded-t-3xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:max-w-2xl md:rounded-3xl ${closing ? "upload-modal-panel-exit" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff3f]">Current folder: {path || "Home"}</p>
            <h2 className="mt-2 text-xl font-black text-white">
              {successComplete ? "Upload complete" : title}
            </h2>
            {successComplete ? (
              <p className="mt-1 text-sm text-zinc-500">
                {uploaded} {uploaded === 1 ? "file" : "files"} uploaded successfully.
              </p>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">
                {total ? `${uploaded} / ${total} uploaded` : "Drag files here or choose files from your device."}
                {failed ? ` · ${failed} failed` : ""}
              </p>
            )}
            {hasChunkedFiles && !successComplete ? (
              <p className="mt-1 text-xs text-zinc-600">
                Optimized upload: {formatBytes(CHUNK_SIZE)} chunks · {CHUNK_UPLOAD_CONCURRENCY} at a time
              </p>
            ) : null}
          </div>
          <button
            onClick={beginClose}
            disabled={uploading}
            title={uploading ? "Upload still running" : "Close upload modal"}
            className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close upload modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {successComplete ? (
          <div className="upload-success-state mt-6 flex min-h-[360px] flex-col items-center justify-center px-3 py-8 text-center md:min-h-[420px]">
            <div className="upload-success-orbit flex h-24 w-24 items-center justify-center rounded-full border border-[#d7ff3f]/30 bg-[#d7ff3f]/10 text-[#d7ff3f] shadow-[0_0_55px_rgba(215,255,63,0.18)]">
              <CircleCheck className="upload-success-check h-12 w-12" />
            </div>
            <p className="mt-6 text-2xl font-black text-white">Upload complete</p>
            <p className="mt-2 max-w-md text-sm text-zinc-400">
              {uploaded} {uploaded === 1 ? "file" : "files"} uploaded successfully.
            </p>
            <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-bold text-[#d7ff3f]">
              {formatBytes(totals.uploadedBytes)} uploaded
            </p>
            <p className="mt-4 max-w-md text-sm leading-6 text-zinc-500">
              Files are ready and preview cache will continue in the background.
            </p>
            <p className="mt-4 text-xs text-zinc-600">Closing automatically...</p>

            <div className="mt-7 flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setClosing(false);
                }}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10"
              >
                Upload more
              </button>
              <button
                type="button"
                onClick={beginClose}
                className="rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black hover:bg-[#c8ef34]"
              >
                View files
              </button>
            </div>
          </div>
        ) : (
          <>
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
                          {item.status === "uploading" || item.status === "finalizing" || item.status === "verifying" ? <span>{Math.round(item.percent)}%</span> : null}
                          {item.status === "uploading" || item.status === "finalizing" || item.status === "verifying" ? <span>{formatSpeed(item.speedBytesPerSecond)}</span> : null}
                        </div>
                        {item.progressMessage ? <p className="mt-1 text-xs text-zinc-400">{item.progressMessage}</p> : null}
                        {item.status === "uploading" || item.status === "finalizing" || item.status === "verifying" ? (
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
              <button type="button" onClick={beginClose} disabled={uploading} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                {uploading ? "Upload in progress" : "Close"}
              </button>
              <button type="button" onClick={onUpload} disabled={uploading || !uploadableCount} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-60">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {retryOnly && !uploading ? "Retry failed" : uploading ? "Uploading..." : failed && !uploading ? "Upload pending and failed" : "Upload selected files"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  items,
  deleting,
  onClose,
  onConfirm,
}: {
  items: DriveItem[];
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!items.length) return null;

  const hasFolders = items.some((item) => item.type === "folder");
  const title = items.length === 1 ? items[0].name : `Delete ${items.length} selected items?`;

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/70 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-4">
      <div className="w-full rounded-t-3xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:max-w-md md:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-200">Confirm delete</p>
            <h2 className="mt-2 text-xl font-black text-white">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {items.length === 1
                ? `This will remove the selected ${items[0].type === "folder" ? "folder and its contents" : "file"} from your drive.`
                : "This will remove selected files/folders from your drive."}
            </p>
            {items.length > 1 && hasFolders ? (
              <p className="mt-2 text-sm font-medium text-red-100">Folders and their contents will also be removed.</p>
            ) : null}
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
            {deleting ? "Deleting..." : items.length === 1 ? "Delete" : "Delete selected"}
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
  initialType,
  result,
  onClose,
  onCreated,
  onNotice,
}: {
  item: DriveItem | null;
  initialType: "standard" | "client-select";
  result: ShareResult | null;
  onClose: () => void;
  onCreated: (result: ShareResult) => void;
  onNotice: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [shareType, setShareType] = useState<"standard" | "private" | "beauty" | "client-select">(initialType);
  const [permission, setPermission] = useState<"VIEW_ONLY" | "DOWNLOAD">("DOWNLOAD");
  const [visibility, setVisibility] = useState<ShareVisibility>("PUBLIC_LOGIN");
  const [emails, setEmails] = useState<string[]>([]);
  const [expiry, setExpiry] = useState<"never" | "1d" | "7d" | "30d" | "custom">("never");
  const [customDate, setCustomDate] = useState("");
  const [note, setNote] = useState("");
  const [beautyClientName, setBeautyClientName] = useState("");
  const [beautySlug, setBeautySlug] = useState("");
  const [beautySubtitle, setBeautySubtitle] = useState("Your files are ready.");
  const [beautyTheme, setBeautyTheme] = useState<"light" | "dark" | "cream">("light");
  const [beautyLayout, setBeautyLayout] = useState<"clean" | "collage" | "grid" | "magazine">("clean");
  const [selectProjectName, setSelectProjectName] = useState("");
  const [selectClientName, setSelectClientName] = useState("");
  const [selectClientEmail, setSelectClientEmail] = useState("");
  const [selectMaxPhotos, setSelectMaxPhotos] = useState("");
  const [selectAllowDownload, setSelectAllowDownload] = useState(false);
  const [selectAllowEdit, setSelectAllowEdit] = useState(false);
  const [selectExpiresAt, setSelectExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!item) return;
    setTitle("");
    setVisibility("PUBLIC_LOGIN");
    setEmails([]);
    setNote("");
    setBeautyClientName(item.name);
    setBeautySlug(suggestSlug(item.name));
    setBeautySubtitle("Your files are ready.");
    setBeautyTheme("light");
    setBeautyLayout("clean");
    setSelectProjectName(item.name);
    setSelectClientName("");
    setSelectClientEmail("");
    setSelectMaxPhotos("");
    setSelectAllowDownload(false);
    setSelectAllowEdit(false);
    setSelectExpiresAt("");
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

  async function createClientSelectLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (activeItem.type !== "folder") {
      setError("Client Select is available for folders.");
      return;
    }

    setSubmitting(true);
    setError("");

    const projectName = selectProjectName.trim() || title.trim() || activeItem.name;
    const res = await fetch("/api/client-select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rootPath: activeItem.path,
        projectName,
        clientName: selectClientName,
        clientEmail: selectClientEmail,
        maxSelectedPhotos: selectMaxPhotos ? Number(selectMaxPhotos) : null,
        allowOriginalDownload: selectAllowDownload,
        allowEditAfterSubmit: selectAllowEdit,
        expiresAt: selectExpiresAt ? new Date(selectExpiresAt).toISOString() : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok || !data.ok) {
      setError(data.message || "Create Client Select failed.");
      return;
    }

    onCreated({
      url: `${window.location.origin}${data.publicUrl}`,
      token: data.link?.token || "",
      permission: "CLIENT_SELECT",
      expiresAt: null,
      allowedEmails: [],
      failedEmails: [],
    });
    onNotice("Client Select link created.");
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
                <span>{result.permission === "BEAUTY_SHARE" || result.permission === "CLIENT_SELECT" ? "Public no login" : result.allowedEmails.length ? result.allowedEmails.join(", ") : "Login protected"}</span>
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
              {result.permission === "CLIENT_SELECT" ? (
                <a href="/client-select" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10">
                  View in Client Select
                  <ChevronRight className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => { setShareType("standard"); setVisibility("PUBLIC_LOGIN"); }} className={`rounded-2xl border p-3 text-left ${shareType === "standard" ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <p className="font-bold text-white">Standard Link</p>
                <p className="mt-1 text-xs text-zinc-500">Login-protected public link.</p>
              </button>
              <button type="button" onClick={() => { setShareType("private"); setVisibility("PUBLIC_LOGIN"); }} className={`rounded-2xl border p-3 text-left ${shareType === "private" ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <p className="font-bold text-white">Private Email</p>
                <p className="mt-1 text-xs text-zinc-500">Only allowed emails.</p>
              </button>
              <button type="button" onClick={() => { setShareType("beauty"); setError(""); }} className={`rounded-2xl border p-3 text-left ${shareType === "beauty" ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <Sparkles className="h-4 w-4 text-[#d7ff3f]" />
                <p className="mt-2 font-bold text-white">Beauty Share</p>
              </button>
              <button type="button" onClick={() => { setShareType("client-select"); setError(""); }} className={`rounded-2xl border p-3 text-left sm:col-span-3 ${shareType === "client-select" ? "border-[#d7ff3f] bg-[#d7ff3f]/10" : "border-white/10 bg-black/20"}`}>
                <CheckSquare className="h-4 w-4 text-[#d7ff3f]" />
                <p className="mt-2 font-bold text-white">Client Select</p>
                <p className="mt-1 text-xs text-zinc-500">Public photo selection link.</p>
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
                      {(["light", "dark", "cream"] as const).map((value) => (
                        <button key={value} type="button" onClick={() => setBeautyTheme(value)} className={`rounded-xl border px-3 py-2 text-sm capitalize ${beautyTheme === value ? "border-[#d7ff3f] bg-[#d7ff3f]/10 text-white" : "border-white/10 text-zinc-400"}`}>
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-300">Layout</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(["clean", "collage", "grid", "magazine"] as const).map((value) => (
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
            ) : shareType === "client-select" ? (
              <form onSubmit={createClientSelectLink} className="space-y-4">
                {activeItem.type !== "folder" ? (
                  <p className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                    Client Select is available for folders.
                  </p>
                ) : null}
                <label className="block">
                  <span className="text-sm text-zinc-300">Project name</span>
                  <input value={selectProjectName} onChange={(event) => setSelectProjectName(event.target.value)} placeholder={activeItem.name} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-zinc-300">Client name</span>
                    <input value={selectClientName} onChange={(event) => setSelectClientName(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50" />
                  </label>
                  <label className="block">
                    <span className="text-sm text-zinc-300">Client email</span>
                    <input type="email" value={selectClientEmail} onChange={(event) => setSelectClientEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50" />
                  </label>
                </div>
                <label className="block">
                    <span className="text-sm text-zinc-300">Max photos client can choose</span>
                  <input type="number" min="0" value={selectMaxPhotos} onChange={(event) => setSelectMaxPhotos(event.target.value)} placeholder="Unlimited" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50" />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                  <span className="text-sm font-semibold text-zinc-200">Allow original downloads</span>
                  <input type="checkbox" checked={selectAllowDownload} onChange={(event) => setSelectAllowDownload(event.target.checked)} className="h-5 w-5 accent-[#d7ff3f]" />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                  <span className="text-sm font-semibold text-zinc-200">Allow client to edit after submit</span>
                  <input type="checkbox" checked={selectAllowEdit} onChange={(event) => setSelectAllowEdit(event.target.checked)} className="h-5 w-5 accent-[#d7ff3f]" />
                </label>
                <label className="block">
                  <span className="text-sm text-zinc-300">Deadline</span>
                  <input type="datetime-local" value={selectExpiresAt} onChange={(event) => setSelectExpiresAt(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50" />
                </label>
                {error ? <p className="rounded-2xl border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
                <button disabled={submitting || activeItem.type !== "folder"} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
                  {submitting ? "Creating..." : "Create Selection Link"}
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

                {shareType === "private" ? <EmailChipsInput value={emails} onChange={setEmails} placeholder="client@example.com, team@example.com" disabled={submitting} /> : null}

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
