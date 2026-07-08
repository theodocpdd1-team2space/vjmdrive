import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { createClientSelectSubmission, getValidClientSelectLink, updateClientSelectSubmission } from "@/lib/client-select-db";
import { sendClientSelectSubmittedEmail } from "@/lib/client-select-email";
import { getDriveItemType } from "@/lib/file-utils";
import { assertRealPathInsideRoot, isDriveSubPath, normalizeDrivePath, resolveSafePath } from "@/lib/safe-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

export async function POST(req: Request, ctx: RouteContext<"/api/select/[token]/submit">) {
  const { token } = await ctx.params;
  const link = await getValidClientSelectLink(token);

  if (!link || link.status === "LOCKED") {
    return NextResponse.json(
      { ok: false, code: "LINK_UNAVAILABLE", message: "Client Select link is unavailable." },
      { status: 404 }
    );
  }

  if (link.status === "SUBMITTED" && !link.allowEditAfterSubmit) {
    return NextResponse.json(
      { ok: false, code: "ALREADY_SUBMITTED", message: "Selection has already been submitted." },
      { status: 409 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { selectedFiles?: unknown; selectedPaths?: unknown; clientName?: unknown; clientEmail?: unknown; globalNote?: unknown };
  const rawSelectedFiles: Array<{ path: string; note: string }> = Array.isArray(body.selectedFiles)
    ? body.selectedFiles
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({
          path: typeof item.path === "string" ? normalizeDrivePath(item.path) : "",
          note: cleanText(item.note, 2000),
        }))
    : [];
  const rawPaths: unknown[] = Array.isArray(body.selectedPaths) ? body.selectedPaths : [];
  const selectedDrafts = rawSelectedFiles.length
    ? rawSelectedFiles
    : rawPaths
        .filter((item): item is string => typeof item === "string")
        .map((item) => ({ path: normalizeDrivePath(item), note: "" }));
  const selectedByPath = new Map<string, { path: string; note: string }>();
  selectedDrafts.filter((item) => item.path).forEach((item) => selectedByPath.set(item.path, item));
  const selectedPaths = Array.from(selectedByPath.keys());
  const clientName = cleanText(body.clientName, 120);
  const clientEmail = cleanText(body.clientEmail, 160).toLowerCase();

  if (!selectedPaths.length) {
    return NextResponse.json({ ok: false, message: "Select at least one photo." }, { status: 400 });
  }
  if (!clientName) return NextResponse.json({ ok: false, message: "Client name is required." }, { status: 400 });
  if (!validEmail(clientEmail)) return NextResponse.json({ ok: false, message: "Valid client email is required." }, { status: 400 });

  if (link.maxSelectedPhotos && selectedPaths.length > link.maxSelectedPhotos) {
    return NextResponse.json(
      { ok: false, message: `You can select up to ${link.maxSelectedPhotos} photo(s).` },
      { status: 400 }
    );
  }

  try {
    const selectedFiles = [];

    for (const selectedPath of selectedPaths) {
      const fullPath = path.posix.join(link.rootPath, selectedPath);
      if (!isDriveSubPath(link.rootPath, fullPath)) throw new Error("Invalid selected path.");

      const safePath = resolveSafePath(fullPath);
      await assertRealPathInsideRoot(safePath.root, safePath.absolutePath);
      const stat = await fs.stat(safePath.absolutePath);
      if (!stat.isFile()) throw new Error("Selected item is not a file.");
      if (getDriveItemType(selectedPath, false) !== "image") throw new Error("Only image files can be selected.");
      selectedFiles.push({
        path: selectedPath,
        filename: path.posix.basename(selectedPath),
        note: selectedByPath.get(selectedPath)?.note || "",
      });
    }

    const submission = await createClientSelectSubmission({
      link,
      selectedFiles,
      clientName,
      clientEmail,
      globalNote: cleanText(body?.globalNote, 4000),
    });
    const emailResult = await sendClientSelectSubmittedEmail({ link, submission });
    const nextSubmission = await updateClientSelectSubmission(submission.id, {
      emailSentAt: emailResult.ok ? new Date().toISOString() : null,
      emailError: emailResult.ok ? null : emailResult.error || "Email notification failed.",
    });

    return NextResponse.json({ ok: true, submission: nextSubmission || submission });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Submit selection failed." },
      { status: 400 }
    );
  }
}
