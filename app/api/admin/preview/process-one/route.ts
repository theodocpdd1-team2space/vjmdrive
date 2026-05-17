import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { readPreviewQueue, writePreviewQueue } from "@/lib/preview-queue";
import { processPreviewForPath } from "@/lib/preview-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const queue = await readPreviewQueue();
  const item = queue.find((candidate) => candidate.status === "queued");

  if (!item) return NextResponse.json({ ok: true, message: "No queued preview item." });

  item.status = "processing";
  item.message = "Processing with ffmpeg.";
  item.updatedAt = new Date().toISOString();
  await writePreviewQueue(queue);

  try {
    const result = await processPreviewForPath(item.path);
    item.status = "ready";
    item.message = result.skipped ? "Preview cache already exists." : "Preview cache generated.";
    item.updatedAt = new Date().toISOString();
    await writePreviewQueue(queue);
    return NextResponse.json({ ok: true, item });
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : "Preview generation failed.";
    item.status = "failed";
    item.message = reason.split("\n").slice(-6).join("\n");
    item.updatedAt = new Date().toISOString();
    await writePreviewQueue(queue);
    return NextResponse.json({ ok: false, item, message: item.message }, { status: 500 });
  }
}
