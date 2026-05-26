import { NextResponse } from "next/server";
import { findUserById, getCurrentUser, userStorageRelativePath } from "@/lib/auth";
import { cleanupDeletedPathMetadata } from "@/lib/path-metadata";
import { disableBeautySharesForDeletedPaths } from "@/lib/beauty-share-db";
import { deleteUserItem } from "@/lib/user-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  if (session.role !== "USER") return NextResponse.json({ ok: false, message: "User delete only." }, { status: 403 });

  const user = await findUserById(session.id);
  if (!user || user.disabled) {
    return NextResponse.json({ ok: false, message: "Account unavailable." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const itemPath = typeof body?.path === "string" ? body.path : "";
  const type = body?.type === "folder" ? "folder" : body?.type === "file" ? "file" : null;

  if (!type) {
    return NextResponse.json({ ok: false, message: "Invalid delete type." }, { status: 400 });
  }

  try {
    const deleted = await deleteUserItem(user, itemPath, type);
    const absoluteScopedDeleted = deleted.map((item) => `${userStorageRelativePath(user.id)}/${item}`);
    const metadata = await cleanupDeletedPathMetadata(absoluteScopedDeleted, { ownerUserId: user.id });
    const disabledBeautyShares = await disableBeautySharesForDeletedPaths(absoluteScopedDeleted, user.id);

    return NextResponse.json({
      ok: true,
      deleted,
      metadata: {
        ...metadata,
        disabledBeautyShares,
      },
    });
  } catch (caught) {
    return NextResponse.json(
      { ok: false, message: caught instanceof Error ? caught.message : "Delete failed." },
      { status: 400 }
    );
  }
}
