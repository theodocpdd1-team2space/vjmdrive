"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Copy,
  ExternalLink,
  Eye,
  FileKey,
  Filter,
  Link2,
  Loader2,
  Mail,
  MailPlus,
  Pin,
  PinOff,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import type { ShareLink } from "@/lib/share-db";

type FilterMode = "ALL" | "ACTIVE" | "EXPIRED" | "DISABLED" | "PINNED" | "PUBLIC" | "PRIVATE_EMAILS";

type EmailEditorState = {
  draft: string;
  emails: string[];
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function uniqueEmails(values: string[]) {
  return Array.from(
    new Set(
      values
        .map(normalizeEmail)
        .filter(Boolean)
        .filter(isValidEmail)
    )
  );
}

function getShareStatus(share: ShareLink, now: number) {
  const expired = Boolean(share.expiresAt && new Date(share.expiresAt).getTime() < now);

  if (share.disabledAt) return "DISABLED";
  if (expired) return "EXPIRED";

  return "ACTIVE";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID");
}

export function AdminSharesClient({
  initialShares,
  origin,
  now,
}: {
  initialShares: ShareLink[];
  origin: string;
  now: number;
}) {
  const [shares, setShares] = useState(initialShares);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("ALL");
  const [updatingToken, setUpdatingToken] = useState<string | null>(null);
  const [editors, setEditors] = useState<Record<string, EmailEditorState>>({});

  function getEditor(share: ShareLink) {
    return (
      editors[share.token] || {
        draft: "",
        emails: share.allowedEmails || [],
      }
    );
  }

  function setEditor(token: string, next: EmailEditorState) {
    setEditors((current) => ({
      ...current,
      [token]: next,
    }));
  }

  async function refresh() {
    const res = await fetch("/api/admin/shares", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok) {
      setShares(data.links || []);
    }
  }

  async function patchShare(token: string, patch: Record<string, unknown>, successMessage = "Share updated.") {
    setNotice("");
    setUpdatingToken(token);

    const res = await fetch(`/api/admin/shares/${token}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });

    const data = await res.json().catch(() => ({}));

    setUpdatingToken(null);

    if (!res.ok || !data.ok) {
      setNotice(data.message || "Update failed.");
      return;
    }

    setNotice(successMessage);
    await refresh();
  }

  async function disableShare(token: string) {
    setNotice("");
    setUpdatingToken(token);

    const res = await fetch(`/api/admin/shares/${token}`, {
      method: "DELETE",
    });

    setUpdatingToken(null);
    setNotice(res.ok ? "Share disabled." : "Failed to disable share.");

    await refresh();
  }

  async function resendInvite(token: string, email: string) {
    setNotice("");
    setUpdatingToken(token);

    const res = await fetch(`/api/admin/shares/${token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    setUpdatingToken(null);
    setNotice(res.ok ? `Invite sent to ${email}.` : "Invite failed.");
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setNotice("Link copied.");
  }

  function pushDraftAsEmails(share: ShareLink) {
    const editor = getEditor(share);

    const parts = editor.draft
      .split(/[,\n;]/)
      .map(normalizeEmail)
      .filter(Boolean);

    const nextEmails = uniqueEmails([...editor.emails, ...parts]);

    setEditor(share.token, {
      draft: "",
      emails: nextEmails,
    });
  }

  function handleEmailInput(share: ShareLink, value: string) {
    const shouldCommit = /[,;\n]/.test(value);

    if (!shouldCommit) {
      setEditor(share.token, {
        ...getEditor(share),
        draft: value,
      });
      return;
    }

    const editor = getEditor(share);
    const parts = value
      .split(/[,\n;]/)
      .map(normalizeEmail)
      .filter(Boolean);

    setEditor(share.token, {
      draft: "",
      emails: uniqueEmails([...editor.emails, ...parts]),
    });
  }

  function removeEmail(share: ShareLink, email: string) {
    const editor = getEditor(share);

    setEditor(share.token, {
      ...editor,
      emails: editor.emails.filter((item) => item !== email),
    });
  }

  async function saveEmails(share: ShareLink) {
    const editor = getEditor(share);
    const emails = uniqueEmails([...editor.emails, editor.draft]);

    setEditor(share.token, {
      draft: "",
      emails,
    });

    await patchShare(
      share.token,
      {
        allowedEmails: emails,
        visibility: emails.length > 0 ? "PRIVATE_EMAILS" : "PUBLIC",
      },
      "Allowed emails updated."
    );
  }

  const metrics = useMemo(() => {
    const active = shares.filter((share) => getShareStatus(share, now) === "ACTIVE").length;
    const expired = shares.filter((share) => getShareStatus(share, now) === "EXPIRED").length;
    const disabled = shares.filter((share) => getShareStatus(share, now) === "DISABLED").length;
    const pinned = shares.filter((share) => share.pinned).length;
    const privateShares = shares.filter((share) => share.visibility === "PRIVATE_EMAILS").length;

    return {
      total: shares.length,
      active,
      expired,
      disabled,
      pinned,
      privateShares,
    };
  }, [shares, now]);

  const sortedShares = useMemo(() => {
    return [...shares].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [shares]);

  const filteredShares = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return sortedShares.filter((share) => {
      const status = getShareStatus(share, now);

      const matchesQuery =
        !keyword ||
        share.title.toLowerCase().includes(keyword) ||
        share.name.toLowerCase().includes(keyword) ||
        share.rootPath.toLowerCase().includes(keyword) ||
        share.token.toLowerCase().includes(keyword) ||
        share.allowedEmails.some((email) => email.toLowerCase().includes(keyword));

      if (!matchesQuery) return false;

      if (filter === "ACTIVE") return status === "ACTIVE";
      if (filter === "EXPIRED") return status === "EXPIRED";
      if (filter === "DISABLED") return status === "DISABLED";
      if (filter === "PINNED") return Boolean(share.pinned);
      if (filter === "PUBLIC") return share.visibility === "PUBLIC";
      if (filter === "PRIVATE_EMAILS") return share.visibility === "PRIVATE_EMAILS";

      return true;
    });
  }, [sortedShares, query, filter, now]);

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      <section className="border-b border-white/10 bg-[#08090d]/90 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 transition hover:text-[#d7ff3f]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to admin
            </Link>

            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d7ff3f] text-black shadow-[0_0_35px_rgba(215,255,63,0.16)]">
                <Link2 className="h-6 w-6" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d7ff3f]">driveOne Admin</p>
                <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">Shares</h1>
              </div>
            </div>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Manage pinned links, public login-protected shares, private email access, and invitation emails.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Total shares</p>
            <p className="mt-1 text-3xl font-black text-white">{metrics.total}</p>
          </div>
        </div>
      </section>

      <section className="px-4 py-5 md:px-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="grid gap-3 md:grid-cols-6">
            <Metric icon={Link2} label="Total" value={String(metrics.total)} />
            <Metric icon={BadgeCheck} label="Active" value={String(metrics.active)} />
            <Metric icon={Eye} label="Private" value={String(metrics.privateShares)} />
            <Metric icon={Pin} label="Pinned" value={String(metrics.pinned)} />
            <Metric icon={FileKey} label="Expired" value={String(metrics.expired)} />
            <Metric icon={Trash2} label="Disabled" value={String(metrics.disabled)} />
          </div>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, path, token, or email..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <Filter className="h-4 w-4 shrink-0 text-zinc-500" />
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as FilterMode)}
                  className="w-full bg-transparent text-sm font-bold text-white outline-none"
                >
                  <option value="ALL">All shares</option>
                  <option value="ACTIVE">Active only</option>
                  <option value="PINNED">Pinned only</option>
                  <option value="PUBLIC">Public only</option>
                  <option value="PRIVATE_EMAILS">Private email only</option>
                  <option value="EXPIRED">Expired only</option>
                  <option value="DISABLED">Disabled only</option>
                </select>
              </label>
            </div>

            {notice ? (
              <div className="mt-4 rounded-2xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-4 py-3 text-sm font-bold text-[#d7ff3f]">
                {notice}
              </div>
            ) : null}
          </section>

          <div className="grid gap-4">
            {filteredShares.map((share) => {
              const url = `${origin}/share/${share.token}`;
              const status = getShareStatus(share, now);
              const editor = getEditor(share);
              const isUpdating = updatingToken === share.token;

              return (
                <article
                  key={share.token}
                  className={`overflow-hidden rounded-3xl border bg-white/[0.035] shadow-2xl shadow-black/20 ${
                    share.pinned ? "border-[#d7ff3f]/30" : "border-white/10"
                  }`}
                >
                  <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-lg font-black text-white">{share.title || share.name}</h2>
                            {share.pinned ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#d7ff3f]/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#d7ff3f]">
                                <Pin className="h-3 w-3" />
                                Pinned
                              </span>
                            ) : null}
                            <StatusBadge status={status} />
                            <Pill>{share.visibility === "PUBLIC" ? "Public login" : "Private email"}</Pill>
                            <Pill>{share.permission}</Pill>
                          </div>

                          <p className="mt-2 truncate text-sm text-zinc-500">{share.rootPath || "PublicShare"}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => void patchShare(share.token, { pinned: !share.pinned }, share.pinned ? "Share unpinned." : "Share pinned.")}
                            disabled={isUpdating}
                            className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold transition disabled:opacity-50 ${
                              share.pinned
                                ? "border-[#d7ff3f]/30 bg-[#d7ff3f]/10 text-[#d7ff3f] hover:bg-[#d7ff3f]/15"
                                : "border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            {share.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                            {share.pinned ? "Unpin" : "Pin"}
                          </button>

                          <button
                            onClick={() => void copy(url)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-300 hover:bg-white/10 hover:text-white"
                          >
                            <Copy className="h-4 w-4" />
                            Copy
                          </button>

                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-300 hover:bg-white/10 hover:text-white"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open
                          </a>
                        </div>
                      </div>

                      <p className="mt-4 break-all rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-zinc-300">
                        {url}
                      </p>

                      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                        <Info label="Created" value={formatDate(share.createdAt)} />
                        <Info label="Updated" value={formatDate(share.updatedAt)} />
                        <Info label="Expires" value={formatDate(share.expiresAt)} />
                      </div>

                      <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-black text-white">Allowed emails</p>
                            <p className="mt-1 text-xs text-zinc-500">
                              Type email then press comma, Enter, Tab, or semicolon to create a chip.
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() =>
                                void patchShare(
                                  share.token,
                                  {
                                    visibility: "PUBLIC",
                                    allowedEmails: [],
                                  },
                                  "Share changed to public login-protected."
                                )
                              }
                              disabled={isUpdating}
                              className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-300 hover:bg-white/10 disabled:opacity-50"
                            >
                              Make Public
                            </button>

                            <button
                              onClick={() => void saveEmails(share)}
                              disabled={isUpdating}
                              className="inline-flex items-center gap-2 rounded-2xl bg-[#d7ff3f] px-3 py-2 text-xs font-black text-black disabled:opacity-50"
                            >
                              {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MailPlus className="h-3.5 w-3.5" />}
                              Save Emails
                            </button>
                          </div>
                        </div>

                        <div className="flex min-h-[56px] flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#08090d] px-3 py-2">
                          {editor.emails.map((email) => (
                            <span
                              key={email}
                              className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-zinc-100"
                            >
                              <span className="max-w-[220px] truncate">{email}</span>
                              <button
                                onClick={() => removeEmail(share, email)}
                                className="rounded-full text-zinc-500 hover:text-white"
                                aria-label={`Remove ${email}`}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </span>
                          ))}

                          <input
                            value={editor.draft}
                            onChange={(event) => handleEmailInput(share, event.target.value)}
                            onBlur={() => pushDraftAsEmails(share)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === "Tab") {
                                event.preventDefault();
                                pushDraftAsEmails(share);
                              }

                              if (event.key === "Backspace" && !editor.draft && editor.emails.length > 0) {
                                removeEmail(share, editor.emails[editor.emails.length - 1]);
                              }
                            }}
                            placeholder={editor.emails.length ? "Add another email..." : "Add email, comma separated..."}
                            className="min-w-[220px] flex-1 bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {editor.emails.map((email) => (
                            <button
                              key={`${share.token}-${email}-invite`}
                              onClick={() => void resendInvite(share.token, email)}
                              disabled={isUpdating || !share.allowedEmails.includes(email)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Invite {email}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <aside className="rounded-3xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-black text-white">Share settings</p>
                          <p className="mt-1 text-xs text-zinc-500">Quick actions for this link.</p>
                        </div>

                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[#d7ff3f]" />
                        ) : (
                          <Shield className="h-4 w-4 text-zinc-600" />
                        )}
                      </div>

                      <div className="mt-4 grid gap-3">
                        <label className="text-sm font-bold text-zinc-300">
                          Visibility
                          <select
                            value={share.visibility}
                            disabled={isUpdating}
                            onChange={(event) =>
                              void patchShare(
                                share.token,
                                {
                                  visibility: event.target.value,
                                },
                                "Visibility updated."
                              )
                            }
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-[#08090d] px-3 py-3 text-sm text-white outline-none disabled:opacity-50"
                          >
                            <option value="PUBLIC">PUBLIC - login required</option>
                            <option value="PRIVATE_EMAILS">PRIVATE_EMAILS</option>
                          </select>
                        </label>

                        <label className="text-sm font-bold text-zinc-300">
                          Permission
                          <select
                            value={share.permission}
                            disabled={isUpdating}
                            onChange={(event) =>
                              void patchShare(
                                share.token,
                                {
                                  permission: event.target.value,
                                },
                                "Permission updated."
                              )
                            }
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-[#08090d] px-3 py-3 text-sm text-white outline-none disabled:opacity-50"
                          >
                            <option value="VIEW_ONLY">VIEW_ONLY</option>
                            <option value="DOWNLOAD">DOWNLOAD</option>
                            <option value="UPLOAD">UPLOAD</option>
                            <option value="FULL">FULL</option>
                          </select>
                        </label>

                        <div className="rounded-2xl border border-white/10 bg-[#08090d] p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">Token</p>
                          <p className="mt-1 break-all text-xs text-zinc-300">{share.token}</p>
                        </div>

                        <button
                          onClick={() => void disableShare(share.token)}
                          disabled={isUpdating || Boolean(share.disabledAt)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 px-3 py-3 text-sm font-black text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                          {share.disabledAt ? "Already Disabled" : "Disable Share"}
                        </button>
                      </div>
                    </aside>
                  </div>
                </article>
              );
            })}

            {filteredShares.length === 0 ? (
              <section className="flex h-72 flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] text-[#d7ff3f]">
                  <Link2 className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-black text-white">No shares found</p>
                  <p className="mt-1 text-sm text-zinc-500">Try another keyword or filter.</p>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Link2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
      <Icon className="h-5 w-5 text-[#d7ff3f]" />
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-zinc-100">{value}</p>
    </div>
  );
}

function Pill({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-300">
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: "ACTIVE" | "EXPIRED" | "DISABLED" }) {
  const className =
    status === "ACTIVE"
      ? "bg-[#d7ff3f]/10 text-[#d7ff3f]"
      : status === "EXPIRED"
        ? "bg-amber-500/10 text-amber-200"
        : "bg-red-500/10 text-red-200";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${className}`}>
      {status.toLowerCase()}
    </span>
  );
}