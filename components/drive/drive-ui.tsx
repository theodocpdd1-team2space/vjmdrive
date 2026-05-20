"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  CheckSquare,
  Copy,
  Download,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  Grid2X2,
  LayoutGrid,
  List,
  Loader2,
  Play,
  RotateCw,
  Share2,
  Square,
  X,
} from "lucide-react";

export type DriveItemType = "folder" | "image" | "video" | "audio" | "pdf" | "document" | "spreadsheet" | "presentation" | "text" | "archive" | "design" | "file";
export type PreviewStatus = "native" | "ready" | "missing" | "unsupported" | "queued" | "processing" | "failed";
export type ViewMode = "grid" | "list" | "compact";

export type DriveItem = {
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
  isLargeFile?: boolean;
};

const TEXT_PREVIEW_LIMIT = 256 * 1024;

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}

export function typeLabel(item: DriveItem) {
  if (item.type === "folder") return "Folder";
  if (item.type === "pdf") return "PDF";
  if (item.type === "document") return "Document";
  if (item.type === "spreadsheet") return "Spreadsheet";
  if (item.type === "presentation") return "Presentation";
  if (item.type === "audio") return "Audio";
  if (item.type === "design") return "Design";
  if (item.extension) return item.extension.toUpperCase();
  return "File";
}

export function previewStatusLabel(item: DriveItem) {
  if (item.type === "folder") return "Folder";
  if (item.type === "video" && item.previewStatus === "ready") return "Cached";
  if (item.type === "video" && item.previewStatus === "native") return "Native";
  if (item.type === "video" && item.previewStatus === "queued") return "Queued";
  if (item.type === "video" && item.previewStatus === "processing") return "Processing";
  if (item.type === "video" && item.previewStatus === "failed") return "Failed";
  if (item.type === "video" && item.previewStatus === "missing") return "Missing";
  return item.canPreview ? "Native" : "Unsupported";
}

export function downloadModeLabel(item: DriveItem) {
  return item.downloadMode === "direct" ? "Direct download" : "App download";
}

export function badgeClass(kind: "ok" | "warn" | "muted" | "danger") {
  if (kind === "ok") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (kind === "warn") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  if (kind === "danger") return "border-red-300/20 bg-red-300/10 text-red-100";
  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

export function previewBadgeClass(status: PreviewStatus) {
  if (status === "ready" || status === "native") return badgeClass("ok");
  if (status === "missing") return badgeClass("warn");
  if (status === "failed") return badgeClass("danger");
  return badgeClass("muted");
}

export function DriveIcon({ type, className }: { type: DriveItemType; className: string }) {
  if (type === "folder") return <Folder className={className} />;
  if (type === "video") return <FileVideo className={className} />;
  if (type === "audio") return <FileAudio className={className} />;
  if (type === "image") return <FileImage className={className} />;
  if (type === "archive") return <FileArchive className={className} />;
  if (type === "pdf" || type === "text" || type === "document" || type === "spreadsheet" || type === "presentation") return <FileText className={className} />;
  return <File className={className} />;
}

export function PreviewStatusBadge({ item }: { item: DriveItem }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${previewBadgeClass(item.previewStatus)}`}>
      {previewStatusLabel(item)}
    </span>
  );
}

export function DownloadModeBadge({ item }: { item: DriveItem }) {
  return (
    <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-zinc-300">
      {item.downloadMode === "direct" ? "Direct" : "App"}
    </span>
  );
}

export function ViewToggle({
  value,
  onChange,
  compact = true,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  compact?: boolean;
}) {
  const options: Array<{ value: ViewMode; label: string; icon: typeof Grid2X2 }> = [
    { value: "grid", label: "Grid", icon: Grid2X2 },
    { value: "list", label: "List", icon: List },
    { value: "compact", label: "Compact", icon: LayoutGrid },
  ];

  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-1">
      {options.map(({ value: option, label, icon: Icon }) => (
        <button
          key={option}
          type="button"
          title={`${label} View`}
          onClick={() => onChange(option)}
          className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
            value === option ? "bg-[#d7ff3f] text-black" : "text-zinc-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icon className="h-4 w-4" />
          {!compact ? <span>{label}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function FileThumbnail({
  item,
  size = "grid",
}: {
  item: DriveItem;
  size?: "grid" | "row" | "compact" | "modal";
}) {
  const isSmall = size === "row" || size === "compact";
  const imageSrc =
    item.type === "image"
      ? item.thumbnailUrl || item.previewUrl || item.originalUrl
      : item.type === "video"
        ? item.thumbnailUrl
        : null;
  const wrapperClass = isSmall
    ? "h-10 w-10"
    : size === "modal"
      ? "h-full min-h-72 w-full"
      : "aspect-video w-full";

  return (
    <span
      className={`relative flex overflow-hidden rounded-lg border ${
        item.type === "folder"
          ? "border-[#d7ff3f]/20 bg-[#d7ff3f]/10 text-[#d7ff3f]"
          : "border-white/10 bg-black/30 text-zinc-400"
      } ${wrapperClass}`}
    >
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={item.name}
          fill
          sizes={isSmall ? "40px" : "(max-width: 768px) 50vw, 260px"}
          unoptimized
          className="object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <DriveIcon type={item.type} className={isSmall ? "h-5 w-5" : "h-9 w-9"} />
        </span>
      )}
      {item.type === "video" ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/10">
          <span className={`${isSmall ? "h-6 w-6" : "h-10 w-10"} flex items-center justify-center rounded-full bg-black/60 text-white backdrop-blur`}>
            <Play className={`${isSmall ? "h-3 w-3" : "h-5 w-5"} fill-white`} />
          </span>
        </span>
      ) : null}
      {item.previewStatus === "missing" || item.previewStatus === "failed" || item.previewStatus === "queued" ? (
        <span className={`absolute left-2 top-2 rounded-md border px-1.5 py-0.5 text-[10px] ${previewBadgeClass(item.previewStatus)}`}>
          {previewStatusLabel(item)}
        </span>
      ) : null}
    </span>
  );
}

export function EmptyState({
  icon: Icon = Folder,
  title,
  body,
}: {
  icon?: typeof Folder;
  title: string;
  body?: string;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center text-zinc-500">
      <Icon className="h-10 w-10" />
      <div>
        <p className="font-medium text-zinc-300">{title}</p>
        {body ? <p className="mt-1 text-sm">{body}</p> : null}
      </div>
    </div>
  );
}

export function LoadingState({ label = "Loading files..." }: { label?: string }) {
  return (
    <div className="flex min-h-72 items-center justify-center gap-2 text-zinc-400">
      <Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />
      {label}
    </div>
  );
}

export function SelectionCheckbox({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10"
      aria-label={checked ? "Deselect item" : "Select item"}
    >
      {checked ? <CheckSquare className="h-5 w-5 text-[#d7ff3f]" /> : <Square className="h-5 w-5" />}
    </button>
  );
}

function previewSource(item: DriveItem | null) {
  if (!item || item.type !== "video") return null;
  if (item.previewStatus === "ready") return item.previewUrl;
  if (item.previewStatus === "native") return item.previewUrl || item.originalUrl;
  return null;
}

export function PreviewModal({
  item,
  open,
  canDownload,
  isAdmin = false,
  onClose,
  onCopy,
  onShare,
  onRequestPreview,
}: {
  item: DriveItem | null;
  open: boolean;
  canDownload: boolean;
  isAdmin?: boolean;
  onClose: () => void;
  onCopy: (text: string) => void;
  onShare?: (path: string) => void;
  onRequestPreview?: (path: string) => void;
}) {
  const [textPreview, setTextPreview] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [videoError, setVideoError] = useState("");

  useEffect(() => {
    if (!open || !item) return;
    if (item.type !== "text") return;

    const activeItem = item;
    const controller = new AbortController();
    const headers = new Headers();
    if (activeItem.bytes > TEXT_PREVIEW_LIMIT) headers.set("Range", `bytes=0-${TEXT_PREVIEW_LIMIT - 1}`);
    async function loadTextPreview() {
      try {
        const res = await fetch(activeItem.originalUrl, { headers, signal: controller.signal, cache: "no-store" });
        if (!res.ok && res.status !== 206) throw new Error("Text preview failed.");
        setTextPreview(await res.text());
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setPreviewError(caught instanceof Error ? caught.message : "Text preview failed.");
      }
    }

    void loadTextPreview();
    return () => controller.abort();
  }, [item, open]);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open || !item) return null;

  const videoUrl = previewSource(item);
  const copyTarget = item.directDownloadUrl || item.originalUrl;

  return (
    <div className="fixed inset-0 z-[100] flex bg-black/88 text-zinc-100 backdrop-blur-sm">
      <div className="flex h-full w-full flex-col">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#090a0f]/95 px-3 py-2 md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close preview">
              <X className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-white md:text-base" title={item.name}>{item.name}</h2>
              <p className="mt-0.5 truncate text-xs text-zinc-500">{typeLabel(item)} {item.size ? `- ${item.size}` : ""}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isAdmin && onShare ? (
              <button type="button" onClick={() => onShare(item.path)} className="rounded-lg border border-white/10 p-2 text-zinc-300 hover:bg-white/10" title="Share access">
                <Share2 className="h-4 w-4" />
              </button>
            ) : null}
            <button type="button" onClick={() => onCopy(copyTarget)} className="rounded-lg border border-white/10 p-2 text-zinc-300 hover:bg-white/10" title="Copy link">
              <Copy className="h-4 w-4" />
            </button>
            {canDownload && item.directDownloadUrl ? (
              <a href={item.directDownloadUrl} className="inline-flex items-center gap-2 rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </a>
            ) : null}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="flex min-h-0 items-center justify-center overflow-auto p-3 md:p-6">
            <div className="flex min-h-[50vh] w-full items-center justify-center">
              {item.type === "image" ? (
                <Image
                  src={item.originalUrl}
                  alt={item.name}
                  width={1800}
                  height={1200}
                  unoptimized
                  className="max-h-[calc(100vh-9rem)] w-auto max-w-full rounded-lg object-contain"
                />
              ) : null}

              {item.type === "video" ? (
                videoUrl && !videoError ? (
                  <video
                    key={`${item.path}-${item.previewStatus}`}
                    src={videoUrl}
                    poster={item.thumbnailUrl || undefined}
                    controls
                    playsInline
                    preload="metadata"
                    onError={() => setVideoError("Preview failed. Request preview cache or download original.")}
                    className="max-h-[calc(100vh-10rem)] w-full max-w-6xl rounded-lg bg-black shadow-2xl"
                  />
                ) : (
                  <div className="mx-auto flex max-w-lg flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] p-8 text-center">
                    <FileVideo className="h-12 w-12 text-zinc-500" />
                    <p className="mt-4 text-sm font-semibold text-white">
                      {videoError || "Preview cache not generated yet."}
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">Original file can still be downloaded.</p>
                    {isAdmin && onRequestPreview ? (
                      <button type="button" onClick={() => onRequestPreview(item.path)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black">
                        <RotateCw className="h-4 w-4" />
                        Request Preview
                      </button>
                    ) : null}
                  </div>
                )
              ) : null}

              {item.type === "audio" ? (
                <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] p-8 text-center">
                  <FileAudio className="h-12 w-12 text-[#d7ff3f]" />
                  <p className="mt-4 text-sm font-semibold text-white">{item.name}</p>
                  <audio src={item.originalUrl} controls preload="metadata" className="mt-5 w-full" />
                </div>
              ) : null}

              {item.type === "pdf" ? (
                <iframe src={item.originalUrl} title={item.name} className="h-[calc(100vh-10rem)] w-full max-w-6xl rounded-lg bg-white" />
              ) : null}

              {item.type === "text" ? (
                <div className="max-h-[calc(100vh-10rem)] w-full max-w-5xl overflow-auto rounded-lg border border-white/10 bg-[#0d0f15] p-4">
                  {!textPreview && !previewError ? <LoadingState label="Loading text preview..." /> : null}
                  {previewError ? <p className="text-sm text-amber-200">{previewError}</p> : null}
                  {textPreview && !previewError ? <pre className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{textPreview}</pre> : null}
                </div>
              ) : null}

              {!["image", "video", "audio", "pdf", "text"].includes(item.type) ? (
                <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] p-8 text-center">
                  <DriveIcon type={item.type} className="h-12 w-12 text-zinc-500" />
                  <p className="mt-4 text-sm font-semibold text-white">Preview not available for {typeLabel(item)}</p>
                  <p className="mt-2 text-sm text-zinc-500">This file type may need a desktop app or browser plugin. Download the original file to open it locally.</p>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="hidden border-l border-white/10 bg-[#0d0f15]/95 p-4 lg:block">
            <p className="text-xs font-semibold text-[#d7ff3f]">DETAILS</p>
            <div className="mt-4 space-y-3">
              <DetailLine label="Name" value={item.name} />
              <DetailLine label="Type" value={typeLabel(item)} />
              <DetailLine label="Size" value={item.size || "-"} />
              <DetailLine label="Modified" value={formatDate(item.modified)} />
              <DetailLine label="Preview" value={previewStatusLabel(item)} />
              <DetailLine label="Download" value={downloadModeLabel(item)} />
            </div>
            {item.type === "video" && item.thumbnailUrl ? (
              <div className="mt-5">
                <p className="mb-2 text-xs text-zinc-500">Thumbnail</p>
                <FileThumbnail item={item} />
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/10 pb-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}
