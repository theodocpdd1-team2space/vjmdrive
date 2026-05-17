import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { readPreviewQueue, writePreviewQueue } from "@/lib/preview-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const queue = await readPreviewQueue();
  const item = queue.find((candidate) => candidate.status === "queued");

  if (!item) return NextResponse.json({ ok: true, message: "No queued preview item." });

  item.status = "failed";
  item.message = "Use npm run preview:scan or the worker process to generate previews.";
  item.updatedAt = new Date().toISOString();
  await writePreviewQueue(queue);

  return NextResponse.json({ ok: true, item });
}
