"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { HardDrive, Loader2 } from "lucide-react";

type Mode = "login" | "signup" | "forgot" | "reset";

const titles = {
  login: "Login to driveOne",
  signup: "Create your driveOne account",
  forgot: "Reset your password",
  reset: "Set a new password",
};

function getSafeNextPath(value: string | null) {
  if (!value) return "";

  try {
    const decoded = decodeURIComponent(value);

    // Only allow internal relative paths. Prevent open redirect.
    if (!decoded.startsWith("/")) return "";
    if (decoded.startsWith("//")) return "";
    if (decoded.includes("://")) return "";

    return decoded;
  } catch {
    return "";
  }
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => getSafeNextPath(searchParams.get("next")), [searchParams]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

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
      const fallback = data.user?.role === "ADMIN" ? "/admin" : "/dashboard";
      router.push(nextPath || fallback);
      router.refresh();
      return;
    }

    if (mode === "reset") {
      window.setTimeout(() => {
        router.push(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
      }, 900);
      return;
    }

    if (mode === "signup") {
      // If user arrived from a protected share, keep the next path available after verification/login.
      if (nextPath) {
        setMessage(
          data.message ||
            "Account created. Please verify your email, then login again to access the shared link."
        );
      }
    }
  }

  async function resendVerification() {
    if (!email) {
      setError("Isi email dulu.");
      return;
    }

    if (loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json().catch(() => ({}));

    setLoading(false);
    setMessage(data.message || "If the account needs verification, instructions have been sent.");
  }

  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  const signupHref = nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup";
  const forgotHref = nextPath ? `/forgot-password?next=${encodeURIComponent(nextPath)}` : "/forgot-password";

  return (
    <main className="min-h-screen bg-[#08090d] text-zinc-100">
      <section className="mx-auto flex min-h-screen max-w-5xl items-center px-5">
        <div className="grid w-full gap-8 md:grid-cols-[1fr_420px] md:items-center">
          <div>
            <Link
              href="/"
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d7ff3f] text-black shadow-[0_0_35px_rgba(215,255,63,0.18)]"
              aria-label="Back to driveOne landing page"
            >
              <HardDrive className="h-6 w-6" />
            </Link>

            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#d7ff3f]">by VJMRTIM</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-white md:text-5xl">driveOne</h1>
            <p className="mt-4 max-w-lg text-zinc-400">
              Private cloud drive for creators, vendors, and digital products.
            </p>

            {nextPath ? (
              <div className="mt-6 max-w-lg rounded-2xl border border-[#d7ff3f]/20 bg-[#d7ff3f]/10 p-4 text-sm text-zinc-200">
                <p className="font-semibold text-[#d7ff3f]">Protected share detected</p>
                <p className="mt-1 text-zinc-400">
                  Login first, then you will be redirected back to the shared link.
                </p>
              </div>
            ) : null}
          </div>

          <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/30">
            <h2 className="text-xl font-bold text-white">{titles[mode]}</h2>

            {mode === "signup" ? (
              <label className="mt-5 block text-sm text-zinc-300">
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-[#d7ff3f]"
                  autoComplete="name"
                  required
                />
              </label>
            ) : null}

            {mode !== "reset" ? (
              <label className="mt-5 block text-sm text-zinc-300">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-[#d7ff3f]"
                  autoComplete="email"
                  required
                />
              </label>
            ) : null}

            {mode !== "forgot" ? (
              <label className="mt-5 block text-sm text-zinc-300">
                Password
                <input
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-[#d7ff3f]"
                  autoComplete={mode === "reset" || mode === "signup" ? "new-password" : "current-password"}
                  required
                />
              </label>
            ) : null}

            {error ? (
              <p className="mt-3 rounded-2xl border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm text-red-100">
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">
                {message}
              </p>
            ) : null}

            {mode === "login" && error.toLowerCase().includes("verify") ? (
              <button
                type="button"
                onClick={resendVerification}
                disabled={loading}
                className="mt-3 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Resend verification email
              </button>
            ) : null}

            <button
              disabled={loading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d7ff3f] px-4 py-3 font-black text-black transition hover:bg-[#c8ef34] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "forgot"
                ? "Send reset link"
                : mode === "reset"
                  ? "Update password"
                  : mode === "signup"
                    ? "Create account"
                    : "Login"}
            </button>

            <div className="mt-5 flex flex-wrap gap-3 text-sm text-zinc-400">
              {mode !== "login" ? (
                <Link href={loginHref} className="text-[#d7ff3f] hover:text-[#edff97]">
                  Login
                </Link>
              ) : null}

              {mode !== "signup" ? (
                <Link href={signupHref} className="text-[#d7ff3f] hover:text-[#edff97]">
                  Sign up
                </Link>
              ) : null}

              {mode === "login" ? (
                <Link href="/admin" className="text-zinc-500 hover:text-[#d7ff3f]">
                  Admin Login
                </Link>
              ) : null}

              {mode !== "forgot" && mode !== "reset" ? (
                <Link href={forgotHref} className="text-[#d7ff3f] hover:text-[#edff97]">
                  Forgot password
                </Link>
              ) : null}

              <Link href="/" className="text-zinc-500 hover:text-zinc-200">
                Back to home
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}