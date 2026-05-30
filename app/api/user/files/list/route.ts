import { NextRequest, NextResponse } from "next/server";
import { findUserById, getCurrentUser, userStoragePath, userStorageRelativePath } from "@/lib/auth";
import { listDriveFolder } from "@/lib/drive-list";
import { planQuotaLabel } from "@/lib/plan-display";
import { directorySize, storageSummary } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const user = await findUserById(session.id);
  if (!user || user.disabled) return NextResponse.json({ ok: false, message: "Account unavailable." }, { status: 403 });
  const data = await listDriveFolder({
    path: req.nextUrl.searchParams.get("path") || "",
    scopeRootPath: userStorageRelativePath(user.id),
    urlPrefix: "/api/user/files",
    canDownload: true,
  });
  const usedBytes = await directorySize(userStoragePath(user.id)).catch(() => 0);
  const storage = storageSummary(usedBytes, user.quotaBytes);
  return NextResponse.json({
    ok: true,
    ...data,
    plan: user.plan || "Free",
    quotaBytes: user.quotaBytes,
    storageLimitBytes: user.quotaBytes,
    storageUsedBytes: usedBytes,
    storagePercent: storage.percent,
    planLabel: planQuotaLabel(user.plan, user.quotaBytes),
  });
}
