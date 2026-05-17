import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { listDriveFolder } from "@/lib/drive-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const path = req.nextUrl.searchParams.get("path") || "";
    const data = await listDriveFolder({ path });
    return NextResponse.json({ ok: true, ...data });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Folder tidak ditemukan";
    return NextResponse.json({ ok: false, message }, { status: 404 });
  }
}
