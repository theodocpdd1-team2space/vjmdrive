// archiver v8 is ESM and exposes archive classes as named exports.
// The published @types package still models the older callable CommonJS API.
// @ts-expect-error - runtime export exists in archiver v8.
import { ZipArchive } from "archiver";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { contentDisposition } from "./file-utils";
import { isExpectedStreamShutdown, logStreamTermination, type StreamLogContext } from "./http-file";
import { isIgnoredName } from "./safe-path";

type ZipStreamArchive = InstanceType<typeof ZipArchive>;
type ZipSourceStream = ReturnType<typeof fs.createReadStream>;

function destroyArchive(archive: ZipStreamArchive) {
  archive.abort();
  archive.destroy();
}

function appendFile(
  archive: ZipStreamArchive,
  sourceStreams: Set<ZipSourceStream>,
  absolutePath: string,
  archiveName: string,
  context: StreamLogContext,
  isTerminated: () => boolean
) {
  if (isTerminated()) return;

  const source = fs.createReadStream(absolutePath);
  sourceStreams.add(source);
  source.once("close", () => sourceStreams.delete(source));
  source.once("error", (error) => {
    if (isTerminated() || isExpectedStreamShutdown(error)) return;
    logStreamTermination({ ...context, identifier: archiveName }, "source stream error", error);
  });
  archive.append(source, { name: archiveName });
}

async function appendFolder(
  archive: ZipStreamArchive,
  absolutePath: string,
  archiveRoot: string,
  sourceStreams: Set<ZipSourceStream>,
  context: StreamLogContext,
  isTerminated: () => boolean
) {
  if (isTerminated()) return;

  const entries = await fsp.readdir(absolutePath, { withFileTypes: true });

  for (const entry of entries) {
    if (isTerminated()) return;
    if (isIgnoredName(entry.name) || entry.isSymbolicLink()) continue;

    const entryPath = path.join(absolutePath, entry.name);
    const archiveName = path.posix.join(archiveRoot, entry.name);

    if (entry.isDirectory()) {
      await appendFolder(archive, entryPath, archiveName, sourceStreams, context, isTerminated);
    } else if (entry.isFile()) {
      appendFile(archive, sourceStreams, entryPath, archiveName, context, isTerminated);
    }
  }
}

function createManagedZipResponse(
  archive: ZipStreamArchive,
  headers: Headers,
  context: StreamLogContext,
  sourceStreams: Set<ZipSourceStream>,
  writeArchive: (isTerminated: () => boolean) => Promise<void>
) {
  const signal = context.signal;
  let terminated = false;

  function cleanup() {
    signal?.removeEventListener("abort", abort);
  }

  function terminate(event: "request aborted" | "source stream error", caught?: unknown) {
    if (terminated) return;
    terminated = true;
    cleanup();

    if (event === "request aborted" || !caught || !isExpectedStreamShutdown(caught)) {
      logStreamTermination(context, event, caught);
    }

    for (const source of sourceStreams) {
      source.destroy();
    }

    destroyArchive(archive);
  }

  function abort() {
    terminate("request aborted");
  }

  archive.once("warning", (warning: unknown) => {
    if (terminated || isExpectedStreamShutdown(warning)) return;
    logStreamTermination(context, "zip warning", warning);
  });

  archive.once("error", (error: unknown) => {
    if (terminated || isExpectedStreamShutdown(error)) return;
    logStreamTermination(context, "source stream error", error);
  });

  archive.once("close", cleanup);
  archive.once("end", cleanup);
  archive.once("finish", cleanup);

  if (signal?.aborted) {
    abort();
  } else {
    signal?.addEventListener("abort", abort, { once: true });
  }

  const isTerminated = () => terminated || Boolean(signal?.aborted);

  void writeArchive(isTerminated)
    .then(() => {
      if (!terminated) void archive.finalize();
    })
    .catch((error) => {
      terminate("source stream error", error);
    });

  const stream = Readable.toWeb(archive) as ReadableStream<Uint8Array>;
  return new Response(stream, { headers });
}

export async function createZipResponse(absolutePath: string, fileName: string, context?: StreamLogContext) {
  const archive = new ZipArchive({ zlib: { level: 1 } });
  const stat = await fsp.stat(absolutePath);
  const sourceStreams = new Set<ZipSourceStream>();
  const streamContext = {
    route: context?.route || "/api/zip",
    identifier: context?.identifier || fileName,
    signal: context?.signal,
  };

  const headers = new Headers();
  headers.set("Content-Type", "application/zip");
  headers.set("Content-Disposition", contentDisposition(`${fileName}.zip`, true));
  headers.set("Cache-Control", "private, no-store");

  return createManagedZipResponse(archive, headers, streamContext, sourceStreams, async (isTerminated) => {
    if (stat.isDirectory()) {
      await appendFolder(
        archive,
        absolutePath,
        fileName,
        sourceStreams,
        streamContext,
        isTerminated
      );
    } else {
      appendFile(archive, sourceStreams, absolutePath, fileName, streamContext, isTerminated);
    }
  });
}

export async function createSelectedFilesZipResponse({
  files,
  zipFileName,
  manifestLines = [],
}: {
  files: Array<{ absolutePath: string; archiveName: string }>;
  zipFileName: string;
  manifestLines?: string[];
}, context?: StreamLogContext) {
  const archive = new ZipArchive({ zlib: { level: 1 } });
  const sourceStreams = new Set<ZipSourceStream>();
  const streamContext = {
    route: context?.route || "/api/select/[token]/download-selected-zip",
    identifier: context?.identifier || zipFileName,
    signal: context?.signal,
  };

  const headers = new Headers();
  headers.set("Content-Type", "application/zip");
  headers.set("Content-Disposition", contentDisposition(zipFileName.endsWith(".zip") ? zipFileName : `${zipFileName}.zip`, true));
  headers.set("Cache-Control", "private, no-store");

  return createManagedZipResponse(archive, headers, streamContext, sourceStreams, async (isTerminated) => {
    for (const file of files) {
      if (isTerminated()) return;
      appendFile(archive, sourceStreams, file.absolutePath, file.archiveName, streamContext, isTerminated);
    }

    if (manifestLines.length && !isTerminated()) {
      archive.append(`${manifestLines.join("\n")}\n`, { name: "manifest.txt" });
    }
  });
}
