import fs from "fs/promises";
import path from "path";
import { getAppUrl } from "./auth";
import { getCacheRoot } from "./preview-cache";

export type DriveSettings = {
  appearance: {
    theme: "dark" | "light" | "system";
  };
  language: {
    locale: "en" | "id";
  };
  brand: {
    appName: string;
    label: string;
  };
  storage: {
    downloadBaseUrl: string;
  };
  previewCache: {
    autoEnabled: boolean;
    intervalHours: 1 | 3 | 6 | 12 | 24;
    targetPath: string;
    maxConcurrentJobs: number;
    scanMode: "video" | "image_video";
    lastScanAt: string | null;
    nextScanAt: string | null;
    running: boolean;
  };
  email: {
    appUrl: string;
    from: string;
  };
};

function settingsPath() {
  return path.join(getCacheRoot(), "db", "settings.json");
}

export function defaultSettings(): DriveSettings {
  return {
    appearance: {
      theme: "dark",
    },
    language: {
      locale: "en",
    },
    brand: {
      appName: "driveOne",
      label: "",
    },
    storage: {
      downloadBaseUrl: process.env.DOWNLOAD_BASE_URL || "",
    },
    previewCache: {
      autoEnabled: false,
      intervalHours: 6,
      targetPath: "",
      maxConcurrentJobs: 1,
      scanMode: "video",
      lastScanAt: null,
      nextScanAt: null,
      running: false,
    },
    email: {
      appUrl: getAppUrl(),
      from: process.env.RESEND_FROM || "VJM Drive <no-reply@vjmrtim.my.id>",
    },
  };
}

async function ensureDbDir() {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
}

export async function readSettings(): Promise<DriveSettings> {
  await ensureDbDir();
  const raw = await fs.readFile(settingsPath(), "utf8").catch(() => "");
  if (!raw) return defaultSettings();
  const parsed = JSON.parse(raw) as Partial<DriveSettings>;
  return {
    ...defaultSettings(),
    ...parsed,
    appearance: { ...defaultSettings().appearance, ...parsed.appearance },
    language: { ...defaultSettings().language, ...parsed.language },
    brand: { ...defaultSettings().brand, ...parsed.brand },
    storage: { ...defaultSettings().storage, ...parsed.storage },
    previewCache: { ...defaultSettings().previewCache, ...parsed.previewCache },
    email: { ...defaultSettings().email, ...parsed.email },
  };
}

export async function writeSettings(settings: DriveSettings) {
  await ensureDbDir();
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2));
}

export async function ensureSettings() {
  const settings = await readSettings();
  await writeSettings(settings);
  return settings;
}
