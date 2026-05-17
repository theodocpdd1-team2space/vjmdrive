import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { getCacheRoot } from "./preview-cache";

export type QueueStatus = "queued" | "processing" | "ready" | "failed";

export type PreviewQueueItem = {
  id: string;
  path: string;
  status: QueueStatus;
  message: string;
  createdAt: string;
  updatedAt: string;
};

function queuePath() {
  return path.join(getCacheRoot(), "db", "preview-queue.json");
}

async function ensureQueueDir() {
  await fs.mkdir(path.dirname(queuePath()), { recursive: true });
}

export async function readPreviewQueue(): Promise<PreviewQueueItem[]> {
  await ensureQueueDir();
  const raw = await fs.readFile(queuePath(), "utf8").catch(() => "[]");
  const data = JSON.parse(raw) as PreviewQueueItem[];
  return Array.isArray(data) ? data : [];
}

export async function writePreviewQueue(items: PreviewQueueItem[]) {
  await ensureQueueDir();
  await fs.writeFile(queuePath(), JSON.stringify(items, null, 2));
}

export async function enqueuePreview(paths: string[]) {
  const queue = await readPreviewQueue();
  const now = new Date().toISOString();
  let added = 0;

  for (const filePath of paths) {
    const existing = queue.find(
      (item) =>
        item.path === filePath &&
        (item.status === "queued" || item.status === "processing" || item.status === "ready")
    );

    if (existing) continue;

    queue.unshift({
      id: crypto.randomUUID(),
      path: filePath,
      status: "queued",
      message: "",
      createdAt: now,
      updatedAt: now,
    });
    added += 1;
  }

  await writePreviewQueue(queue);
  return { queue, added };
}

export async function getQueuedStatus(filePath: string) {
  const queue = await readPreviewQueue();
  return queue.find((item) => item.path === filePath) || null;
}
