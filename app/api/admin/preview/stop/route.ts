import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { readSettings, writeSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const settings = await readSettings();
  settings.previewCache.running = false;
  await writeSettings(settings);
  return NextResponse.json({ ok: true, message: "Stop requested. Running ffmpeg process may finish its current file." });
}
