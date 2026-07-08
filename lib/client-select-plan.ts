import type { DriveUser, SessionUser } from "./auth";
import type { ClientSelectLink } from "./client-select-db";

export function normalizeClientSelectPlan(plan: unknown) {
  const value = typeof plan === "string" ? plan.trim().toUpperCase() : "";
  if (value === "LITE" || value === "PERSONAL") return "LITE";
  if (value === "BASIC") return "BASIC";
  if (value === "PRO" || value === "VENDOR") return "PRO";
  if (value === "BUSINESS" || value === "CUSTOM") return "BUSINESS";
  return "FREE";
}

export function clientSelectLimitForPlan(plan: unknown) {
  const normalized = normalizeClientSelectPlan(plan);
  if (normalized === "FREE") return 1;
  if (normalized === "LITE") return 3;
  return null;
}

export function canCreateClientSelect(
  user: (Pick<DriveUser, "plan"> & Pick<SessionUser, "role">) | null,
  activeLinkCount: number
) {
  if (!user) return { ok: false, limit: 0, plan: "FREE", message: "Account unavailable." };
  if (user.role === "ADMIN") return { ok: true, limit: null, plan: "ADMIN" };

  const plan = normalizeClientSelectPlan(user.plan);
  const limit = clientSelectLimitForPlan(plan);
  if (limit === null || activeLinkCount < limit) return { ok: true, limit, plan };

  return {
    ok: false,
    limit,
    plan,
    message: `Your ${plan} plan can create up to ${limit} active Client Select link${limit === 1 ? "" : "s"}.`,
  };
}

export function activeClientSelectCount(links: ClientSelectLink[], ownerUserId: string) {
  return links.filter((link) => link.ownerUserId === ownerUserId && link.isActive && !link.deletedAt).length;
}
