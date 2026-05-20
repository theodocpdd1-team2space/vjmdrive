import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { readSettings, writeSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const settings = await readSettings();
  return NextResponse.json({
    ok: true,
    settings,
    emailStatus: {
      from: process.env.RESEND_FROM || settings.email.from,
      appUrl: process.env.APP_URL || settings.email.appUrl,
      resendApiKey: process.env.RESEND_API_KEY ? "configured" : "missing",
    },
  });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => null);
  const settings = await readSettings();
  const preview = body?.previewCache || {};
  const nextInterval = Number(preview.intervalHours);
  const intervalHours = ([1, 3, 6, 12, 24] as const).includes(nextInterval as 1 | 3 | 6 | 12 | 24)
    ? (nextInterval as 1 | 3 | 6 | 12 | 24)
    : settings.previewCache.intervalHours;
  settings.previewCache = {
    ...settings.previewCache,
    autoEnabled: Boolean(preview.autoEnabled),
    intervalHours,
    targetPath: typeof preview.targetPath === "string" ? preview.targetPath : settings.previewCache.targetPath,
    maxConcurrentJobs: Math.max(1, Math.min(8, Number(preview.maxConcurrentJobs) || settings.previewCache.maxConcurrentJobs)),
    scanMode: preview.scanMode === "image_video" ? "image_video" : "video",
  };
  settings.previewCache.nextScanAt = settings.previewCache.autoEnabled
    ? new Date(Date.now() + settings.previewCache.intervalHours * 60 * 60 * 1000).toISOString()
    : null;
  await writeSettings(settings);
  return NextResponse.json({ ok: true, settings });
}
