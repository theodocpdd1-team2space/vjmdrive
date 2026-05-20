import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AdminDriveApp from "@/components/admin/admin-drive-app";

export const dynamic = "force-dynamic";

export default async function AdminDrivePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/admin");
  return <AdminDriveApp />;
}
