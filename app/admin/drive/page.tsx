import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AdminDriveApp from "@/components/admin/admin-drive-app";
import { AdminShell } from "@/components/layout/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminDrivePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/drive");
  if (user.role !== "ADMIN") redirect("/dashboard");

  return (
    <AdminShell title="Drive" subtitle="Browse and manage PublicShare files and folders.">
      <AdminDriveApp embedded />
    </AdminShell>
  );
}
