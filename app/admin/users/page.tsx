import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminUsersClient } from "./users-client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/admin");
  return <AdminUsersClient />;
}
