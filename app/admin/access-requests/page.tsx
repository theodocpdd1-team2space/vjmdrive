import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { readShareAccessRequests } from "@/lib/share-access-requests";
import { AdminShell } from "@/components/layout/admin-shell";
import { AccessRequestsClient } from "./requests-client";

export const dynamic = "force-dynamic";

export default async function AdminAccessRequestsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const requests = await readShareAccessRequests();

  return (
    <AdminShell
      title="Access Requests"
      subtitle="Review, approve, or reject private share access requests."
    >
      <AccessRequestsClient initialRequests={requests} />
    </AdminShell>
  );
}
