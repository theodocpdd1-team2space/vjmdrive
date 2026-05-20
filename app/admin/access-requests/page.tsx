import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { readShareAccessRequests } from "@/lib/share-access-requests";
import { AccessRequestsClient } from "./requests-client";

export const dynamic = "force-dynamic";

export default async function AdminAccessRequestsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/admin");
  return <AccessRequestsClient initialRequests={await readShareAccessRequests()} />;
}
