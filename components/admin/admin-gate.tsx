"use client";

import Link from "next/link";
import { useState } from "react";
import { HardDrive, Loader2, LockKeyhole } from "lucide-react";

export function AdminGate() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok || !data.ok) {
      setError(data.message || "Admin password salah.");
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <main className="min-h-screen bg-[#050608] px-5 text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl items-center">
        <div className="grid w-full gap-8 md:grid-cols-[1fr_420px] md:items-center">
          <div>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D4FF2A] text-black shadow-[0_20px_70px_rgba(212,255,42,0.18)]">
              <HardDrive className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-[#D4FF2A]">driveOne</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-6xl">Admin console</h1>
            <p className="mt-4 max-w-lg text-zinc-400">Password-only access for managing files, users, shares, and preview cache.</p>
          </div>
          <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#D4FF2A]/10 text-[#D4FF2A]">
                <LockKeyhole className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold">driveOne Admin</h2>
                <p className="text-xs text-zinc-500">by VJMRTIM</p>
              </div>
            </div>
            <label className="mt-6 block text-sm text-zinc-300">
              Admin password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-[#D4FF2A]"
                autoComplete="current-password"
              />
            </label>
            {error ? <p className="mt-3 rounded-2xl border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
            <button disabled={loading || !password} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D4FF2A] px-4 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enter Admin
            </button>
            <Link href="/" className="mt-4 block text-center text-xs text-zinc-500 hover:text-[#D4FF2A]">Back to driveOne</Link>
          </form>
        </div>
      </section>
    </main>
  );
}
