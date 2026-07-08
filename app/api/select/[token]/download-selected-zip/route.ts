import { NextResponse } from "next/server";
import { getLatestClientSelectSubmission, getValidClientSelectLink } from "@/lib/client-select-db";
import { resolveSelectedFilesForRead, selectedZipFileName } from "@/lib/client-select-actions";
import { createSelectedFilesZipResponse } from "@/lib/zip-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/select/[token]/download-selected-zip">) {
  const { token } = await ctx.params;
  const link = await getValidClientSelectLink(token);
  if (!link || link.status === "LOCKED") {
    return NextResponse.json({ ok: false, code: "LINK_UNAVAILABLE", message: "Client Select link is unavailable." }, { status: 404 });
  }
  if (!link.allowOriginalDownload) {
    return NextResponse.json({ ok: false, code: "DOWNLOAD_DISABLED", message: "Download is disabled." }, { status: 403 });
  }

  const submission = await getLatestClientSelectSubmission(link.id);
  if (!submission) return NextResponse.json({ ok: false, message: "No submitted files to download." }, { status: 404 });

  const { files, warnings } = await resolveSelectedFilesForRead(link, submission);
  if (!files.length) return NextResponse.json({ ok: false, message: "Selected files are unavailable.", warnings }, { status: 404 });

  return createSelectedFilesZipResponse({
    files,
    zipFileName: selectedZipFileName(link.projectName),
    manifestLines: warnings.length ? ["Some selected files were skipped:", ...warnings] : [],
  });
}
