import { redirect } from "next/navigation";
import { getAppUrl, getCurrentUser } from "@/lib/auth";
import { readShareLinks } from "@/lib/share-db";
import { AdminSharesClient } from "./shares-client";

export const dynamic = "force-dynamic";

export default async function AdminSharesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/admin");
  return <AdminSharesClient initialShares={await readShareLinks()} origin={getAppUrl()} now={new Date().getTime()} />;
}
