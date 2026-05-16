import fs from "fs";
import { Readable } from "stream";

export type ByteRange = {
  start: number;
  end: number;
};

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

export function nodeStream(filePath: string, range?: ByteRange) {
  const stream = fs.createReadStream(filePath, range);
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}
