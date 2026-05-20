"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronRight,
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
import { formatBytes } from "@/components/drive/drive-ui";

type UserItem = {
  name: string;
  path: string;
  type: string;
  size: string | null;
  bytes: number;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/drive", label: "My Drive", icon: HardDrive, active: true },
  { href: "/dashboard#shared", label: "Shared with Me", icon: Share2 },
  { href: "/dashboard#account", label: "Account", icon: User },
];

export function UserDriveClient() {
  const [items, setItems] = useState<UserItem[]>([]);
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
                <div className="divide-y divide-white/10">
                  {filteredItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => (item.type === "folder" ? void load(item.path) : undefined)}
                      className="grid w-full grid-cols-[42px_minmax(0,1fr)_92px] items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04] md:grid-cols-[42px_minmax(0,1fr)_140px_140px]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                        {item.type === "folder" ? (
                          <Folder className="h-5 w-5 text-[#d7ff3f]" />
                        ) : (
                          <File className="h-5 w-5 text-zinc-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{item.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">{item.type === "folder" ? "Folder" : "File"}</p>
                      </div>

                      <span className="text-right text-xs text-zinc-500 md:text-left">
                        {item.size || formatBytes(item.bytes || 0)}
                      </span>

                      <span className="hidden text-right text-xs text-zinc-600 md:block">
                        {item.type === "folder" ? "Open folder" : "Stored file"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </section>

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