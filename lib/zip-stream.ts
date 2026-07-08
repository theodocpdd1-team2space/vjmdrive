// archiver v8 is ESM and exposes archive classes as named exports.
// The published @types package still models the older callable CommonJS API.
// @ts-expect-error - runtime export exists in archiver v8.
import { ZipArchive } from "archiver";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { contentDisposition } from "./file-utils";
import { isIgnoredName } from "./safe-path";

type ZipStreamArchive = InstanceType<typeof ZipArchive>;

async function appendFolder(archive: ZipStreamArchive, absolutePath: string, archiveRoot: string) {
  const entries = await fsp.readdir(absolutePath, { withFileTypes: true });

  for (const entry of entries) {
    if (isIgnoredName(entry.name) || entry.isSymbolicLink()) continue;

    const entryPath = path.join(absolutePath, entry.name);
    const archiveName = path.posix.join(archiveRoot, entry.name);

    if (entry.isDirectory()) {
      await appendFolder(archive, entryPath, archiveName);
    } else if (entry.isFile()) {
      archive.append(fs.createReadStream(entryPath), { name: archiveName });
    }
  }
}

export async function createZipResponse(absolutePath: string, fileName: string) {
  const archive = new ZipArchive({ zlib: { level: 1 } });
  const stat = await fsp.stat(absolutePath);

  if (stat.isDirectory()) {
    await appendFolder(archive, absolutePath, fileName);
  } else {
    archive.append(fs.createReadStream(absolutePath), { name: fileName });
  }

  const stream = Readable.toWeb(archive) as ReadableStream<Uint8Array>;
  const headers = new Headers();
  headers.set("Content-Type", "application/zip");
  headers.set("Content-Disposition", contentDisposition(`${fileName}.zip`, true));
  headers.set("Cache-Control", "private, no-store");

  void archive.finalize();

  return new Response(stream, { headers });
}

export async function createSelectedFilesZipResponse({
  files,
  zipFileName,
  manifestLines = [],
}: {
  files: Array<{ absolutePath: string; archiveName: string }>;
  zipFileName: string;
  manifestLines?: string[];
}) {
  const archive = new ZipArchive({ zlib: { level: 1 } });

  for (const file of files) {
    archive.append(fs.createReadStream(file.absolutePath), { name: file.archiveName });
  }

  if (manifestLines.length) {
    archive.append(`${manifestLines.join("\n")}\n`, { name: "manifest.txt" });
  }

  const stream = Readable.toWeb(archive) as ReadableStream<Uint8Array>;
  const headers = new Headers();
  headers.set("Content-Type", "application/zip");
  headers.set("Content-Disposition", contentDisposition(zipFileName.endsWith(".zip") ? zipFileName : `${zipFileName}.zip`, true));
  headers.set("Cache-Control", "private, no-store");

  void archive.finalize();

  return new Response(stream, { headers });
}
