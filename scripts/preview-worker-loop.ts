import fs from "fs/promises";
import path from "path";
import { readPreviewQueue, writePreviewQueue } from "../lib/preview-queue";
import { processPreviewForPath } from "../lib/preview-worker";

const intervalMs = Number(process.env.PREVIEW_WORKER_INTERVAL_MS || 5000);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadEnvFile(filePath: string) {
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function processOneQueuedItem() {
  const queue = await readPreviewQueue();
  const item = queue.find((candidate) => candidate.status === "queued");

  if (!item) {
    console.log("[preview-worker] no queued item");
    return false;
  }

  item.status = "processing";
  item.message = "Processing with ffmpeg.";
  item.updatedAt = new Date().toISOString();
  await writePreviewQueue(queue);

  try {
    console.log(`[preview-worker] processing ${item.path}`);
    const result = await processPreviewForPath(item.path);
    item.status = "ready";
    item.message = result.skipped ? "Preview cache already exists." : "Preview cache generated.";
    item.updatedAt = new Date().toISOString();
    await writePreviewQueue(queue);
    console.log(`[preview-worker] ready ${item.path}`);
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : "Preview generation failed.";
    item.status = "failed";
    item.message = reason.split("\n").slice(-6).join("\n");
    item.updatedAt = new Date().toISOString();
    await writePreviewQueue(queue);
    console.error(`[preview-worker] failed ${item.path}: ${item.message}`);
  }

  return true;
}

async function main() {
  await loadEnvFile(path.join(process.cwd(), ".env.local"));
  await loadEnvFile(path.join(process.cwd(), ".env"));

  console.log(`[preview-worker] started interval=${intervalMs}ms`);

  for (;;) {
    try {
      const processed = await processOneQueuedItem();
      if (!processed) await sleep(intervalMs);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Worker loop error.";
      console.error(`[preview-worker] loop error: ${message}`);
      await sleep(intervalMs);
    }
  }
}

void main();
