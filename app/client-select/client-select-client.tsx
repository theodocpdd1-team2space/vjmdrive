"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { CheckSquare, Copy, Download, ExternalLink, FileText, Loader2, Plus, Power, RefreshCw, Search, X } from "lucide-react";

type Submission = {
  id: string;
  selectedFiles: Array<{ path: string; filename: string; note: string }>;
  selectedFilePaths: string[];
  selectedFilenames: string[];
  clientName: string;
  clientEmail: string;
  globalNote: string;
  submittedAt: string;
  updatedAt?: string | null;
  emailSentAt?: string | null;
  emailError?: string | null;
  status: "SUBMITTED";
};

type LinkRow = {
  id: string;
  token: string;
  projectName: string;
  clientName: string;
  clientEmail: string;
  rootPath: string;
  maxSelectedPhotos: number | null;
  allowOriginalDownload: boolean;
  allowEditAfterSubmit: boolean;
  expiresAt: string | null;
  status: string;
  displayStatus?: string;
  createdAt: string;
  submittedAt?: string | null;
  updatedAt?: string | null;
  viewedAt?: string | null;
  selectedFolderPath?: string | null;
  selectedFolderCopiedCount?: number;
  selectedFolderSkippedCount?: number;
  selectedFolderErrors?: string[];
  selectedFolderCreatedAt?: string | null;
  publicUrl: string;
  absolutePublicUrl: string;
  selectedCount: number;
  latestSubmission?: Submission | null;
};

type DetailState = {
  link: LinkRow;
  submissions: Submission[];
  latestSubmission: Submission | null;
  selectedFiles: Array<{
    filename: string;
    path: string;
    thumbnailUrl: string | null;
    size: string | null;
    previewStatus: string;
    note?: string;
    error?: string;
  }>;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function exportTxt(row: LinkRow, submission: Submission | null) {
  if (!submission) return;
  window.location.href = `/api/client-select/${row.id}/export?format=txt`;
}

function exportCsv(row: LinkRow, submission: Submission | null) {
  if (!submission) return;
  window.location.href = `/api/client-select/${row.id}/export?format=csv`;
}

function statusClass(status: string) {
  if (status === "SUBMITTED") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (status === "VIEWED") return "border-sky-300/20 bg-sky-300/10 text-sky-100";
  if (status === "LOCKED") return "border-red-300/20 bg-red-300/10 text-red-100";
  if (status === "EXPIRED") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  return "border-[#d7ff3f]/20 bg-[#d7ff3f]/10 text-[#d7ff3f]";
}

function computedStatus(row: LinkRow) {
  if (row.displayStatus) return row.displayStatus;
  if (row.status === "LOCKED" || row.status === "SUBMITTED") return row.status;
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) return "EXPIRED";
  return row.status;
}

export function ClientSelectClient({ initialLinks }: { initialLinks: LinkRow[] }) {
  const [links, setLinks] = useState<LinkRow[]>(initialLinks);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notice, setNotice] = useState("");
  const [createdLink, setCreatedLink] = useState<LinkRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [disablingId, setDisablingId] = useState("");
  const [loadingDetail, setLoadingDetail] = useState("");
  const [runningAction, setRunningAction] = useState("");
  const [form, setForm] = useState({
    projectName: "",
    clientName: "",
    clientEmail: "",
    rootPath: "",
    maxSelectedPhotos: "",
    allowOriginalDownload: false,
    allowEditAfterSubmit: false,
    expiresAt: "",
  });

  const filteredLinks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return links.filter((link) => {
      const displayStatus = computedStatus(link);
      if (statusFilter !== "ALL" && displayStatus !== statusFilter) return false;
      if (!keyword) return true;
      return [link.projectName, link.clientName, link.clientEmail, link.rootPath, displayStatus]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [links, query, statusFilter]);

  async function refreshLinks() {
    const res = await fetch("/api/client-select", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) setLinks(data.links || []);
  }

  async function createLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setNotice("");

    const res = await fetch("/api/client-select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        maxSelectedPhotos: form.maxSelectedPhotos ? Number(form.maxSelectedPhotos) : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setCreating(false);

    if (!res.ok || !data.ok) {
      setNotice(data.message || "Create Client Select failed.");
      return;
    }

    setNotice("Client Select link created.");
    setCreatedLink({
      ...data.link,
      publicUrl: data.publicUrl,
      absolutePublicUrl: data.absolutePublicUrl,
      selectedCount: 0,
      submittedAt: null,
      latestSubmission: null,
      allowEditAfterSubmit: data.link?.allowEditAfterSubmit || false,
      expiresAt: data.link?.expiresAt || null,
    });
    setForm({
      projectName: "",
      clientName: "",
      clientEmail: "",
      rootPath: "",
      maxSelectedPhotos: "",
      allowOriginalDownload: false,
      allowEditAfterSubmit: false,
      expiresAt: "",
    });
    await refreshLinks();
  }

  async function openDetail(row: LinkRow) {
    setLoadingDetail(row.id);
    const res = await fetch(`/api/client-select/${row.id}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    setLoadingDetail("");

    if (!res.ok || !data.ok) {
      setNotice(data.message || "Load detail failed.");
      return;
    }

    setDetail({
      link: data.link,
      submissions: data.submissions || [],
      latestSubmission: data.latestSubmission || null,
      selectedFiles: data.selectedFiles || [],
    });
  }

  async function disableLink(row: LinkRow) {
    if (!window.confirm(`Disable Client Select link for "${row.projectName}"? Existing submissions will be kept.`)) return;
    setDisablingId(row.id);
    setNotice("");

    const res = await fetch(`/api/client-select/${row.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setDisablingId("");

    if (!res.ok || !data.ok) {
      setNotice(data.message || "Disable link failed.");
      return;
    }

    setNotice("Client Select link disabled.");
    await refreshLinks();
  }

  async function patchLink(row: LinkRow, patch: Record<string, unknown>, successMessage: string) {
    setRunningAction(`${row.id}:patch`);
    const res = await fetch(`/api/client-select/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: row.projectName,
        clientName: row.clientName,
        clientEmail: row.clientEmail,
        maxSelectedPhotos: row.maxSelectedPhotos,
        allowOriginalDownload: row.allowOriginalDownload,
        allowEditAfterSubmit: row.allowEditAfterSubmit,
        expiresAt: row.expiresAt,
        status: row.status,
        isActive: true,
        ...patch,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setRunningAction("");

    if (!res.ok || !data.ok) {
      setNotice(data.message || "Update Client Select failed.");
      return;
    }

    setNotice(successMessage);
    await refreshLinks();
    if (detail?.link.id === row.id) await openDetail(row);
  }

  function downloadSelectedZip(row: LinkRow) {
    window.location.href = `/api/client-select/${row.id}/download-selected-zip`;
  }

  async function createSelectedFolder(row: LinkRow) {
    if (!window.confirm(`Create a copied folder for selected files in "${row.projectName}"?`)) return;
    setRunningAction(`${row.id}:copy`);
    const res = await fetch(`/api/client-select/${row.id}/create-selected-folder`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setRunningAction("");

    if (!res.ok || !data.ok) {
      setNotice(data.message || "Create selected folder failed.");
      return;
    }

    setNotice(`Selected folder created. Copied ${data.result?.copiedCount || 0}, skipped ${data.result?.skippedCount || 0}.`);
    await refreshLinks();
    if (detail?.link.id === row.id) await openDetail(row);
  }

  function copyLink(url: string) {
    void navigator.clipboard.writeText(url).catch(() => undefined);
    setNotice("Link copied.");
  }

  const activeSubmission = detail?.latestSubmission || null;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {notice ? (
        <div className="rounded-2xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-4 py-3 text-sm font-medium text-[#d7ff3f]">
          {notice}
        </div>
      ) : null}

      {createdLink ? (
        <div className="rounded-3xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 p-4">
          <p className="font-black text-[#d7ff3f]">Client Select link ready</p>
          <p className="mt-3 break-all rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-zinc-100">
            {createdLink.absolutePublicUrl}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => copyLink(createdLink.absolutePublicUrl)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10">
              <Copy className="h-4 w-4" />
              Copy Link
            </button>
            <a href={createdLink.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#d7ff3f] px-3 py-2 text-sm font-black text-black">
              <ExternalLink className="h-4 w-4" />
              Open Link
            </a>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <form onSubmit={createLink} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d7ff3f] text-black">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Create Client Select Link</p>
              <p className="mt-1 text-xs text-zinc-500">Use a folder path from My Drive.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-sm text-zinc-300">Project name</span>
              <input
                value={form.projectName}
                onChange={(event) => setForm((current) => ({ ...current, projectName: event.target.value }))}
                placeholder="Wedding Selection"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <label className="block">
                <span className="text-sm text-zinc-300">Client name</span>
                <input
                  value={form.clientName}
                  onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50"
                />
              </label>
              <label className="block">
                <span className="text-sm text-zinc-300">Client email</span>
                <input
                  type="email"
                  value={form.clientEmail}
                  onChange={(event) => setForm((current) => ({ ...current, clientEmail: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm text-zinc-300">Root folder path</span>
              <input
                value={form.rootPath}
                onChange={(event) => setForm((current) => ({ ...current, rootPath: event.target.value }))}
                placeholder="Projects/Client Folder"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50"
              />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-300">Max selected photos</span>
              <input
                type="number"
                min="0"
                value={form.maxSelectedPhotos}
                onChange={(event) => setForm((current) => ({ ...current, maxSelectedPhotos: event.target.value }))}
                placeholder="Unlimited"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
              <span className="text-sm font-semibold text-zinc-200">Allow original download</span>
              <input
                type="checkbox"
                checked={form.allowOriginalDownload}
                onChange={(event) => setForm((current) => ({ ...current, allowOriginalDownload: event.target.checked }))}
                className="h-5 w-5 accent-[#d7ff3f]"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
              <span className="text-sm font-semibold text-zinc-200">Allow edit after submit</span>
              <input
                type="checkbox"
                checked={form.allowEditAfterSubmit}
                onChange={(event) => setForm((current) => ({ ...current, allowEditAfterSubmit: event.target.checked }))}
                className="h-5 w-5 accent-[#d7ff3f]"
              />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-300">Deadline</span>
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#d7ff3f]/50"
              />
            </label>
          </div>

          <button
            disabled={creating}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
            {creating ? "Creating..." : "Create Client Select Link"}
          </button>
        </form>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-white">Client Select Links</p>
              <p className="mt-1 text-xs text-zinc-500">{filteredLinks.length} link(s)</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                {["ALL", "WAITING_CLIENT", "VIEWED", "SUBMITTED", "EXPIRED", "LOCKED"].map((status) => (
                  <option key={status} value={status} className="bg-[#101217]">
                    {status}
                  </option>
                ))}
              </select>
              <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search links..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
                />
              </div>
              <button
                type="button"
                onClick={() => void refreshLinks()}
                className="rounded-2xl border border-white/10 p-2 text-zinc-300 hover:bg-white/10"
                aria-label="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-3 p-3 xl:grid-cols-2">
            {filteredLinks.map((row) => (
              <article key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-black text-white">{row.projectName}</h3>
                    <span className={`rounded-lg border px-2 py-1 text-[11px] font-black ${statusClass(computedStatus(row))}`}>
                      {computedStatus(row)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-500">{row.clientName || "No client name"} {row.clientEmail ? `- ${row.clientEmail}` : ""}</p>
                  <p className="mt-1 truncate text-xs text-zinc-600">{row.rootPath || "Drive root"}</p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-zinc-500">Selected</p>
                    <p className="mt-1 font-bold text-white">{row.selectedCount} / {row.maxSelectedPhotos || "Unlimited"}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-zinc-500">Created</p>
                    <p className="mt-1 text-sm font-bold text-white">{formatDate(row.createdAt)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-zinc-500">Submitted</p>
                    <p className="mt-1 text-sm font-bold text-white">{formatDate(row.updatedAt || row.submittedAt)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-zinc-300">
                    Deadline: {formatDate(row.expiresAt)}
                  </span>
                  <span className={`rounded-lg border px-2 py-1 ${row.allowEditAfterSubmit ? "border-sky-300/20 bg-sky-300/10 text-sky-100" : "border-white/10 bg-white/[0.03] text-zinc-400"}`}>
                    {row.allowEditAfterSubmit ? "Edit allowed" : "Edit locked after submit"}
                  </span>
                  <span className={`rounded-lg border px-2 py-1 ${row.allowOriginalDownload ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/[0.03] text-zinc-400"}`}>
                    {row.allowOriginalDownload ? "Original download ON" : "Original download OFF"}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyLink(row.absolutePublicUrl)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </button>
                  <a
                    href={row.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Link
                  </a>
                  <button
                    type="button"
                    onClick={() => void openDetail(row)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#d7ff3f] px-3 py-2 text-xs font-black text-black"
                  >
                    {loadingDetail === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Detail
                  </button>
                  {row.status !== "LOCKED" ? (
                    <button
                      type="button"
                      onClick={() => void disableLink(row)}
                      disabled={disablingId === row.id}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-300/20 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {disablingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                      Disable Link
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {!filteredLinks.length ? (
              <div className="col-span-full flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
                <CheckSquare className="h-10 w-10 text-zinc-500" />
                <div>
                  <p className="font-bold text-white">No Client Select links yet</p>
                  <p className="mt-1 text-sm text-zinc-500">Create one from a folder to start collecting photo choices.</p>
                </div>
                <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="inline-flex items-center gap-2 rounded-xl bg-[#d7ff3f] px-4 py-3 text-sm font-black text-black">
                  <Plus className="h-4 w-4" />
                  Create Client Select
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </section>

      {detail ? (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/70 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-4">
          <section className="max-h-[92vh] w-full overflow-auto rounded-t-3xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:max-w-3xl md:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff3f]">Submission Detail</p>
                <h2 className="mt-2 truncate text-xl font-black text-white">{detail.link.projectName}</h2>
                <p className="mt-1 text-sm text-zinc-500">{activeSubmission ? formatDate(activeSubmission.submittedAt) : "No submission yet"}</p>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close detail">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyLink(detail.link.absolutePublicUrl)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10"
              >
                <Copy className="h-4 w-4" />
                Copy public link
              </button>
              <a
                href={detail.link.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10"
              >
                <ExternalLink className="h-4 w-4" />
                Open public link
              </a>
              <button
                type="button"
                onClick={() => exportTxt(detail.link, activeSubmission)}
                disabled={!activeSubmission}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export TXT
              </button>
              <button
                type="button"
                onClick={() => exportCsv(detail.link, activeSubmission)}
                disabled={!activeSubmission}
                className="inline-flex items-center gap-2 rounded-xl bg-[#d7ff3f] px-3 py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => downloadSelectedZip(detail.link)}
                disabled={!activeSubmission}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Download Selected ZIP
              </button>
              <button
                type="button"
                onClick={() => void createSelectedFolder(detail.link)}
                disabled={!activeSubmission || runningAction === `${detail.link.id}:copy`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {runningAction === `${detail.link.id}:copy` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Selected Folder
              </button>
              <button
                type="button"
                onClick={() => void patchLink(detail.link, { allowEditAfterSubmit: !detail.link.allowEditAfterSubmit }, "Allow edit setting updated.")}
                disabled={runningAction === `${detail.link.id}:patch`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Toggle Allow Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  const value = window.prompt("New deadline (YYYY-MM-DDTHH:mm) or blank for no deadline", detail.link.expiresAt ? detail.link.expiresAt.slice(0, 16) : "");
                  if (value === null) return;
                  void patchLink(detail.link, { expiresAt: value ? new Date(value).toISOString() : null }, "Deadline updated.");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10"
              >
                Extend Deadline
              </button>
            </div>

            {activeSubmission ? (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs text-zinc-500">Client</p>
                    <p className="mt-1 font-bold text-white">{activeSubmission.clientName || detail.link.clientName || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs text-zinc-500">Email</p>
                    <p className="mt-1 break-all font-bold text-white">{activeSubmission.clientEmail || detail.link.clientEmail || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs text-zinc-500">Selected</p>
                    <p className="mt-1 font-bold text-white">{activeSubmission.selectedFilePaths.length}</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs text-zinc-500">Submitted</p>
                    <p className="mt-1 font-bold text-white">{formatDate(activeSubmission.submittedAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs text-zinc-500">Updated</p>
                    <p className="mt-1 font-bold text-white">{formatDate(activeSubmission.updatedAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs text-zinc-500">Email</p>
                    <p className="mt-1 text-sm font-bold text-white">{activeSubmission.emailSentAt ? `Sent ${formatDate(activeSubmission.emailSentAt)}` : activeSubmission.emailError || "-"}</p>
                  </div>
                </div>
                {detail.link.selectedFolderPath ? (
                  <div className="rounded-2xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#d7ff3f]">Selected folder</p>
                    <p className="mt-2 break-all text-sm font-semibold text-white">{detail.link.selectedFolderPath}</p>
                    <p className="mt-1 text-xs text-zinc-300">
                      Copied {detail.link.selectedFolderCopiedCount || 0}, skipped {detail.link.selectedFolderSkippedCount || 0}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-zinc-500">Global note</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{activeSubmission.globalNote || "-"}</p>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 border-b border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                    <span>Filename</span>
                    <span>Path</span>
                  </div>
                  <div className="divide-y divide-white/10">
                    {(detail.selectedFiles.length ? detail.selectedFiles : activeSubmission.selectedFilePaths.map((filePath, index) => ({
                      filename: activeSubmission.selectedFilenames[index] || filePath.split("/").pop() || filePath,
                      path: filePath,
                      thumbnailUrl: null,
                      size: null,
                      previewStatus: "missing",
                      note: activeSubmission.selectedFiles[index]?.note || "",
                    }))).map((file) => (
                      <div key={file.path} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 px-3 py-2 text-sm md:grid-cols-[56px_minmax(0,1fr)_minmax(0,1.2fr)]">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30 text-zinc-500">
                          {file.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={file.thumbnailUrl} alt={file.filename} className="h-full w-full object-cover" />
                          ) : (
                            <FileText className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{file.filename}</p>
                          {file.note ? <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-zinc-300">{file.note}</p> : null}
                        </div>
                        <span className="truncate text-zinc-500 md:block">{file.path}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex min-h-48 flex-col items-center justify-center gap-3 text-center text-zinc-500">
                <FileText className="h-10 w-10" />
                <p className="font-bold text-zinc-300">No submission yet</p>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
