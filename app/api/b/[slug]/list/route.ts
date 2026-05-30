import { NextRequest, NextResponse } from "next/server";
import { getBeautyShareBySlug } from "@/lib/beauty-share-db";
import { listDriveFolder } from "@/lib/drive-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/b/[slug]/list">) {
  const { slug } = await ctx.params;
  const share = await getBeautyShareBySlug(slug).catch(() => null);

  if (!share || !share.isActive) {
    return NextResponse.json({ ok: false, message: "Beauty Share not found." }, { status: 404 });
  }

  try {
    const data = await listDriveFolder({
      path: req.nextUrl.searchParams.get("path") || "",
      scopeRootPath: share.rootPath,
      urlPrefix: `/api/b/${share.slug}`,
      canDownload: true,
    });

    return NextResponse.json({
      ok: true,
      share: {
        slug: share.slug,
        title: share.title,
        subtitle: share.subtitle || "",
        clientName: share.clientName || "",
        theme: share.theme,
        layout: share.layout,
        customText: share.customText,
      },
      ...data,
    });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Folder not found." },
      { status: 404 }
    );
  }
}
