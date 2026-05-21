import { redirect } from "next/navigation";
import { RotateCw } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { readPreviewQueue } from "@/lib/preview-queue";
import { AdminShell } from "@/components/layout/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminPreviewQueuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/preview-queue");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const queue = await readPreviewQueue().catch(() => []);
  const counts = {
    queued: queue.filter((item) => item.status === "queued").length,
    processing: queue.filter((item) => item.status === "processing").length,
    ready: queue.filter((item) => item.status === "ready").length,
    failed: queue.filter((item) => item.status === "failed").length,
  };

  return (
    <AdminShell title="Preview Queue" subtitle="Preview cache queue and processing status.">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          {Object.entries(counts).map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
          <div className="border-b border-white/10 p-4">
            <h2 className="font-black text-white">Queue items</h2>
            <p className="mt-1 text-sm text-zinc-500">This page is intentionally read-only; scan/process actions remain in the existing preview APIs.</p>
          </div>
          {queue.length ? (
            <div className="divide-y divide-white/10">
              {queue.map((item) => (
                <article key={item.id} className="grid gap-2 p-4 md:grid-cols-[minmax(0,1fr)_120px_180px] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm text-zinc-100">{item.path}</p>
                    {item.message ? <p className="mt-1 text-xs text-zinc-500">{item.message}</p> : null}
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-center text-xs font-black uppercase tracking-[0.12em] text-zinc-300">
                    {item.status}
                  </span>
                  <p className="text-xs text-zinc-500">{new Date(item.updatedAt || item.createdAt).toLocaleString("id-ID")}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center text-zinc-500">
              <RotateCw className="h-10 w-10" />
              <p className="font-semibold text-zinc-300">Preview queue is empty</p>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
