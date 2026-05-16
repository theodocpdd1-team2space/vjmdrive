"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Home,
  Loader2,
  LogOut,
  Search,
} from "lucide-react";

type DriveItemType = "folder" | "image" | "video" | "pdf" | "text" | "archive" | "file";
type PreviewStatus = "native" | "ready" | "missing" | "unsupported";

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
};

type AuthState = "checking" | "guest" | "authed";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewTruncated, setPreviewTruncated] = useState(false);

  function clearPreviewState() {
    setPreviewText("");
    setPreviewError("");
    setPreviewLoading(false);
    setPreviewTruncated(false);
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
    setQuery("");
  }

  function openItem(item: DriveItem) {
    if (item.type === "folder") {
      setSelected(null);
      clearPreviewState();
      setQuery("");
      void loadDrive(item.path);
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
    setQuery("");
    void loadDrive(targetPath);
  }

  const breadcrumbs = currentPath.split("/").filter(Boolean);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();
    if (!needle) return items;
    return items.filter((item) => item.name.toLowerCase().includes(needle));
  }, [items, query]);

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

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_380px]">
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

          <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
            <div className="hidden grid-cols-[minmax(0,1fr)_130px_120px] border-b border-white/10 px-4 py-3 text-xs font-medium text-zinc-500 md:grid">
              <span>Name</span>
              <span>Modified</span>
              <span className="text-right">Size</span>
            </div>

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
              <div className="flex h-80 flex-col items-center justify-center gap-2 px-5 text-center">
                <Folder className="h-9 w-9 text-zinc-600" />
                <p className="text-sm font-medium text-zinc-300">
                  {query ? `No result for "${query}".` : "Folder kosong."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {filtered.map((item) => {
                  const Icon = iconFor(item.type);
                  const isSelected = selected?.path === item.path;

                  return (
                    <div
                      key={item.path}
                      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 transition ${
                        isSelected ? "bg-[#d7ff3f]/10" : "hover:bg-white/[0.045]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => openItem(item)}
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
                          <span className="mt-1 block truncate text-xs text-zinc-500 md:hidden">
                            {typeLabel(item)} · {formatDate(item.modified)}
                          </span>
                          <span className="mt-1 hidden truncate text-xs text-zinc-500 md:block">
                            {typeLabel(item)} · {previewStatusLabel(item)}
                          </span>
                        </span>
                      </button>

                      <div className="grid shrink-0 grid-cols-[auto_auto] items-center gap-2 md:grid-cols-[130px_92px_36px]">
                        <span className="hidden text-sm text-zinc-500 md:block">
                          {formatDate(item.modified)}
                        </span>
                        <span className="hidden text-right text-sm text-zinc-500 md:block">
                          {item.size || "-"}
                        </span>
                        {item.type === "folder" ? (
                          <ChevronRight className="h-4 w-4 text-zinc-600" />
                        ) : (
                          <a
                            href={fileUrl(item.path, true)}
                            title={`Download ${item.name}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-[#d7ff3f] hover:text-black"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                      </div>
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
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#d7ff3f]">DETAIL</p>
                  <h2 className="mt-2 break-words text-xl font-semibold text-white">{selected.name}</h2>
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
                          Preview cache not generated yet
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {typeLabel(selected)} · {selected.size || "Unknown size"}
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
                        {typeLabel(selected)} · {selected.size || "Unknown size"}
                      </p>
                    </div>
                    <a
                      href={fileUrl(selected.path, true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-semibold text-black transition hover:bg-[#c7f02f]"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </div>
                ) : null}
              </div>

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
              </div>

              <a
                href={fileUrl(selected.path, true)}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-3 font-semibold text-black transition hover:bg-[#c7f02f]"
              >
                <Download className="h-4 w-4" />
                Download Original
              </a>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
