import Link from "next/link";
import { 
  ArrowRight, 
  BadgeCheck, 
  Clock3, 
  Eye, 
  LockKeyhole, 
  Share2, 
  UploadCloud,
  Folder,
  FileVideo,
  FileText,
  Search,
  MoreVertical,
  HardDrive
} from "lucide-react";

const features = [
  { icon: Share2, title: "Custom share link", body: "Link delivery yang rapi untuk folder, file, dan aset project." },
  { icon: LockKeyhole, title: "Private email access", body: "Batasi akses ke email tertentu untuk delivery yang lebih terkontrol." },
  { icon: Clock3, title: "Expiry link", body: "Atur masa aktif link tanpa mengubah file asli di storage." },
  { icon: FileVideo, title: "Video preview cache", body: "Preview video lebih nyaman lewat cache ringan untuk client delivery." },
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
    <main className="min-h-screen overflow-hidden bg-[#050608] text-white selection:bg-[#D4FF2A]/30">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(circle_at_50%_0%,rgba(212,255,42,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,black_20%,transparent_80%)]" />
      </div>

      {/* Navigation */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2 group">
          <HardDrive className="h-6 w-6 text-[#D4FF2A] transition-transform group-hover:scale-110" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold tracking-tight">driveOne</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4FF2A]">by VJMRTIM</span>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-400 md:flex">
          <a href="#features" className="transition-colors hover:text-white">Features</a>
          <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
          <Link href="/login" className="transition-colors hover:text-white">Login</Link>
        </nav>
        <Link href="/login" className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition-all hover:bg-white/10 hover:border-white/20">
          Masuk
        </Link>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-100px)] max-w-7xl content-center gap-16 px-6 pb-20 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12 lg:pt-0">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4FF2A]/20 bg-[#D4FF2A]/10 px-3 py-1.5 text-xs font-semibold text-[#D4FF2A]">
            <BadgeCheck className="h-4 w-4" />
            Private file delivery for creators & vendors
          </div>
          <h1 className="mt-8 max-w-2xl text-5xl font-bold leading-[1.1] tracking-tight md:text-6xl lg:text-7xl">
            Share files <br className="hidden lg:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500">
              beautifully.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 md:text-lg">
            Bagikan file dengan link yang lebih rapi, preview nyaman, dan kontrol akses fleksibel untuk vendor foto/video, kreator digital, event production, dan seller produk digital.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link href="/login" className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#D4FF2A] px-8 text-sm font-bold text-black transition-all hover:bg-[#bce61a] hover:scale-105 shadow-[0_0_40px_-10px_rgba(212,255,42,0.4)]">
              Masuk ke Drive
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/signup" className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 text-sm font-semibold text-white backdrop-blur transition-all hover:bg-white/10">
              Mulai Gratis
            </Link>
          </div>
        </div>

        {/* Modern Drive Mockup */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-b from-[#D4FF2A]/20 to-transparent opacity-50 blur-xl" />
          <div className="relative rounded-[2rem] border border-white/10 bg-[#0A0C10]/80 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="rounded-[1.5rem] border border-white/5 bg-[#050608] overflow-hidden">
              {/* Mockup Header */}
              <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-5 py-4">
                <div className="flex items-center gap-2.5 text-sm font-medium text-zinc-400">
                  <span className="hover:text-white cursor-pointer transition-colors">My Drive</span>
                  <span className="text-zinc-700">/</span>
                  <span className="text-zinc-100">Wedding Client</span>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                  <Search className="h-4 w-4 text-zinc-400" />
                </div>
              </div>
              
              {/* Mockup File List */}
              <div className="p-3">
                <div className="grid gap-1">
                  {/* Folder */}
                  <div className="group flex items-center justify-between rounded-xl p-3 hover:bg-white/5 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D4FF2A]/10">
                        <Folder className="h-5 w-5 text-[#D4FF2A]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">Raw Photos</p>
                        <p className="text-xs text-zinc-500">12 items</p>
                      </div>
                    </div>
                    <MoreVertical className="h-4 w-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Video File */}
                  <div className="group flex items-center justify-between rounded-xl p-3 hover:bg-white/5 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                        <FileVideo className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">Highlights_V2.mp4</p>
                        <p className="text-xs text-zinc-500">845 MB • Modified today</p>
                      </div>
                    </div>
                    <MoreVertical className="h-4 w-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Document */}
                  <div className="group flex items-center justify-between rounded-xl p-3 hover:bg-white/5 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10">
                        <FileText className="h-5 w-5 text-rose-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">Invoice_089.pdf</p>
                        <p className="text-xs text-zinc-500">120 KB • Shared</p>
                      </div>
                    </div>
                    <MoreVertical className="h-4 w-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-24 border-t border-white/5">
        <div className="mb-12 max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wider text-[#D4FF2A]">Workspace Features</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Simple delivery. Private access.</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="group rounded-[2rem] border border-white/5 bg-white/[0.02] p-8 transition-all hover:bg-white/[0.04] hover:border-white/10">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 transition-transform group-hover:scale-110 group-hover:bg-[#D4FF2A]/10">
                <Icon className="h-6 w-6 text-[#D4FF2A]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 mx-auto max-w-7xl px-6 py-24 border-t border-white/5">
        <div className="mb-12 max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wider text-[#D4FF2A]">Pricing Plans</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Start light, upgrade when ready.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.name} className={`relative flex flex-col rounded-[2rem] border p-8 transition-all ${plan.active ? "border-[#D4FF2A]/30 bg-gradient-to-b from-[#D4FF2A]/10 to-transparent" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"}`}>
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight">{plan.price}</span>
              </div>
              <p className="mt-2 text-sm font-medium text-[#D4FF2A]">{plan.storage}</p>
              
              <div className="mt-auto pt-8">
                <button disabled={!plan.active} className={`w-full rounded-full py-3 text-sm font-bold transition-all ${plan.active ? "bg-white text-black hover:bg-zinc-200" : "bg-white/5 text-zinc-500 cursor-not-allowed"}`}>
                  {plan.active ? "Mulai Gratis" : "Coming Soon"}
                </button>
                <p className="mt-4 text-center text-xs text-zinc-500">{plan.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-12 text-sm text-zinc-500">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            <p>© 2026 driveOne by VJMRTIM. Private access only.</p>
          </div>
          <a href="https://solusivendor.com" className="transition-colors hover:text-[#D4FF2A]">
            Built by solusivendor.com
          </a>
        </div>
      </footer>
    </main>
  );
}