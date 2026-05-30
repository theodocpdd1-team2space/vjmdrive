import fs from "fs/promises";
import { NextResponse } from "next/server";
import { findUserById, getCurrentUser } from "@/lib/auth";
import {
  createBeautyShare,
  getBeautySharesByOwner,
  suggestBeautySlug,
  validateBeautySlug,
  type BeautyShareLayout,
  type BeautyShareTheme,
} from "@/lib/beauty-share-db";
import { resolveExisting } from "@/lib/file-ops";
import { resolveUserDrivePath } from "@/lib/user-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });

  const shares = await getBeautySharesByOwner(session.id);
  return NextResponse.json({
    ok: true,
    shares: shares.map((share) => ({
      ...share,
      publicUrl: `/b/${share.slug}`,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  if (session.role !== "USER") return NextResponse.json({ ok: false, message: "Beauty Share is for user drives." }, { status: 403 });

  const user = await findUserById(session.id);
  if (!user || user.disabled) {
    return NextResponse.json({ ok: false, message: "Account unavailable." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const rootPath = typeof body?.rootPath === "string" ? body.rootPath : "";
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "Client Delivery";
  const clientName = typeof body?.clientName === "string" ? body.clientName.trim() : title;
  const subtitle = typeof body?.subtitle === "string" ? body.subtitle.trim() : "";

  try {
    const theme: BeautyShareTheme =
      body?.theme === "dark" || body?.theme === "cream" ? body.theme : "light";
    const layout: BeautyShareLayout =
      body?.layout === "collage" || body?.layout === "grid" || body?.layout === "magazine" || body?.layout === "clean"
        ? body.layout
        : "clean";
    const slug = validateBeautySlug(
      typeof body?.slug === "string" && body.slug.trim() ? body.slug : suggestBeautySlug(title)
    );
    const fullRootPath = resolveUserDrivePath(user.id, rootPath);
    const resolved = await resolveExisting(fullRootPath);
    const stat = await fs.stat(resolved.absolutePath);
    if (!stat.isDirectory()) throw new Error("Beauty Share is available for folders.");

    const share = await createBeautyShare({
      ownerUserId: user.id,
      rootPath: fullRootPath,
      slug,
      title,
      subtitle,
      clientName,
      theme,
      layout,
    });

    return NextResponse.json({ ok: true, share, publicUrl: `/b/${share.slug}` });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Create Beauty Share failed." },
      { status: 400 }
    );
  }
}
