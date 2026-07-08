import { NextRequest, NextResponse } from "next/server";
import { createClientSelectThumbnailResponse } from "@/lib/client-select-file";
import { getValidClientSelectLink } from "@/lib/client-select-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/select/[token]/thumbnail">) {
  const { token } = await ctx.params;
  const link = await getValidClientSelectLink(token);

  if (!link || link.status === "LOCKED") {
    return NextResponse.json({ ok: false, code: "LINK_UNAVAILABLE", message: "Client Select link is unavailable." }, { status: 404 });
  }

  const filePath = req.nextUrl.searchParams.get("path") || "";
  try {
    const response = await createClientSelectThumbnailResponse(token, filePath);
    return response || NextResponse.json({ ok: false, code: "THUMBNAIL_NOT_FOUND", message: "Thumbnail not found." }, { status: 404 });
  } catch {
    return NextResponse.json({ ok: false, code: "THUMBNAIL_NOT_FOUND", message: "Thumbnail not found." }, { status: 404 });
  }
}
