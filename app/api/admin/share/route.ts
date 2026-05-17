import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createShareLink } from "@/lib/share-db";
import { resolveExisting } from "@/lib/file-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rootPath = typeof body?.rootPath === "string" ? body.rootPath : "";
  const name = typeof body?.name === "string" ? body.name : "Shared Link";
  const canDownload = body?.canDownload !== false;
  const expiresAt = typeof body?.expiresAt === "string" && body.expiresAt ? body.expiresAt : null;

  try {
    await resolveExisting(rootPath);
    const link = await createShareLink({ rootPath, name, canDownload, expiresAt });
    return NextResponse.json({ ok: true, token: link.token, url: `/share/${link.token}`, link });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Create share failed" },
      { status: 400 }
    );
  }
}
