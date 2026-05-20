import { spawn } from "child_process";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { readSettings, writeSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const settings = await readSettings();
  if (settings.previewCache.running) {
    return NextResponse.json({ ok: false, message: "A scan is already running." }, { status: 409 });
  }

  settings.previewCache.running = true;
  settings.previewCache.lastScanAt = new Date().toISOString();
  await writeSettings(settings);

  const child = spawn("npm", ["run", "preview:scan"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();

  return NextResponse.json({ ok: true, pid: child.pid });
}
