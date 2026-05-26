import { NextRequest, NextResponse } from "next/server";
import { findUserById, getCurrentUser } from "@/lib/auth";
import { uploadUserFiles } from "@/lib/user-files";
import { enqueuePreview, filterPreviewQueueSupportedPaths } from "@/lib/preview-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const user = await findUserById(session.id);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const formData = await req.formData();
    const targetPath = String(formData.get("path") || "");
    const files = formData.getAll("files").filter((file): file is File => file instanceof File);
    const relativePaths = formData
      .getAll("relativePaths")
      .map((item) => (typeof item === "string" ? item : ""));
    const uploaded = await uploadUserFiles(user, targetPath, files, relativePaths);
    const queuePaths = filterPreviewQueueSupportedPaths(uploaded.map((item) => `__users/${user.id}/${item}`));
    if (queuePaths.length) await enqueuePreview(queuePaths);
    return NextResponse.json({ ok: true, uploaded });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Upload failed" },
      { status: 400 }
    );
  }
}
