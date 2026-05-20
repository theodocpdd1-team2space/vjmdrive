import { NextRequest, NextResponse } from "next/server";
import { findUserById, getCurrentUser } from "@/lib/auth";
import { uploadUserFiles } from "@/lib/user-files";
import { enqueuePreview } from "@/lib/preview-queue";

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
    const uploaded = await uploadUserFiles(user, targetPath, files);
    const videoPaths = uploaded.filter((item) => /\.(mp4|mov|m4v|webm|avi|mkv|dxv)$/i.test(item));
    if (videoPaths.length) await enqueuePreview(videoPaths.map((item) => `__users/${user.id}/${item}`));
    return NextResponse.json({ ok: true, uploaded });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Upload failed" },
      { status: 400 }
    );
  }
}
