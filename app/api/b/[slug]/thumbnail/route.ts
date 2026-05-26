import { NextRequest, NextResponse } from "next/server";
import { createBeautyThumbnailResponse } from "@/lib/beauty-share-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/b/[slug]/thumbnail">) {
  const { slug } = await ctx.params;
  const response = await createBeautyThumbnailResponse(slug, req.nextUrl.searchParams.get("path") || "");
  return response || NextResponse.json({ ok: false, message: "Thumbnail not found." }, { status: 404 });
}
