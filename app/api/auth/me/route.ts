import { NextResponse } from "next/server";
import { findUserById, getCurrentUser, userStorageLabel, userStoragePath } from "@/lib/auth";
import { planQuotaLabel } from "@/lib/plan-display";
import { directorySize, storageSummary } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: true, user: null });

  const user = await findUserById(session.id);
  if (!user || user.disabled) return NextResponse.json({ ok: true, user: null });

  const usedBytes = user.role === "USER" ? await directorySize(userStoragePath(user)).catch(() => 0) : 0;
  const storage = storageSummary(usedBytes, user.quotaBytes);

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      plan: user.plan || "Free",
      quotaBytes: user.quotaBytes,
      storageLimitBytes: user.quotaBytes,
      storageUsedBytes: usedBytes,
      storagePercent: storage.percent,
      planLabel: planQuotaLabel(user.plan, user.quotaBytes),
      storageKey: user.storageKey || "default",
      storageLabel: userStorageLabel(user.storageKey),
    },
  });
}
