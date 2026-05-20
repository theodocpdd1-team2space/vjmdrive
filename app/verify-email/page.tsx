import Link from "next/link";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { updateUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const result = token ? await consumeAuthToken("VERIFY_EMAIL", token) : { ok: false as const, message: "Token tidak valid." };

  if (result.ok) {
    await updateUser(result.record.userId, { emailVerified: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08090d] px-4 text-zinc-100">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-white/[0.04] p-6 text-center">
        <p className="text-sm font-semibold text-[#d7ff3f]">VJM Drive</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          {result.ok ? "Email verified" : "Verification failed"}
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          {result.ok ? "Email verified. You can now login." : result.message}
        </p>
        <Link href="/login" className="mt-6 inline-flex rounded-lg bg-[#d7ff3f] px-4 py-3 text-sm font-semibold text-black">
          Go to login
        </Link>
      </section>
    </main>
  );
}
