import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock3, Eye, LockKeyhole, PlayCircle, Share2, UploadCloud } from "lucide-react";

const features = [
  { icon: Share2, title: "Custom share link", body: "Link delivery yang rapi untuk folder, file, dan aset project." },
  { icon: LockKeyhole, title: "Private email access", body: "Batasi akses ke email tertentu untuk delivery yang lebih terkontrol." },
  { icon: Clock3, title: "Expiry link", body: "Atur masa aktif link tanpa mengubah file asli di storage." },
  { icon: PlayCircle, title: "Video preview cache", body: "Preview video lebih nyaman lewat cache ringan untuk client delivery." },
  { icon: UploadCloud, title: "Upload progress", body: "Upload multi-file dengan feedback yang jelas dan tidak mengganggu flow." },
  { icon: Eye, title: "Vendor-friendly page", body: "Halaman share clean untuk vendor, kreator, event, dan produk digital." },
];

const plans = [
  { name: "Free", storage: "1 GB", price: "Rp0", note: "Untuk mulai kirim file private.", active: true },
  { name: "Personal", storage: "25 GB", price: "Rp7.000/month", note: "Coming Soon" },
  { name: "Pro", storage: "100 GB", price: "Rp15.000/month", note: "Coming Soon" },
  { name: "Vendor", storage: "Custom branded delivery", price: "Custom", note: "Coming Soon" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050608] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_50%_0%,rgba(212,255,42,0.16),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-xl font-semibold tracking-tight">driveOne</span>
          <span className="text-xs font-medium text-[#D4FF2A]">by VJMRTIM</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
          <a href="#pricing" className="hover:text-white">Pricing</a>
          <a href="#features" className="hover:text-white">Features</a>
          <Link href="/login" className="hover:text-white">Login</Link>
        </nav>
        <Link href="/login" className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white backdrop-blur hover:border-[#D4FF2A]/50">
          Masuk
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl content-center gap-10 px-5 pb-10 pt-8 lg:grid-cols-[1fr_440px] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4FF2A]/20 bg-[#D4FF2A]/10 px-3 py-1 text-xs font-semibold text-[#D4FF2A]">
            <BadgeCheck className="h-3.5 w-3.5" />
            Private file delivery for creators & vendors
          </div>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
            Share files beautifully with driveOne.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
            Bagikan file dengan link yang lebih rapi, preview nyaman, dan kontrol akses fleksibel untuk vendor foto/video, kreator digital, event production, dan seller produk digital.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D4FF2A] px-5 py-3 text-sm font-semibold text-black shadow-[0_16px_50px_rgba(212,255,42,0.16)]">
              Masuk ke Drive
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/signup" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white backdrop-blur hover:border-white/25">
              Mulai Gratis
            </Link>
          </div>
          <Link href="/admin" className="mt-4 inline-block text-xs text-zinc-500 hover:text-[#D4FF2A]">
            Admin Login
          </Link>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="rounded-[1.5rem] border border-white/10 bg-[#090b10] p-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs text-[#D4FF2A]">Client delivery</p>
                <h2 className="mt-1 font-semibold">Wedding Final Assets</h2>
              </div>
              <span className="rounded-full bg-[#D4FF2A]/10 px-3 py-1 text-xs text-[#D4FF2A]">Private</span>
            </div>
            <div className="mt-4 grid gap-3">
              {["Highlights.mp4", "Edited Photos", "Invoice.pdf"].map((item, index) => (
                <div key={item} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4FF2A]/10 text-[#D4FF2A]">
                      {index === 0 ? <PlayCircle className="h-5 w-5" /> : index === 1 ? <Share2 className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{item}</p>
                      <p className="text-xs text-zinc-500">{index === 0 ? "Preview ready" : "View access"}</p>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500">Open</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-7xl px-5 py-16">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold text-[#D4FF2A]">Features</p>
          <h2 className="mt-2 text-3xl font-semibold">Simple delivery, private access, clean previews.</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <Icon className="h-5 w-5 text-[#D4FF2A]" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="relative z-10 mx-auto max-w-7xl px-5 py-16">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold text-[#D4FF2A]">Pricing</p>
          <h2 className="mt-2 text-3xl font-semibold">Start light, upgrade when ready.</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.name} className={`rounded-3xl border p-5 ${plan.active ? "border-[#D4FF2A]/40 bg-[#D4FF2A]/10" : "border-white/10 bg-white/[0.035]"}`}>
              <h3 className="font-semibold">{plan.name}</h3>
              <p className="mt-3 text-2xl font-semibold">{plan.price}</p>
              <p className="mt-2 text-sm text-zinc-400">{plan.storage}</p>
              <button disabled={!plan.active} className="mt-5 w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-500">
                {plan.active ? "Mulai Gratis" : "Coming Soon"}
              </button>
              <p className="mt-3 text-xs text-zinc-500">{plan.note}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-5 py-8 text-sm text-zinc-500">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 driveOne by VJMRTIM. Private access only.</p>
          <a href="https://solusivendor.com" className="hover:text-[#D4FF2A]">Built by solusivendor.com</a>
        </div>
      </footer>
    </main>
  );
}
