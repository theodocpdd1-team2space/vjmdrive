"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  HardDrive,
  LayoutDashboard,
  Link2,
  ListChecks,
  LogOut,
  Menu,
  RotateCw,
  Settings,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { logoutAndRedirect } from "@/components/common/logout";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/drive", label: "Drive", icon: HardDrive },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/shares", label: "Shares", icon: Link2 },
  { href: "/admin/access-requests", label: "Access Requests", icon: ShieldAlert },
  { href: "/admin/preview-queue", label: "Preview Queue", icon: ListChecks },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      {open ? <button aria-label="Close sidebar overlay" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" /> : null}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[290px] flex-col border-r border-white/10 bg-[#0b0c10]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#d7ff3f] text-black">
              <HardDrive className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black tracking-tight text-white">driveOne</p>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#d7ff3f]">by VJMRTIM</p>
            </div>
          </Link>
          <button onClick={() => setOpen(false)} className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close sidebar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="mt-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${active ? "bg-[#d7ff3f] text-black" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button onClick={() => void logoutAndRedirect()} className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white">
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </aside>

      <section className="min-h-screen lg:pl-[290px]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08090d]/90 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setOpen(true)} className="rounded-2xl border border-white/10 p-2 text-zinc-300 hover:bg-white/10 lg:hidden" aria-label="Open sidebar">
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d7ff3f]">driveOne Admin</p>
                <h1 className="truncate text-xl font-black tracking-tight text-white md:text-2xl">{title}</h1>
                {subtitle ? <p className="mt-1 hidden text-sm text-zinc-500 md:block">{subtitle}</p> : null}
              </div>
            </div>
            <RotateCw className="hidden h-5 w-5 text-zinc-700 md:block" />
          </div>
        </header>
        <div className="p-4 md:p-6">{children}</div>
      </section>
    </main>
  );
}
