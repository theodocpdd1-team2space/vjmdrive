import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { getCachePaths, getPreviewRoot, getThumbnailRoot } from "./preview-cache";
import { assertRealPathInsideRoot, resolveSafePath } from "./safe-path";

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

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    const stderr: Buffer[] = [];

    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
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
  const tempPath = `${outputPath}.tmp-${process.pid}-${Date.now()}.jpg`;
  await removeIfExists(tempPath);
  const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(path.extname(inputPath).replace(/^\./, "").toLowerCase());
  const args = isImage
    ? ["-y", "-i", inputPath, "-frames:v", "1", "-q:v", "3", tempPath]
    : ["-y", "-ss", "00:00:05", "-i", inputPath, "-frames:v", "1", "-q:v", "3", tempPath];
  await runFfmpeg(args);
  await fs.rename(tempPath, outputPath);
}

async function generatePreview(inputPath: string, outputPath: string) {
  const tempPath = `${outputPath}.tmp-${process.pid}-${Date.now()}.mp4`;
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

export async function processPreviewForPath(relativePath: string) {
  const safePath = resolveSafePath(relativePath);
  await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);

  const fileStat = await fs.stat(safePath.absolutePath);
  if (fileStat.isDirectory()) throw new Error("Preview target is a folder");

  const cachePaths = getCachePaths(safePath.relativePath, fileStat);
  await Promise.all([
    fs.mkdir(getPreviewRoot(), { recursive: true }),
    fs.mkdir(getThumbnailRoot(), { recursive: true }),
  ]);

  const [previewExists, thumbnailExists] = await Promise.all([
    exists(cachePaths.previewPath),
    exists(cachePaths.thumbnailJpgPath),
  ]);

  if (!thumbnailExists) {
    await generateThumbnail(safePath.absolutePath, cachePaths.thumbnailJpgPath);
  }

  const extension = path.extname(safePath.relativePath).replace(/^\./, "").toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) {
    return {
      previewPath: null,
      thumbnailPath: cachePaths.thumbnailJpgPath,
      skipped: thumbnailExists,
    };
  }

  if (!previewExists) {
    await generatePreview(safePath.absolutePath, cachePaths.previewPath);
  }

  return {
    previewPath: cachePaths.previewPath,
    thumbnailPath: cachePaths.thumbnailJpgPath,
    skipped: previewExists && thumbnailExists,
  };
}
