import { redirect } from "next/navigation";
import { getAppUrl, getCurrentUser } from "@/lib/auth";
import { getClientSelectDisplayStatus, getLatestClientSelectSubmission, readClientSelectLinks } from "@/lib/client-select-db";
import { AdminShell } from "@/components/layout/admin-shell";
import { ClientSelectClient } from "@/app/client-select/client-select-client";

export const dynamic = "force-dynamic";

export default async function AdminClientSelectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/client-select");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const links = (await readClientSelectLinks()).filter((link) => !link.deletedAt);
  const rows = await Promise.all(
    links.map(async (link) => {
      const latestSubmission = await getLatestClientSelectSubmission(link.id);
      return {
        ...link,
        publicUrl: `/select/${link.token}`,
        absolutePublicUrl: `${getAppUrl()}/select/${link.token}`,
        displayStatus: getClientSelectDisplayStatus(link),
        selectedCount: latestSubmission?.selectedFilePaths.length || 0,
        submittedAt: latestSubmission?.submittedAt || link.submittedAt || null,
        updatedAt: latestSubmission?.updatedAt || null,
        latestSubmission,
      };
    })
  );

  return (
    <AdminShell title="Client Select" subtitle="Manage photo-selection links and submitted filenames.">
      <ClientSelectClient initialLinks={rows} />
    </AdminShell>
  );
}
