import { redirect } from "next/navigation";
import { getAppUrl, getCurrentUser } from "@/lib/auth";
import { readUsers } from "@/lib/auth";
import { readBeautyShares } from "@/lib/beauty-share-db";
import { readShareLinks } from "@/lib/share-db";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminSharesClient } from "./shares-client";

export const dynamic = "force-dynamic";

export default async function AdminSharesPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login?next=/admin/shares");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [shares, beautyShares, users] = await Promise.all([
    readShareLinks(),
    readBeautyShares(),
    readUsers(),
  ]);

  return (
    <AdminShell
      title="Shares"
      subtitle="Single source of truth for access links, emails, permissions, and disabled links."
    >
      <AdminSharesClient
        initialShares={shares}
        initialBeautyShares={beautyShares.map((share) => ({ ...share, publicUrl: `/b/${share.slug}` }))}
        users={users.map((item) => ({ id: item.id, email: item.email }))}
        origin={getAppUrl()}
        now={Date.now()}
      />
    </AdminShell>
  );
}
