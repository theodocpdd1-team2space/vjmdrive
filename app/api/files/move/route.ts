import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { findUserById, getCurrentUser, userStorageRelativePath } from "@/lib/auth";
import { moveItems } from "@/lib/file-ops";
import { moveUserItems } from "@/lib/user-files";
import { normalizeDrivePath } from "@/lib/safe-path";
import { updateMoveRelatedMetadata } from "@/lib/path-metadata";
import { migratePreviewCacheForMoves } from "@/lib/preview-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeRel(value: string) {
  return normalizeDrivePath(value || "");
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        message: "Login required.",
      },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);

  const items: string[] = Array.isArray(body?.items)
    ? body.items
        .filter((item: unknown) => typeof item === "string")
        .map((item: string) => normalizeRel(item))
        .filter(Boolean)
    : [];

  const targetFolder = typeof body?.targetFolder === "string" ? normalizeRel(body.targetFolder) : "";

  if (items.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "No items selected.",
      },
      { status: 400 }
    );
  }

  try {
    if (session.role === "ADMIN") {
      const moved = await moveItems(items, targetFolder);
      const movePlan = items.map((oldPath, index) => ({ oldPath, newPath: moved[index] || oldPath }));
      const cache = await migratePreviewCacheForMoves(movePlan);
      const metadata = await updateMoveRelatedMetadata(movePlan);

      return NextResponse.json({
        ok: true,
        moved,
        cache,
        metadata,
      });
    }

    const user = await findUserById(session.id);

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          message: "User not found.",
        },
        { status: 401 }
      );
    }

    const moved = await moveUserItems(user, items, targetFolder);
    const userRoot = userStorageRelativePath(user);
    const movePlan = items.map((oldPath, index) => ({
      oldPath: path.posix.join(userRoot, oldPath),
      newPath: path.posix.join(userRoot, moved[index] || oldPath),
    }));
    const cache = await migratePreviewCacheForMoves(movePlan);
    const metadata = await updateMoveRelatedMetadata(movePlan);

    return NextResponse.json({
      ok: true,
      moved,
      cache,
      metadata,
    });
  } catch (caught) {
    return NextResponse.json(
      {
        ok: false,
        message: caught instanceof Error ? caught.message : "Move failed.",
      },
      { status: 400 }
    );
  }
}
