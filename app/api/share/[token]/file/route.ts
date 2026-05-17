import { NextRequest, NextResponse } from "next/server";
import { createShareFileResponse } from "@/lib/share-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/share/[token]/file">) {
  const { token } = await ctx.params;
  const filePath = req.nextUrl.searchParams.get("path") || "";
  const download = req.nextUrl.searchParams.get("download") === "1";
  const response = await createShareFileResponse(token, filePath, req.headers.get("range"), download);
  return response || NextResponse.json({ ok: false }, { status: 404 });
}
