import { redirect } from "next/navigation";
import { getAppUrl, getCurrentUser } from "@/lib/auth";
import { getClientSelectDisplayStatus, getClientSelectLinksByOwner, getLatestClientSelectSubmission } from "@/lib/client-select-db";
import { UserShell } from "@/components/layout/user-shell";
import { ClientSelectClient } from "./client-select-client";

export const dynamic = "force-dynamic";

export default async function ClientSelectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/client-select");
  if (user.role === "ADMIN") redirect("/admin");

  const links = await getClientSelectLinksByOwner(user.id);
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
    <UserShell title="Client Select" subtitle="Create photo-selection links and review submitted filenames.">
      <ClientSelectClient initialLinks={rows} />
    </UserShell>
  );
}
