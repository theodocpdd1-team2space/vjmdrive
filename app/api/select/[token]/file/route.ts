import { NextRequest, NextResponse } from "next/server";
import { createClientSelectFileResponse } from "@/lib/client-select-file";
import { getValidClientSelectLink } from "@/lib/client-select-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/select/[token]/file">) {
  const { token } = await ctx.params;
  const link = await getValidClientSelectLink(token);

  if (!link || link.status === "LOCKED") {
    return NextResponse.json({ ok: false, code: "LINK_UNAVAILABLE", message: "Client Select link is unavailable." }, { status: 404 });
  }

  const filePath = req.nextUrl.searchParams.get("path") || "";
  const download = req.nextUrl.searchParams.get("download") === "1";
  if (download && !link.allowOriginalDownload) {
    return NextResponse.json({ ok: false, code: "DOWNLOAD_DISABLED", message: "Download is disabled." }, { status: 403 });
  }

  try {
    const response = await createClientSelectFileResponse(token, filePath, req.headers.get("range"), download);
    return response || NextResponse.json({ ok: false, code: "FILE_NOT_FOUND", message: "File not found." }, { status: 404 });
  } catch {
    return NextResponse.json({ ok: false, code: "FILE_NOT_FOUND", message: "File not found." }, { status: 404 });
  }
}
