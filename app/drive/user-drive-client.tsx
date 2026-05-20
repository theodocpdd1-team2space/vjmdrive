"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, File, Folder, Loader2, Upload } from "lucide-react";
import { formatBytes } from "@/components/drive/drive-ui";

type UserItem = { name: string; path: string; type: string; size: string | null; bytes: number };

export function UserDriveClient() {
  const [items, setItems] = useState<UserItem[]>([]);
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (nextPath: string) => {
    setLoading(true);
    const res = await fetch(`/api/user/files/list?path=${encodeURIComponent(nextPath)}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && data.ok) {
      setItems(data.items || []);
      setPath(data.path || "");
    } else {
      setNotice(data.message || "Failed to load drive.");
    }
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
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
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

  useEffect(() => {
    const timer = window.setTimeout(() => void load(""), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main className="min-h-screen bg-[#08090d] p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-[#d7ff3f]"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
            <h1 className="mt-3 text-2xl font-semibold">My Drive</h1>
            <p className="mt-1 text-sm text-zinc-500">{path || "Home"}</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-semibold text-black">
            <Upload className="h-4 w-4" />
            Upload
            <input type="file" multiple className="hidden" disabled={uploading} onChange={(event) => void upload(event.target.files)} />
          </label>
        </div>
        {notice ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">{notice}</p> : null}
        {uploading ? (
          <div className="fixed inset-x-3 bottom-3 z-50 rounded-3xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:left-auto md:right-6 md:w-96">
            <div className="flex justify-between text-sm"><span>Uploading files</span><span>{progress}%</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#d7ff3f]" style={{ width: `${progress}%` }} /></div>
          </div>
        ) : null}
        <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
          {loading ? <div className="flex h-72 items-center justify-center gap-2 text-zinc-400"><Loader2 className="h-5 w-5 animate-spin text-[#d7ff3f]" />Loading...</div> : null}
          {!loading && items.length === 0 ? <p className="p-8 text-center text-zinc-500">No files yet.</p> : null}
          <div className="divide-y divide-white/10">
            {items.map((item) => (
              <button key={item.path} onClick={() => item.type === "folder" ? void load(item.path) : undefined} className="grid w-full grid-cols-[36px_minmax(0,1fr)_80px] items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04]">
                {item.type === "folder" ? <Folder className="h-5 w-5 text-[#d7ff3f]" /> : <File className="h-5 w-5 text-zinc-400" />}
                <span className="truncate text-sm text-white">{item.name}</span>
                <span className="text-right text-xs text-zinc-500">{item.size || formatBytes(item.bytes || 0)}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
