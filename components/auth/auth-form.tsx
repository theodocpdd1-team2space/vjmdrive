"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { HardDrive, Loader2 } from "lucide-react";

type Mode = "login" | "signup" | "forgot" | "reset";

const titles = {
  login: "Login to driveOne",
  signup: "Create your driveOne account",
  forgot: "Reset your password",
  reset: "Set a new password",
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const endpoint =
      mode === "signup"
        ? "/api/auth/signup"
        : mode === "forgot"
          ? "/api/auth/forgot-password"
          : mode === "reset"
            ? "/api/auth/reset-password"
            : "/api/login";
    const body =
      mode === "reset"
        ? { token: searchParams.get("token") || "", newPassword: password }
        : mode === "signup"
          ? { name, email, password }
          : mode === "forgot"
            ? { email }
            : { email, password };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok || !data.ok) {
      setError(data.message || "Action failed.");
      return;
    }

    setMessage(data.message || "Success.");
    if (mode === "login") {
      router.push(data.user?.role === "ADMIN" ? "/admin" : "/dashboard");
    }
  }

  async function resendVerification() {
    if (!email) {
      setError("Isi email dulu.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    setMessage(data.message || "If the account needs verification, instructions have been sent.");
  }

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      <section className="mx-auto flex min-h-screen max-w-5xl items-center px-5">
        <div className="grid w-full gap-8 md:grid-cols-[1fr_420px] md:items-center">
          <div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#d7ff3f] text-black">
              <HardDrive className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-[#d7ff3f]">by VJMRTIM</p>
            <h1 className="mt-2 text-4xl font-semibold text-white md:text-5xl">driveOne</h1>
            <p className="mt-4 max-w-lg text-zinc-400">Private cloud drive for creators, vendors, and digital products.</p>
          </div>
          <form onSubmit={submit} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-semibold text-white">{titles[mode]}</h2>
            {mode === "signup" ? (
              <label className="mt-5 block text-sm text-zinc-300">
                Name
                <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-[#d7ff3f]" autoComplete="name" />
              </label>
            ) : null}
            {mode !== "reset" ? (
              <label className="mt-5 block text-sm text-zinc-300">
                Email
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-[#d7ff3f]" autoComplete="email" />
              </label>
            ) : null}
            {mode !== "forgot" ? (
              <label className="mt-5 block text-sm text-zinc-300">
                Password
                <input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-[#d7ff3f]" autoComplete={mode === "reset" || mode === "signup" ? "new-password" : "current-password"} />
              </label>
            ) : null}
            {error ? <p className="mt-3 rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
            {message ? <p className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">{message}</p> : null}
            {mode === "login" && error.toLowerCase().includes("verify") ? (
              <button type="button" onClick={resendVerification} className="mt-3 w-full rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-white/10">
                Resend verification email
              </button>
            ) : null}
            <button disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "forgot" ? "Send reset link" : mode === "reset" ? "Update password" : mode === "signup" ? "Create account" : "Login"}
            </button>
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-zinc-400">
              {mode !== "login" ? <Link href="/login" className="text-[#d7ff3f]">Login</Link> : null}
              {mode !== "signup" ? <Link href="/signup" className="text-[#d7ff3f]">Sign up</Link> : null}
              {mode === "login" ? <Link href="/admin" className="text-zinc-500 hover:text-[#d7ff3f]">Admin Login</Link> : null}
              {mode !== "forgot" && mode !== "reset" ? <Link href="/forgot-password" className="text-[#d7ff3f]">Forgot password</Link> : null}
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
