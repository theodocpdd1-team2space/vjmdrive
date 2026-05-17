import { NextRequest, NextResponse } from "next/server";
import { createSharePreviewResponse } from "@/lib/share-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/share/[token]/preview">) {
  const { token } = await ctx.params;
  const filePath = req.nextUrl.searchParams.get("path") || "";
  const response = await createSharePreviewResponse(token, filePath, req.headers.get("range"));
  return response || NextResponse.json({ ok: false }, { status: 404 });
}
