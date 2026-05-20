import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { UserDriveClient } from "./user-drive-client";

export const dynamic = "force-dynamic";

export default async function UserDrivePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "ADMIN") redirect("/admin");
  return <UserDriveClient />;
}
