"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Download,
  File,
  FileArchive,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  HardDrive,
  Home,
  Loader2,
  Search,
} from "lucide-react";

type DriveItemType = "folder" | "image" | "video" | "pdf" | "text" | "archive" | "file";
type PreviewStatus = "native" | "ready" | "missing" | "unsupported" | "queued" | "processing" | "failed";

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
};

function DriveIcon({ type, className }: { type: DriveItemType; className: string }) {
  if (type === "folder") return <Folder className={className} />;
  if (type === "video") return <FileVideo className={className} />;
  if (type === "image") return <FileImage className={className} />;
  if (type === "archive") return <FileArchive className={className} />;
  if (type === "pdf" || type === "text") return <FileText className={className} />;
  return <File className={className} />;
}

function fileUrl(token: string, filePath: string, download = false) {
  const params = new URLSearchParams({ path: filePath });
  if (download) params.set("download", "1");
  return `/api/share/${token}/file?${params.toString()}`;
}

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [path, setPath] = useState("");
  const [items, setItems] = useState<DriveItem[]>([]);
  const [shareName, setShareName] = useState("Shared Drive");
  const [canDownload, setCanDownload] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DriveItem | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFolder = useCallback(async (nextPath: string) => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/share/${token}/list?path=${encodeURIComponent(nextPath)}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok || !data?.ok) {
      setError(data?.message || "Share link expired or not found.");
      return;
    }

    setPath(data.path || "");
    setItems(data.items || []);
    setShareName(data.share?.name || "Shared Drive");
    setCanDownload(data.share?.canDownload !== false);
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFolder(""), 0);
    return () => window.clearTimeout(timer);
  }, [loadFolder]);

  useEffect(() => {
    if (!selected || selected.type !== "text") return;

    const item = selected;
    const controller = new AbortController();
    async function loadText() {
      const res = await fetch(fileUrl(token, item.path), { signal: controller.signal });
      if (res.ok) setPreviewText(await res.text());
    }

    void loadText();
    return () => controller.abort();
  }, [selected, token]);

  function open(item: DriveItem) {
    setPreviewText("");
    if (item.type === "folder") {
      setSelected(null);
      setQuery("");
      void loadFolder(item.path);
    } else {
      setSelected(item);
    }
  }

  const breadcrumbs = path.split("/").filter(Boolean);
  const filtered = query.trim()
    ? items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase().trim()))
    : items;
  const videoPreviewUrl =
    selected?.type === "video" && selected.previewStatus === "ready"
      ? selected.previewUrl
      : selected?.type === "video" && selected.previewStatus === "native"
        ? selected.previewUrl || selected.originalUrl
        : null;

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      <header className="border-b border-white/10 bg-[#08090d]/95 px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d7ff3f] text-black">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#d7ff3f]">VJMRTIM Asset Drive</p>
              <h1 className="font-semibold">{shareName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 md:w-96">
            <Search className="h-4 w-4 text-zinc-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shared folder..." className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_380px]">
        <section className="min-w-0">
          <nav className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm">
            <button onClick={() => void loadFolder("")} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 font-medium text-white hover:bg-white/10">
              <Home className="h-4 w-4 text-[#d7ff3f]" />
              Shared Root
            </button>
            {breadcrumbs.map((crumb, index) => (
              <div key={`${crumb}-${index}`} className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4 text-zinc-600" />
                <button onClick={() => void loadFolder(breadcrumbs.slice(0, index + 1).join("/"))} className="rounded-lg px-2 py-2 text-zinc-300 hover:bg-white/10">{crumb}</button>
              </div>
            ))}
          </nav>

          <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
            {loading ? (
              <div className="flex h-80 items-center justify-center gap-2 text-zinc-400"><Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />Loading...</div>
            ) : error ? (
              <div className="flex h-80 flex-col items-center justify-center gap-2 text-center text-amber-100"><AlertTriangle className="h-8 w-8" />{error}</div>
            ) : filtered.length === 0 ? (
              <div className="flex h-80 items-center justify-center text-zinc-500">No files here.</div>
            ) : (
              <div className="divide-y divide-white/10">
                {filtered.map((item) => (
                  <div key={item.path} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 hover:bg-white/[0.04]">
                    <button onClick={() => open(item)} className="grid min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-3 text-left">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-zinc-400"><DriveIcon type={item.type} className="h-5 w-5" /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{item.name}</span>
                        <span className="mt-1 block text-xs text-zinc-500">{item.size || "Folder"}</span>
                      </span>
                    </button>
                    {item.type !== "folder" && canDownload && item.directDownloadUrl ? <a href={item.directDownloadUrl} className="rounded-lg bg-[#d7ff3f] p-2 text-black"><Download className="h-4 w-4" /></a> : null}
                    {item.type === "folder" && canDownload ? (
                      <a
                        href={`/api/share/${token}/zip?path=${encodeURIComponent(item.path)}`}
                        onClick={(event) => {
                          if (!window.confirm("Folder ZIP can be slow for huge folders. For very large assets, download files individually.")) {
                            event.preventDefault();
                          }
                        }}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300"
                      >
                        ZIP
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
          {!selected ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center text-zinc-500">
              <File className="h-9 w-9" />
              <p>Select a file to preview.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-[#d7ff3f]">PREVIEW</p>
                <h2 className="mt-2 break-words text-xl font-semibold">{selected.name}</h2>
              </div>
              {selected.type === "image" ? <Image src={fileUrl(token, selected.path)} alt={selected.name} width={1200} height={800} unoptimized className="max-h-[420px] w-full rounded-lg object-contain" /> : null}
              {selected.type === "video" ? (
                videoPreviewUrl ? <video src={videoPreviewUrl} controls playsInline preload="metadata" className="w-full rounded-lg bg-black" /> : <div className="rounded-lg border border-white/10 p-8 text-center text-zinc-400">Preview cache not generated yet. Original file can still be downloaded.</div>
              ) : null}
              {selected.type === "pdf" ? <iframe src={fileUrl(token, selected.path)} title={selected.name} className="h-[420px] w-full rounded-lg bg-white" /> : null}
              {selected.type === "text" ? <pre className="max-h-[420px] overflow-auto rounded-lg border border-white/10 p-4 text-xs">{previewText}</pre> : null}
              {canDownload && selected.directDownloadUrl ? <a href={selected.directDownloadUrl} className="flex items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-3 font-semibold text-black"><Download className="h-4 w-4" />Download</a> : null}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
