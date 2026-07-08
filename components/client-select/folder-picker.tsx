"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Folder, FolderCheck, Home, Loader2, Search, X } from "lucide-react";

export type SelectedDriveFolder = {
  name: string;
  path: string;
  itemCount?: number | null;
};

type FolderRow = {
  name: string;
  path: string;
};

export function FolderPicker({
  open,
  initialPath,
  onClose,
  onSelect,
}: {
  open: boolean;
  initialPath: string;
  onClose: () => void;
  onSelect: (folder: SelectedDriveFolder) => void;
}) {
  const [path, setPath] = useState("");
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadFolder = useCallback(async (nextPath: string) => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/client-select/folders?path=${encodeURIComponent(nextPath)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok || !data.ok) {
      setError(data.message || "Folder unavailable.");
      return;
    }

    setPath(data.path || "");
    setFolders(data.folders || []);
    setItemCount(typeof data.itemCount === "number" ? data.itemCount : null);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void loadFolder(initialPath || ""), 0);
    return () => window.clearTimeout(timer);
  }, [initialPath, loadFolder, open]);

  const breadcrumbs = path.split("/").filter(Boolean);
  const visibleFolders = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return folders;
    return folders.filter((folder) => folder.name.toLowerCase().includes(keyword));
  }, [folders, query]);

  if (!open) return null;

  const folderName = breadcrumbs.at(-1) || "My Drive";

  return (
    <div className="fixed inset-0 z-[140] flex items-end bg-black/75 backdrop-blur-sm md:items-center md:justify-center md:p-4">
      <section className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#111318] shadow-2xl md:max-w-2xl md:rounded-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 md:px-5">
          <div>
            <p className="text-xs font-bold uppercase text-[#d7ff3f]">Selected folder</p>
            <h2 className="mt-1 text-lg font-bold text-white">Choose a folder</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close folder picker"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="border-b border-white/10 px-4 py-3 md:px-5">
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
            <button
              type="button"
              onClick={() => void loadFolder("")}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 font-semibold text-zinc-200 hover:bg-white/10"
            >
              <Home className="h-4 w-4 text-[#d7ff3f]" />
              My Drive
            </button>
            {breadcrumbs.map((crumb, index) => (
              <div key={`${crumb}-${index}`} className="flex shrink-0 items-center gap-1">
                <ChevronRight className="h-4 w-4 text-zinc-600" />
                <button
                  type="button"
                  onClick={() => void loadFolder(breadcrumbs.slice(0, index + 1).join("/"))}
                  className="max-w-44 truncate rounded-lg px-2 py-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  {crumb}
                </button>
              </div>
            ))}
          </nav>

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search folders"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div className="min-h-64 flex-1 overflow-y-auto p-2 md:p-3">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />
              Loading folders...
            </div>
          ) : error ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <Folder className="h-9 w-9 text-zinc-600" />
              <p className="mt-3 font-semibold text-white">This folder is unavailable</p>
              <p className="mt-1 text-sm text-zinc-500">{error}</p>
            </div>
          ) : visibleFolders.length ? (
            <div className="divide-y divide-white/[0.07]">
              {visibleFolders.map((folder) => (
                <button
                  key={folder.path}
                  type="button"
                  onClick={() => void loadFolder(folder.path)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-white/[0.05]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d7ff3f]/10 text-[#d7ff3f]">
                    <Folder className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{folder.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">{folder.path}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <Folder className="h-9 w-9 text-zinc-600" />
              <p className="mt-3 font-semibold text-white">{query ? "No matching folders" : "No subfolders here"}</p>
              <p className="mt-1 text-sm text-zinc-500">You can still use the current folder.</p>
            </div>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-white/10 bg-black/15 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{folderName}</p>
            <p className="truncate text-xs text-zinc-500">
              {path || "My Drive"}{itemCount === null ? "" : ` · ${itemCount} item${itemCount === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            type="button"
            disabled={loading || Boolean(error)}
            onClick={() => onSelect({ name: folderName, path, itemCount })}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#c9ef38] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderCheck className="h-4 w-4" />
            Use this folder
          </button>
        </footer>
      </section>
    </div>
  );
}
