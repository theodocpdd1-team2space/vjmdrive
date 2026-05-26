import { NextRequest, NextResponse } from "next/server";
import { createBeautyPreviewResponse } from "@/lib/beauty-share-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/b/[slug]/preview">) {
  const { slug } = await ctx.params;
  const response = await createBeautyPreviewResponse(
    slug,
    req.nextUrl.searchParams.get("path") || "",
    req.headers.get("range")
  );
  return response || NextResponse.json({ ok: false, message: "Preview not found." }, { status: 404 });
}
