import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminUsersClient } from "./users-client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login?next=/admin/users");
  if (user.role !== "ADMIN") redirect("/dashboard");

  return (
    <AdminShell
      title="Users"
      subtitle="Manage user accounts, plans, quota, verification, and access status."
    >
      <AdminUsersClient />
    </AdminShell>
  );
}
