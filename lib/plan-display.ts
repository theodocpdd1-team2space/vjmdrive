export function formatPlanBytes(bytes: number) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function planQuotaLabel(plan?: string | null, quotaBytes?: number | null) {
  const normalizedPlan = plan?.trim() || "Free";
  if (quotaBytes === null) return normalizedPlan === "Custom" ? "Custom" : `Unlimited ${normalizedPlan}`;
  if (typeof quotaBytes !== "number" || !Number.isFinite(quotaBytes)) return normalizedPlan;
  return `${formatPlanBytes(quotaBytes)} ${normalizedPlan}`;
}
