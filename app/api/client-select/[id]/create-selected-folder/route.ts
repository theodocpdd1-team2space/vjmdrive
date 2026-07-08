import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { copySelectedFilesToFolder } from "@/lib/client-select-actions";
import { getClientSelectLinkForUser, getLatestClientSelectSubmission, updateClientSelectLink } from "@/lib/client-select-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: RouteContext<"/api/client-select/[id]/create-selected-folder">) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });

  const { id } = await ctx.params;
  const link = await getClientSelectLinkForUser(id, session);
  if (!link) return NextResponse.json({ ok: false, message: "Client Select link not found." }, { status: 404 });

  const submission = await getLatestClientSelectSubmission(link.id);
  if (!submission) return NextResponse.json({ ok: false, message: "No submitted files to copy." }, { status: 404 });

  try {
    const result = await copySelectedFilesToFolder(link, submission);
    const nextLink = await updateClientSelectLink(link.id, {
      selectedFolderPath: result.selectedFolderPath,
      selectedFolderCopiedCount: result.copiedCount,
      selectedFolderSkippedCount: result.skippedCount,
      selectedFolderErrors: result.errors,
      selectedFolderCreatedAt: result.createdAt,
    });

    return NextResponse.json({ ok: true, result, link: nextLink });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Create selected folder failed." },
      { status: 400 }
    );
  }
}
