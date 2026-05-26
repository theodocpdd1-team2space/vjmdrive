import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBeautySharesByOwner } from "@/lib/beauty-share-db";
import { UserShell } from "@/components/layout/user-shell";
import { BeautyListClient } from "./beauty-list-client";

export const dynamic = "force-dynamic";

export default async function BeautySharesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/beauty");
  if (user.role === "ADMIN") redirect("/admin");

  const shares = await getBeautySharesByOwner(user.id);

  return (
    <UserShell title="Beauty Shares" subtitle="Client delivery links created from your folders.">
      <BeautyListClient initialShares={shares.map((share) => ({ ...share, publicUrl: `/b/${share.slug}` }))} />
    </UserShell>
  );
}
