import fs from "fs/promises";
import path from "path";
import { formatBytes } from "./file-utils";
import { isIgnoredName } from "./safe-path";

export async function directorySize(root: string): Promise<number> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  let total = 0;

  for (const entry of entries) {
    if (isIgnoredName(entry.name) || entry.isSymbolicLink()) continue;
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) total += await directorySize(absolutePath);
    else if (entry.isFile()) total += (await fs.stat(absolutePath)).size;
  }

  return total;
}

export function storageSummary(usedBytes: number, quotaBytes: number | null) {
  return {
    usedBytes,
    quotaBytes,
    used: formatBytes(usedBytes),
    quota: quotaBytes === null ? "Unlimited" : formatBytes(quotaBytes),
    percent: quotaBytes ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0,
  };
}
