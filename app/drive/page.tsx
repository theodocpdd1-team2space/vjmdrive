import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { UserShell } from "@/components/layout/user-shell";
import { UserDriveClient } from "./user-drive-client";

export const dynamic = "force-dynamic";

export default async function UserDrivePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/drive");
  if (user.role === "ADMIN") redirect("/admin");
  return (
    <UserShell title="My Drive" subtitle="Upload, browse, preview, and share your personal files.">
      <UserDriveClient embedded />
    </UserShell>
  );
}
