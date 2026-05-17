import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import {
  getCachePaths,
  getCacheRoot,
  getPreviewRoot,
  getThumbnailRoot,
} from "../lib/preview-cache";
import { getAssetRoot, isIgnoredName } from "../lib/safe-path";

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "avi", "mkv"]);
const DEFAULT_CONCURRENCY = 1;

type VideoJob = {
  absolutePath: string;
  relativePath: string;
  size: number;
  mtimeMs: number;
};

type FailedJob = {
  cacheId: string;
  path: string;
  reason: string;
  failedAt: string;
};

type ScanStats = {
  totalScanned: number;
  skippedExisting: number;
  success: number;
  failed: number;
};

function loadEnvFile(filePath: string) {
  return fs
    .readFile(filePath, "utf8")
    .then((content) => {
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) continue;

        const key = line.slice(0, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    })
    .catch(() => undefined);
}

function toPosixPath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function isVideoFile(fileName: string) {
  const extension = path.extname(fileName).replace(/^\./, "").toLowerCase();
  return VIDEO_EXTENSIONS.has(extension);
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function removeIfExists(filePath: string) {
  await fs.unlink(filePath).catch(() => undefined);
}

async function* walkVideos(root: string, current: string): AsyncGenerator<VideoJob> {
  const entries = await fs.readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    if (isIgnoredName(entry.name) || entry.isSymbolicLink()) {
      continue;
    }

    const absolutePath = path.join(current, entry.name);

    if (entry.isDirectory()) {
      yield* walkVideos(root, absolutePath);
      continue;
    }

    if (!entry.isFile() || !isVideoFile(entry.name)) {
      continue;
    }

    const stat = await fs.stat(absolutePath);
    const relativePath = toPosixPath(path.relative(root, absolutePath));

    yield {
      absolutePath,
      relativePath,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    };
  }
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    const stderr: Buffer[] = [];

    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const message = Buffer.concat(stderr).toString("utf8").trim();
      reject(new Error(message || `ffmpeg exited with code ${code}`));
    });
  });
}

async function generateThumbnail(inputPath: string, outputPath: string) {
  const tempPath = `${outputPath}.tmp-${process.pid}.jpg`;
  await removeIfExists(tempPath);
  await runFfmpeg([
    "-y",
    "-ss",
    "00:00:05",
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    tempPath,
  ]);
  await fs.rename(tempPath, outputPath);
}

async function generatePreview(inputPath: string, outputPath: string) {
  const tempPath = `${outputPath}.tmp-${process.pid}.mp4`;
  await removeIfExists(tempPath);
  await runFfmpeg([
    "-y",
    "-ss",
    "00:00:05",
    "-i",
    inputPath,
    "-t",
    "15",
    "-vf",
    "scale=1280:-2",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "30",
    "-pix_fmt",
    "yuv420p",
    "-an",
    tempPath,
  ]);
  await fs.rename(tempPath, outputPath);
}

async function processJob(job: VideoJob, stats: ScanStats, failures: FailedJob[]) {
  stats.totalScanned += 1;
  console.log(`[scan] ${stats.totalScanned}: ${job.relativePath}`);

  const cachePaths = getCachePaths(job.relativePath, job);
  const [previewExists, thumbnailExists] = await Promise.all([
    exists(cachePaths.previewPath),
    exists(cachePaths.thumbnailJpgPath),
  ]);

  if (previewExists && thumbnailExists) {
    stats.skippedExisting += 1;
    console.log(`[skip] existing preview + thumbnail: ${job.relativePath}`);
    return;
  }

  try {
    if (!thumbnailExists) {
      console.log(`[thumbnail] ${job.relativePath}`);
      await generateThumbnail(job.absolutePath, cachePaths.thumbnailJpgPath);
    }

    if (!previewExists) {
      console.log(`[preview] ${job.relativePath}`);
      await generatePreview(job.absolutePath, cachePaths.previewPath);
    }

    stats.success += 1;
    console.log(`[ok] ${job.relativePath}`);
  } catch (caught) {
    stats.failed += 1;
    await Promise.all([
      removeIfExists(`${cachePaths.thumbnailJpgPath}.tmp-${process.pid}.jpg`),
      removeIfExists(`${cachePaths.previewPath}.tmp-${process.pid}.mp4`),
    ]);

    const reason = caught instanceof Error ? caught.message : "Unknown ffmpeg error";
    failures.push({
      cacheId: cachePaths.id,
      path: job.relativePath,
      reason,
      failedAt: new Date().toISOString(),
    });
    console.error(`[failed] ${job.relativePath}`);
    console.error(reason.split("\n").slice(-6).join("\n"));
  }
}

async function runWithConcurrency(
  jobs: VideoJob[],
  concurrency: number,
  stats: ScanStats,
  failures: FailedJob[]
) {
  let nextIndex = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (nextIndex < jobs.length) {
      const job = jobs[nextIndex];
      nextIndex += 1;
      await processJob(job, stats, failures);
    }
  });

  await Promise.all(workers);
}

async function main() {
  await loadEnvFile(path.join(process.cwd(), ".env.local"));

  const assetRoot = getAssetRoot();
  const cacheRoot = getCacheRoot();
  const previewRoot = getPreviewRoot();
  const thumbnailRoot = getThumbnailRoot();
  const logsRoot = path.join(cacheRoot, "logs");
  const failedLogPath = path.join(logsRoot, "preview-failed.json");
  const concurrency = Math.max(
    1,
    Number.parseInt(process.env.PREVIEW_SCAN_CONCURRENCY || String(DEFAULT_CONCURRENCY), 10) ||
      DEFAULT_CONCURRENCY
  );

  await Promise.all([
    fs.mkdir(cacheRoot, { recursive: true }),
    fs.mkdir(previewRoot, { recursive: true }),
    fs.mkdir(thumbnailRoot, { recursive: true }),
    fs.mkdir(logsRoot, { recursive: true }),
  ]);

  console.log(`ASSET_ROOT: ${assetRoot}`);
  console.log(`PREVIEW_ROOT: ${previewRoot}`);
  console.log(`THUMBNAIL_ROOT: ${thumbnailRoot}`);
  console.log(`Concurrency: ${concurrency}`);

  const stats: ScanStats = {
    totalScanned: 0,
    skippedExisting: 0,
    success: 0,
    failed: 0,
  };
  const failures: FailedJob[] = [];
  const jobs: VideoJob[] = [];

  for await (const job of walkVideos(assetRoot, assetRoot)) {
    jobs.push(job);
  }

  await runWithConcurrency(jobs, concurrency, stats, failures);
  await fs.writeFile(failedLogPath, JSON.stringify(failures, null, 2));

  console.log("");
  console.log("Preview scan summary");
  console.log(`total scanned: ${stats.totalScanned}`);
  console.log(`skipped existing: ${stats.skippedExisting}`);
  console.log(`success: ${stats.success}`);
  console.log(`failed: ${stats.failed}`);
  console.log(`failed log: ${failedLogPath}`);
}

main().catch((caught) => {
  console.error(caught instanceof Error ? caught.message : caught);
  process.exitCode = 1;
});
