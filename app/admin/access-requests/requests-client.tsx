"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, Search, ShieldAlert, X } from "lucide-react";
import type { ShareAccessRequest, ShareAccessRequestStatus } from "@/lib/share-access-requests";

type Filter = "ALL" | ShareAccessRequestStatus;

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID");
}

export function AccessRequestsClient({ initialRequests }: { initialRequests: ShareAccessRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function refresh() {
    const res = await fetch("/api/admin/access-requests", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) setRequests(data.requests || []);
  }

  async function updateRequest(id: string, status: ShareAccessRequestStatus) {
    setUpdatingId(id);
    setNotice("");
    const res = await fetch("/api/admin/access-requests", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, status }),
    });
    const data = await res.json().catch(() => ({}));
    setUpdatingId(null);

    if (!res.ok || !data.ok) {
      setNotice(data.message || "Update failed.");
      return;
    }

    setNotice(status === "APPROVED" ? "Access approved." : "Access rejected.");
    await refresh();
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return requests
      .filter((request) => (filter === "ALL" ? true : request.status === filter))
      .filter((request) => {
        if (!needle) return true;
        return [request.requesterEmail, request.shareTitle, request.token, request.message]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      });
  }, [filter, query, requests]);

  const counts = {
    all: requests.length,
    pending: requests.filter((request) => request.status === "PENDING").length,
    approved: requests.filter((request) => request.status === "APPROVED").length,
    rejected: requests.filter((request) => request.status === "REJECTED").length,
  };

  return (
    <main className="min-h-screen bg-[#08090d] p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Admin
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d7ff3f] text-black">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d7ff3f]">driveOne by VJMRTIM</p>
                <h1 className="text-2xl font-black text-white">Access Requests</h1>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs md:min-w-[420px]">
            {[
              ["All", counts.all],
              ["Pending", counts.pending],
              ["Approved", counts.approved],
              ["Rejected", counts.rejected],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-lg font-black text-white">{value}</p>
                <p className="text-zinc-500">{label}</p>
              </div>
            ))}
          </div>
        </header>

        {notice ? <div className="rounded-2xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 px-4 py-3 text-sm font-semibold text-[#d7ff3f]">{notice}</div> : null}

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 md:w-96">
              <Search className="h-4 w-4 text-zinc-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requester, share, token..." className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600" />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["ALL", "PENDING", "APPROVED", "REJECTED"] as Filter[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`rounded-xl px-3 py-2 text-xs font-black ${filter === item ? "bg-[#d7ff3f] text-black" : "border border-white/10 text-zinc-300 hover:bg-white/10"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">No access requests in this view.</div>
            ) : (
              filtered.map((request) => (
                <article key={request.id} className="border-b border-white/10 p-4 last:border-b-0">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-black text-white">{request.requesterEmail}</h2>
                        <span className={`rounded-lg border px-2 py-1 text-[11px] font-black ${request.status === "PENDING" ? "border-amber-300/20 bg-amber-300/10 text-amber-200" : request.status === "APPROVED" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-red-300/20 bg-red-300/10 text-red-200"}`}>
                          {request.status}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-zinc-400">{request.shareTitle}</p>
                      <p className="mt-1 font-mono text-xs text-zinc-600">{request.token}</p>
                      {request.message ? <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">{request.message}</p> : null}
                      <p className="mt-3 text-xs text-zinc-600">Requested {formatDate(request.createdAt)}</p>
                    </div>
                    {request.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <button onClick={() => void updateRequest(request.id, "APPROVED")} disabled={updatingId === request.id} className="inline-flex items-center gap-2 rounded-xl bg-[#d7ff3f] px-3 py-2 text-sm font-black text-black disabled:opacity-60">
                          {updatingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Approve
                        </button>
                        <button onClick={() => void updateRequest(request.id, "REJECTED")} disabled={updatingId === request.id} className="inline-flex items-center gap-2 rounded-xl border border-red-300/20 px-3 py-2 text-sm font-bold text-red-200 hover:bg-red-300/10 disabled:opacity-60">
                          <X className="h-4 w-4" />
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
