import fs from "fs";
import { Readable } from "stream";

export type ByteRange = {
  start: number;
  end: number;
};

export type StreamLogContext = {
  route: string;
  identifier?: string;
  signal?: AbortSignal;
};

function safeIdentifier(identifier: string | undefined) {
  const clean = (identifier || "unknown")
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .slice(-4)
    .join("/");

  return (clean || "root").replace(/[^\w .@()+\-[\]/]/g, "_").slice(0, 180);
}

function errorSummary(caught: unknown) {
  const error = caught as { code?: unknown; name?: unknown; message?: unknown };
  return {
    code: typeof error.code === "string" ? error.code : undefined,
    name: typeof error.name === "string" ? error.name : undefined,
    message: typeof error.message === "string" ? error.message : String(caught),
  };
}

export function isExpectedStreamShutdown(caught: unknown) {
  const summary = errorSummary(caught);
  return (
    summary.code === "ABORT_ERR" ||
    summary.code === "ERR_STREAM_PREMATURE_CLOSE" ||
    summary.code === "ERR_INVALID_STATE" ||
    summary.name === "AbortError" ||
    summary.message.includes("Controller is already closed") ||
    summary.message.includes("The operation was aborted")
  );
}

export function logStreamTermination(
  context: StreamLogContext,
  event: "request aborted" | "source stream error" | "zip warning",
  caught?: unknown
) {
  const details = {
    route: context.route,
    path: safeIdentifier(context.identifier),
    ...(caught ? errorSummary(caught) : {}),
  };

  if (event === "source stream error" && caught && !isExpectedStreamShutdown(caught)) {
    console.error(`[stream] ${event}`, details);
    return;
  }

  console.warn(`[stream] ${event}`, details);
}

export function parseRange(range: string | null, size: number): ByteRange | null {
  if (!range) return null;

  const match = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  const [, rawStart, rawEnd] = match;

  if (!rawStart && !rawEnd) return null;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;

    return {
      start: Math.max(size - suffixLength, 0),
      end: size - 1,
    };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
    return null;
  }

  return {
    start,
    end: Math.min(end, size - 1),
  };
}

export function nodeStream(filePath: string, range?: ByteRange, context?: StreamLogContext) {
  const stream = fs.createReadStream(filePath, range);
  const signal = context?.signal;
  let closed = false;
  let aborted = false;

  function cleanup() {
    signal?.removeEventListener("abort", abort);
  }

  function abort() {
    if (closed) return;
    aborted = true;
    closed = true;
    if (context) logStreamTermination(context, "request aborted");
    cleanup();
    stream.destroy();
  }

  stream.once("error", (error) => {
    if (aborted || isExpectedStreamShutdown(error)) return;
    if (context) logStreamTermination(context, "source stream error", error);
  });

  stream.once("close", () => {
    closed = true;
    cleanup();
  });

  if (signal?.aborted) {
    abort();
  } else {
    signal?.addEventListener("abort", abort, { once: true });
  }

  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}
