"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  CheckSquare,
  Folder,
  Link2,
  ListChecks,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { logoutAndRedirect } from "@/components/common/logout";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/drive", label: "Drive", icon: Folder },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/shares", label: "Shares", icon: Link2 },
  { href: "/admin/client-select", label: "Client Select", icon: CheckSquare },
  { href: "/admin/access-requests", label: "Access Requests", icon: Shield },
  { href: "/admin/preview-queue", label: "Preview Queue", icon: RefreshCw },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#090a0d] text-zinc-100">
      {open ? (
        <button
          aria-label="Close sidebar overlay"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[290px] flex-col border-r border-white/10 bg-[#08090d] px-4 py-5 transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
        <Link href="/admin" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#d7ff3f] text-black">
            <Folder className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-lg font-black tracking-tight text-white">
              driveOne
            </p>
          </div>
        </Link>
          <button
            onClick={() => setOpen(false)}
            className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="mt-9 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${
                  active
                    ? "bg-[#d7ff3f] text-black"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => void logoutAndRedirect()}
          className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>

        <p className="mt-5 text-xs text-zinc-600">driveOne Admin</p>
      </aside>

      <section className="min-h-screen lg:pl-[290px]">
        {title || subtitle ? (
          <header className="border-b border-white/10 bg-[#090a0d] px-5 py-4">
            <div className="flex items-start gap-3">
              <button
                onClick={() => setOpen(true)}
                className="mt-1 rounded-xl border border-white/10 p-2 text-zinc-300 hover:bg-white/10 lg:hidden"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
            {title ? (
              <>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d7ff3f]">
                  driveOne Admin
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
                  {title}
                </h1>
              </>
            ) : null}

            {subtitle ? (
              <p className="mt-2 text-sm font-medium text-zinc-500">
                {subtitle}
              </p>
            ) : null}
              </div>
            </div>
          </header>
        ) : null}

        <div className="p-5">{children}</div>
      </section>
    </main>
  );
}
