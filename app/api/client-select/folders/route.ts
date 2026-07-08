import { NextRequest, NextResponse } from "next/server";
import { findUserById, getCurrentUser, userStorageRelativePath } from "@/lib/auth";
import { listDriveFolder } from "@/lib/drive-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  try {
    const requestedPath = req.nextUrl.searchParams.get("path") || "";
    const user = session.role === "USER" ? await findUserById(session.id) : null;

    if (session.role === "USER" && (!user || user.disabled)) {
      return NextResponse.json({ ok: false, message: "Account unavailable." }, { status: 403 });
    }

    const data = await listDriveFolder({
      path: requestedPath,
      scopeRootPath: user ? userStorageRelativePath(user) : undefined,
      canDownload: false,
    });

    return NextResponse.json({
      ok: true,
      path: data.path,
      itemCount: data.items.length,
      folders: data.items
        .filter((item) => item.type === "folder")
        .map((item) => ({
          name: item.name,
          path: item.path,
        })),
    });
  } catch (caught) {
    return NextResponse.json(
      {
        ok: false,
        message: caught instanceof Error ? caught.message : "Folder unavailable.",
      },
      { status: 404 }
    );
  }
}
