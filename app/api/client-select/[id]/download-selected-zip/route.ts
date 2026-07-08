import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getClientSelectLinkForUser, getLatestClientSelectSubmission } from "@/lib/client-select-db";
import { resolveSelectedFilesForRead, selectedZipFileName } from "@/lib/client-select-actions";
import { createSelectedFilesZipResponse } from "@/lib/zip-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/client-select/[id]/download-selected-zip">) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });

  const { id } = await ctx.params;
  const link = await getClientSelectLinkForUser(id, session);
  if (!link) return NextResponse.json({ ok: false, message: "Client Select link not found." }, { status: 404 });

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
