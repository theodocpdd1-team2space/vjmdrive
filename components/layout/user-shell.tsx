"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  HardDrive,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Share2,
  User,
  X,
} from "lucide-react";
import { logoutAndRedirect } from "@/components/common/logout";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/drive", label: "My Drive", icon: HardDrive },
  { href: "/shared", label: "Shared with Me", icon: Share2 },
  { href: "/account", label: "Account", icon: User },
];

export function UserShell({
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
      {open ? (
        <button
          aria-label="Close sidebar overlay"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[290px] flex-col border-r border-white/10 bg-[#0b0c10]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#d7ff3f] text-black shadow-[0_0_35px_rgba(215,255,63,0.18)]">
              <HardDrive className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-lg font-black tracking-tight text-white">driveOne</p>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#d7ff3f]">
                by VJMRTIM
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

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <span className="text-sm text-zinc-600">Quick navigation</span>
          </div>
        </div>

        <nav className="mt-5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${
                  active
                    ? "bg-[#d7ff3f] text-black shadow-[0_0_28px_rgba(215,255,63,0.12)]"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">User Workspace</p>
              <Settings className="h-4 w-4 text-[#d7ff3f]" />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Your personal drive, shared files, and account settings.
            </p>
          </div>

          <button
            onClick={() => void logoutAndRedirect()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <section className="min-h-screen lg:pl-[290px]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08090d]/90 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="rounded-2xl border border-white/10 p-2 text-zinc-300 hover:bg-white/10 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff3f]">
                driveOne User
              </p>
              <h1 className="truncate text-xl font-black tracking-tight text-white md:text-2xl">
                {title}
              </h1>
              {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6">{children}</div>
      </section>
    </main>
  );
}
