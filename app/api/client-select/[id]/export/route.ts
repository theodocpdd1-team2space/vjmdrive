import { NextRequest, NextResponse } from "next/server";
import { contentDisposition } from "@/lib/file-utils";
import { getCurrentUser } from "@/lib/auth";
import { getClientSelectLinkForUser, getLatestClientSelectSubmission } from "@/lib/client-select-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function safeExportName(value: string, extension: "txt" | "csv") {
  const safe = value
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "client-select";
  return `${safe}-selected.${extension}`;
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/client-select/[id]/export">) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });

  const { id } = await ctx.params;
  const link = await getClientSelectLinkForUser(id, session);
  if (!link) return NextResponse.json({ ok: false, message: "Client Select link not found." }, { status: 404 });

  const submission = await getLatestClientSelectSubmission(link.id);
  if (!submission) return NextResponse.json({ ok: false, message: "No submission to export." }, { status: 404 });

  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "txt";
  const body = format === "csv"
    ? [
        "filename,path,note",
        ...submission.selectedFiles.map((file, index) =>
          [
            csvEscape(file.filename || submission.selectedFilenames[index] || file.path.split("/").pop() || file.path),
            csvEscape(file.path),
            csvEscape(file.note || ""),
          ].join(",")
        ),
      ].join("\n") + "\n"
    : `${submission.selectedFilenames.join("\n")}\n`;

  const headers = new Headers();
  headers.set("Content-Type", format === "csv" ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8");
  headers.set("Content-Disposition", contentDisposition(safeExportName(link.projectName, format), true));
  headers.set("Cache-Control", "private, no-store");

  return new Response(body, { headers });
}
