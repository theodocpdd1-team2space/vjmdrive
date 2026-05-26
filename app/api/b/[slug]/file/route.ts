import { NextRequest, NextResponse } from "next/server";
import { createBeautyFileResponse } from "@/lib/beauty-share-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/b/[slug]/file">) {
  const { slug } = await ctx.params;
  const response = await createBeautyFileResponse(
    slug,
    req.nextUrl.searchParams.get("path") || "",
    req.headers.get("range"),
    req.nextUrl.searchParams.get("download") === "1"
  );

  return response || NextResponse.json({ ok: false, message: "File not found." }, { status: 404 });
}
