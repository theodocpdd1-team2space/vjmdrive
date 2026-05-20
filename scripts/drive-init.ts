import fs from "fs/promises";
import path from "path";
import { cleanupAuthTokens } from "../lib/auth-tokens";
import { ensureAdminUser } from "../lib/auth";
import { getAssetRoot } from "../lib/safe-path";
import { getCacheRoot, getPreviewRoot, getThumbnailRoot } from "../lib/preview-cache";
import { ensureSettings } from "../lib/settings";
import { readShareLinks, writeShareLinks } from "../lib/share-db";

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

async function ensureJsonFile(filePath: string, fallback: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const exists = await fs.stat(filePath).then(() => true).catch(() => false);
  if (!exists) await fs.writeFile(filePath, JSON.stringify(fallback, null, 2));
}

async function main() {
  await loadEnvFile(path.join(process.cwd(), ".env"));
  await loadEnvFile(path.join(process.cwd(), ".env.local"));

  const cacheRoot = getCacheRoot();
  const dbRoot = path.join(cacheRoot, "db");

  await Promise.all([
    fs.mkdir(getAssetRoot(), { recursive: true }),
    fs.mkdir(path.join(getAssetRoot(), "__users"), { recursive: true }),
    fs.mkdir(cacheRoot, { recursive: true }),
    fs.mkdir(dbRoot, { recursive: true }),
    fs.mkdir(getPreviewRoot(), { recursive: true }),
    fs.mkdir(getThumbnailRoot(), { recursive: true }),
  ]);

  await Promise.all([
    ensureJsonFile(path.join(dbRoot, "users.json"), []),
    ensureJsonFile(path.join(dbRoot, "auth-tokens.json"), []),
    ensureJsonFile(path.join(dbRoot, "preview-jobs.json"), []),
    ensureJsonFile(path.join(dbRoot, "preview-queue.json"), []),
    ensureJsonFile(path.join(dbRoot, "shares.json"), []),
  ]);

  const admin = await ensureAdminUser();
  await cleanupAuthTokens();
  await ensureSettings();
  await writeShareLinks(await readShareLinks());

  console.log("[drive:init] ready");
  console.log(`[drive:init] asset root: ${getAssetRoot()}`);
  console.log(`[drive:init] cache root: ${cacheRoot}`);
  console.log(`[drive:init] admin email: ${admin.email}`);
}

main().catch((error) => {
  console.error("[drive:init] failed", error);
  process.exitCode = 1;
});
