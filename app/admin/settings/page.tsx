import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { readSettings } from "@/lib/settings";
import { AdminSettingsClient } from "./settings-client";
import { getAssetRoot } from "@/lib/safe-path";
import { getCacheRoot, getPreviewRoot, getThumbnailRoot } from "@/lib/preview-cache";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const settings = await readSettings();
  return (
    <AdminSettingsClient
      initialSettings={settings}
      emailStatus={{
        from: process.env.RESEND_FROM || settings.email.from,
        appUrl: process.env.APP_URL || settings.email.appUrl,
        resendApiKey: process.env.RESEND_API_KEY ? "configured" : "missing",
      }}
      systemInfo={{
        assetRoot: getAssetRoot(),
        cacheRoot: getCacheRoot(),
        previewRoot: getPreviewRoot(),
        thumbnailRoot: getThumbnailRoot(),
        downloadBaseUrl: process.env.DOWNLOAD_BASE_URL || settings.storage.downloadBaseUrl || "",
      }}
    />
  );
}
