import fs from "fs";

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
  let closed = false;

  function isClosedControllerError(caught: unknown) {
    return caught instanceof TypeError && caught.message.includes("Controller is already closed");
  }

  function reportUnexpectedStreamError(caught: unknown) {
    console.error("[http-file] stream controller error", caught);
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk) => {
        if (closed) return;
        try {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          controller.enqueue(new Uint8Array(bytes));
        } catch (caught) {
          if (!isClosedControllerError(caught)) reportUnexpectedStreamError(caught);
          closed = true;
          stream.destroy();
        }
      });

      stream.on("end", () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch (caught) {
          if (!isClosedControllerError(caught)) reportUnexpectedStreamError(caught);
        }
      });

      stream.on("error", (error) => {
        if (closed) return;
        closed = true;
        try {
          controller.error(error);
        } catch (caught) {
          if (!isClosedControllerError(caught)) reportUnexpectedStreamError(caught);
        }
      });
    },
    cancel() {
      closed = true;
      stream.destroy();
    },
  });
}
