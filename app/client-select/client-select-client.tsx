"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckSquare,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Folder,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  Power,
  RefreshCw,
  Search,
  User,
  X,
} from "lucide-react";
import { FolderPicker, type SelectedDriveFolder } from "@/components/client-select/folder-picker";

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

const EMPTY_FORM = {
  projectName: "",
  clientName: "",
  clientEmail: "",
  rootPath: "",
  maxSelectedPhotos: "",
  allowOriginalDownload: false,
  allowEditAfterSubmit: false,
  expiresAt: "",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function shortDate(value?: string | null) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "SUBMITTED") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (status === "VIEWED") return "border-sky-300/20 bg-sky-300/10 text-sky-100";
  if (status === "LOCKED") return "border-red-300/20 bg-red-300/10 text-red-100";
  if (status === "EXPIRED") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  return "border-[#d7ff3f]/20 bg-[#d7ff3f]/10 text-[#d7ff3f]";
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function computedStatus(row: LinkRow) {
  if (row.displayStatus) return row.displayStatus;
  if (row.status === "LOCKED" || row.status === "SUBMITTED") return row.status;
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) return "EXPIRED";
  return row.status;
}

function folderName(path: string) {
  return path.split("/").filter(Boolean).at(-1) || "My Drive";
}

function ToggleRow({
  checked,
  onChange,
  title,
  body,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  body: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-white/10 px-3 py-3">
      <span>
        <span className="block text-sm font-semibold text-zinc-100">{title}</span>
        <span className="mt-0.5 block text-xs text-zinc-500">{body}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-[#d7ff3f]" : "bg-zinc-700"}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="sr-only"
        />
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-black transition ${checked ? "left-6" : "left-1"}`} />
      </span>
    </label>
  );
}

export function ClientSelectClient({ initialLinks }: { initialLinks: LinkRow[] }) {
  const [links, setLinks] = useState<LinkRow[]>(initialLinks);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notice, setNotice] = useState("");
  const [createdLink, setCreatedLink] = useState<LinkRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<SelectedDriveFolder | null>(null);
  const [creating, setCreating] = useState(false);
  const [disablingId, setDisablingId] = useState("");
  const [loadingDetail, setLoadingDetail] = useState("");
  const [runningAction, setRunningAction] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

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

  function resetCreate() {
    setForm(EMPTY_FORM);
    setSelectedFolder(null);
    setCreatedLink(null);
  }

  function closeCreate() {
    if (creating) return;
    setCreateOpen(false);
    setFolderPickerOpen(false);
    resetCreate();
  }

  async function createLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    if (!selectedFolder) {
      setNotice("Choose a folder before creating the selection link.");
      return;
    }

    setCreating(true);
    setNotice("");
    const res = await fetch("/api/client-select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        rootPath: selectedFolder.path,
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

    const nextLink = {
      ...data.link,
      publicUrl: data.publicUrl,
      absolutePublicUrl: data.absolutePublicUrl,
      selectedCount: 0,
      submittedAt: null,
      latestSubmission: null,
      allowEditAfterSubmit: data.link?.allowEditAfterSubmit || false,
      expiresAt: data.link?.expiresAt || null,
    } as LinkRow;
    setCreatedLink(nextLink);
    setNotice("Selection link created.");
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
    if (!window.confirm(`Disable selection link for "${row.projectName}"? Existing submissions will be kept.`)) return;
    setDisablingId(row.id);
    setNotice("");
    const res = await fetch(`/api/client-select/${row.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setDisablingId("");
    if (!res.ok || !data.ok) {
      setNotice(data.message || "Disable link failed.");
      return;
    }
    setNotice("Selection link disabled.");
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
    if (detail?.link.id === row.id) await openDetail({ ...row, ...patch } as LinkRow);
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
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Client Select</h1>
          <p className="mt-1 text-sm text-zinc-500">Let clients choose photos for editing.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#c9ef38]"
        >
          <Plus className="h-4 w-4" />
          New Selection Link
        </button>
      </header>

      {notice ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-4 py-3 text-sm font-medium text-[#d7ff3f]">
          <Check className="h-4 w-4 shrink-0" />
          {notice}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.025]">
        <div className="flex flex-col gap-3 border-b border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 sm:max-w-sm">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects or clients"
              className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#101217] px-3 py-2.5 text-sm text-zinc-300 outline-none sm:flex-none"
            >
              {["ALL", "WAITING_CLIENT", "VIEWED", "SUBMITTED", "EXPIRED", "LOCKED"].map((status) => (
                <option key={status} value={status}>
                  {status === "ALL" ? "All statuses" : statusLabel(status)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void refreshLinks()}
              className="rounded-lg border border-white/10 p-2.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              title="Refresh links"
              aria-label="Refresh links"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {filteredLinks.length ? (
          <div className="divide-y divide-white/[0.07]">
            {filteredLinks.map((row) => {
              const displayStatus = computedStatus(row);
              return (
                <article key={row.id} className="p-4 transition hover:bg-white/[0.025]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-bold text-white">{row.projectName}</h2>
                        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${statusClass(displayStatus)}`}>
                          {statusLabel(displayStatus)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          {row.clientName || "Client not specified"}
                        </span>
                        {row.clientEmail ? (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5" />
                            {row.clientEmail}
                          </span>
                        ) : null}
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <Folder className="h-3.5 w-3.5" />
                          {folderName(row.rootPath)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 border-y border-white/[0.07] py-3 lg:w-[390px] lg:border-x lg:border-y-0 lg:px-5 lg:py-0">
                      <div>
                        <p className="text-[11px] text-zinc-600">Selected</p>
                        <p className="mt-1 text-sm font-semibold text-zinc-200">
                          {row.selectedCount} / {row.maxSelectedPhotos || "Unlimited"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-zinc-600">Deadline</p>
                        <p className="mt-1 text-sm font-semibold text-zinc-200">{shortDate(row.expiresAt)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-zinc-600">{row.submittedAt ? "Submitted" : "Created"}</p>
                        <p className="mt-1 text-sm font-semibold text-zinc-200">
                          {shortDate(row.submittedAt || row.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <button
                        type="button"
                        onClick={() => copyLink(row.absolutePublicUrl)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                        title="Copy link"
                        aria-label="Copy link"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <a
                        href={row.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                        title="Open public link"
                        aria-label="Open public link"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => void openDetail(row)}
                        className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                      >
                        {loadingDetail === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                        Details
                      </button>
                      {row.status !== "LOCKED" ? (
                        <button
                          type="button"
                          onClick={() => void disableLink(row)}
                          disabled={disablingId === row.id}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-red-300/10 hover:text-red-200 disabled:opacity-50"
                          title="Disable link"
                          aria-label="Disable link"
                        >
                          {disablingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-500">
              <CheckSquare className="h-6 w-6" />
            </span>
            <p className="mt-4 font-semibold text-white">{links.length ? "No matching selection links" : "No selection links yet"}</p>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              {links.length ? "Try another search or status." : "Choose a Drive folder and send your first photo selection gallery."}
            </p>
            {!links.length ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-2.5 text-sm font-bold text-black"
              >
                <Plus className="h-4 w-4" />
                New Selection Link
              </button>
            ) : null}
          </div>
        )}
      </section>

      {createOpen ? (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/70 backdrop-blur-sm">
          <section className="h-full w-full overflow-y-auto border-l border-white/10 bg-[#101217] shadow-2xl sm:max-w-lg">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[#101217]/95 px-5 py-4 backdrop-blur">
              <div>
                <p className="text-xs font-bold uppercase text-[#d7ff3f]">Selection Link</p>
                <h2 className="mt-1 text-xl font-bold text-white">{createdLink ? "Link ready" : "New Client Select"}</h2>
              </div>
              <button type="button" onClick={closeCreate} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </header>

            {createdLink ? (
              <div className="p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#d7ff3f] text-black">
                  <Check className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-white">Your selection link is ready.</h3>
                <p className="mt-1 text-sm text-zinc-500">Share it with your client or open the gallery to check it.</p>
                <p className="mt-5 break-all rounded-lg border border-white/10 bg-black/25 px-3 py-3 text-sm text-zinc-200">
                  {createdLink.absolutePublicUrl}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => copyLink(createdLink.absolutePublicUrl)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </button>
                  <a href={createdLink.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-2.5 text-sm font-bold text-black">
                    <ExternalLink className="h-4 w-4" />
                    Open Link
                  </a>
                  <button type="button" onClick={() => { closeCreate(); void openDetail(createdLink); }} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-white/10 sm:col-span-2">
                    View in Client Select
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={createLink} className="space-y-5 p-5">
                <div>
                  <p className="text-sm font-semibold text-zinc-200">Selected folder</p>
                  {selectedFolder ? (
                    <div className="mt-2 flex items-center gap-3 rounded-lg border border-[#d7ff3f]/25 bg-[#d7ff3f]/[0.06] p-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d7ff3f]/10 text-[#d7ff3f]">
                        <Folder className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">{selectedFolder.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-zinc-500">
                          {selectedFolder.path || "My Drive"}
                          {selectedFolder.itemCount === null || selectedFolder.itemCount === undefined ? "" : ` · ${selectedFolder.itemCount} items`}
                        </span>
                      </span>
                      <button type="button" onClick={() => setFolderPickerOpen(true)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10">
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFolderPickerOpen(true)}
                      className="mt-2 flex w-full items-center gap-3 rounded-lg border border-dashed border-white/20 px-4 py-4 text-left transition hover:border-[#d7ff3f]/40 hover:bg-[#d7ff3f]/[0.04]"
                    >
                      <Folder className="h-5 w-5 text-[#d7ff3f]" />
                      <span>
                        <span className="block text-sm font-semibold text-white">Choose Folder</span>
                        <span className="mt-0.5 block text-xs text-zinc-500">Browse folders in My Drive</span>
                      </span>
                    </button>
                  )}
                </div>

                <label className="block">
                  <span className="text-sm font-semibold text-zinc-200">Project name</span>
                  <input
                    required
                    value={form.projectName}
                    onChange={(event) => setForm((current) => ({ ...current, projectName: event.target.value }))}
                    placeholder="Wedding selection"
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm outline-none focus:border-[#d7ff3f]/50"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-zinc-200">Client name <span className="font-normal text-zinc-600">(optional)</span></span>
                    <input value={form.clientName} onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm outline-none focus:border-[#d7ff3f]/50" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-zinc-200">Client email <span className="font-normal text-zinc-600">(optional)</span></span>
                    <input type="email" value={form.clientEmail} onChange={(event) => setForm((current) => ({ ...current, clientEmail: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm outline-none focus:border-[#d7ff3f]/50" />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-zinc-200">Max photos client can choose</span>
                    <input type="number" min="0" value={form.maxSelectedPhotos} onChange={(event) => setForm((current) => ({ ...current, maxSelectedPhotos: event.target.value }))} placeholder="Unlimited" className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm outline-none focus:border-[#d7ff3f]/50" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-zinc-200">Deadline</span>
                    <input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm outline-none focus:border-[#d7ff3f]/50" />
                  </label>
                </div>

                <div className="space-y-2">
                  <ToggleRow checked={form.allowOriginalDownload} onChange={(checked) => setForm((current) => ({ ...current, allowOriginalDownload: checked }))} title="Allow original downloads" body="Clients can download original files from the gallery." />
                  <ToggleRow checked={form.allowEditAfterSubmit} onChange={(checked) => setForm((current) => ({ ...current, allowEditAfterSubmit: checked }))} title="Allow client to edit after submit" body="The client can reopen and update their selection." />
                </div>

                <button disabled={creating || !selectedFolder} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-3 text-sm font-bold text-black transition hover:bg-[#c9ef38] disabled:cursor-not-allowed disabled:opacity-50">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
                  {creating ? "Creating..." : "Create Selection Link"}
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}

      <FolderPicker
        open={folderPickerOpen}
        initialPath={selectedFolder?.path || ""}
        onClose={() => setFolderPickerOpen(false)}
        onSelect={(folder) => {
          setSelectedFolder(folder);
          setForm((current) => ({
            ...current,
            rootPath: folder.path,
            projectName: current.projectName || folder.name,
          }));
          setFolderPickerOpen(false);
        }}
      />

      {detail ? (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/70 backdrop-blur-sm md:items-center md:justify-center md:p-4">
          <section className="max-h-[92vh] w-full overflow-auto rounded-t-2xl border border-white/10 bg-[#101217] p-4 shadow-2xl md:max-w-4xl md:rounded-2xl md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-[#d7ff3f]">Submission detail</p>
                <h2 className="mt-1 truncate text-xl font-bold text-white">{detail.link.projectName}</h2>
                <p className="mt-1 text-sm text-zinc-500">{activeSubmission ? formatDate(activeSubmission.submittedAt) : "Waiting for client selection"}</p>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close detail">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => copyLink(detail.link.absolutePublicUrl)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10"><Copy className="h-4 w-4" />Copy link</button>
              <a href={detail.link.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10"><ExternalLink className="h-4 w-4" />Open link</a>
              <button type="button" onClick={() => { if (activeSubmission) window.location.href = `/api/client-select/${detail.link.id}/export?format=txt`; }} disabled={!activeSubmission} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-40"><Download className="h-4 w-4" />TXT</button>
              <button type="button" onClick={() => { if (activeSubmission) window.location.href = `/api/client-select/${detail.link.id}/export?format=csv`; }} disabled={!activeSubmission} className="inline-flex items-center gap-2 rounded-lg bg-[#d7ff3f] px-3 py-2 text-sm font-bold text-black disabled:opacity-40"><Download className="h-4 w-4" />CSV</button>
              <button type="button" onClick={() => { window.location.href = `/api/client-select/${detail.link.id}/download-selected-zip`; }} disabled={!activeSubmission} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-40"><Download className="h-4 w-4" />Selected ZIP</button>
              <button type="button" onClick={() => void createSelectedFolder(detail.link)} disabled={!activeSubmission || runningAction === `${detail.link.id}:copy`} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-40">{runningAction === `${detail.link.id}:copy` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Folder className="h-4 w-4" />}Create Selected Folder</button>
              <button type="button" onClick={() => void patchLink(detail.link, { allowEditAfterSubmit: !detail.link.allowEditAfterSubmit }, "Allow edit setting updated.")} disabled={runningAction === `${detail.link.id}:patch`} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-40"><MoreHorizontal className="h-4 w-4" />{detail.link.allowEditAfterSubmit ? "Disable edits" : "Allow edits"}</button>
              <button type="button" onClick={() => { const value = window.prompt("New deadline (YYYY-MM-DDTHH:mm) or blank for no deadline", detail.link.expiresAt ? detail.link.expiresAt.slice(0, 16) : ""); if (value === null) return; void patchLink(detail.link, { expiresAt: value ? new Date(value).toISOString() : null }, "Deadline updated."); }} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10"><CalendarDays className="h-4 w-4" />Deadline</button>
            </div>

            {activeSubmission ? (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Client", activeSubmission.clientName || detail.link.clientName || "-"],
                    ["Email", activeSubmission.clientEmail || detail.link.clientEmail || "-"],
                    ["Selected", String(activeSubmission.selectedFilePaths.length)],
                    ["Submitted", formatDate(activeSubmission.updatedAt || activeSubmission.submittedAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="border-l border-white/10 px-3">
                      <p className="text-xs text-zinc-600">{label}</p>
                      <p className="mt-1 break-all text-sm font-semibold text-white">{value}</p>
                    </div>
                  ))}
                </div>

                {detail.link.selectedFolderPath ? (
                  <div className="rounded-lg border border-[#d7ff3f]/20 bg-[#d7ff3f]/[0.06] p-3">
                    <p className="text-xs font-bold uppercase text-[#d7ff3f]">Selected folder</p>
                    <p className="mt-1 break-all text-sm font-semibold text-white">{detail.link.selectedFolderPath}</p>
                    <p className="mt-1 text-xs text-zinc-400">Copied {detail.link.selectedFolderCopiedCount || 0}, skipped {detail.link.selectedFolderSkippedCount || 0}</p>
                  </div>
                ) : null}

                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-zinc-600">Global note</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{activeSubmission.globalNote || "-"}</p>
                </div>

                <div className="overflow-hidden rounded-lg border border-white/10">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 border-b border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold uppercase text-zinc-600">
                    <span>Filename</span><span>Path</span>
                  </div>
                  <div className="divide-y divide-white/[0.07]">
                    {(detail.selectedFiles.length ? detail.selectedFiles : activeSubmission.selectedFilePaths.map((filePath, index) => ({
                      filename: activeSubmission.selectedFilenames[index] || filePath.split("/").pop() || filePath,
                      path: filePath,
                      thumbnailUrl: null,
                      size: null,
                      previewStatus: "missing",
                      note: activeSubmission.selectedFiles[index]?.note || "",
                    }))).map((file) => (
                      <div key={file.path} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm md:grid-cols-[48px_minmax(0,1fr)_minmax(0,1.2fr)]">
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30 text-zinc-500">
                          {file.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={file.thumbnailUrl} alt={file.filename} className="h-full w-full object-cover" />
                          ) : <FileText className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{file.filename}</p>
                          {file.note ? <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-zinc-400">{file.note}</p> : null}
                        </div>
                        <span className="hidden truncate text-zinc-500 md:block">{file.path}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex min-h-48 flex-col items-center justify-center text-center">
                <FileText className="h-9 w-9 text-zinc-600" />
                <p className="mt-3 font-semibold text-zinc-300">No submission yet</p>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
