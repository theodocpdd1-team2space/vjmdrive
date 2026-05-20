import Link from "next/link";
import { redirect } from "next/navigation";
import {
  HardDrive,
  Link2,
  ListChecks,
  Settings,
  ShieldAlert,
  Users,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { AdminShell } from "@/components/layout/admin-shell";

export const dynamic = "force-dynamic";

const cards = [
  {
    href: "/admin/drive",
    title: "Drive",
    desc: "Open the main PublicShare file manager.",
    icon: HardDrive,
  },
  {
    href: "/admin/shares",
    title: "Shares",
    desc: "Manage access links, emails, permissions, and disabled links.",
    icon: Link2,
  },
  {
    href: "/admin/users",
    title: "Users",
    desc: "Manage user accounts, plans, quota, and status.",
    icon: Users,
  },
  {
    href: "/admin/access-requests",
    title: "Access Requests",
    desc: "Approve or reject private share access requests.",
    icon: ShieldAlert,
  },
  {
    href: "/admin/preview-queue",
    title: "Preview Queue",
    desc: "Monitor preview cache jobs and video processing.",
    icon: ListChecks,
  },
  {
    href: "/admin/settings",
    title: "Settings",
    desc: "Configure appearance, language, storage, email, and preview settings.",
    icon: Settings,
  },
];

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  return (
    <AdminShell
      title="Dashboard"
      subtitle="Central admin dashboard for driveOne."
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
          <p className="text-sm font-bold text-[#d7ff3f]">{user.email}</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-white">
            Admin Dashboard
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Use this page only as the dashboard. File management is in Drive, and all access-link management is in Shares.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 transition hover:border-[#d7ff3f]/40 hover:bg-white/[0.055]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d7ff3f]/10 text-[#d7ff3f] transition group-hover:bg-[#d7ff3f] group-hover:text-black">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-black text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{card.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
