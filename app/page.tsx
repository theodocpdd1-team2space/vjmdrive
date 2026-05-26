import Link from "next/link";
import {
  ArrowRight,
  Check,
  Cloud,
  Download,
  Eye,
  Globe2,
  HardDrive,
  ImageIcon,
  Link2,
  LockKeyhole,
  Palette,
  Play,
  Share2,
  ShieldCheck,
  UploadCloud,
  Users,
  type LucideIcon,
} from "lucide-react";

const navItems = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "Beauty Share", href: "#beauty-share" },
  { label: "Pricing", href: "#pricing" },
];

const workflowBadges = [
  "Wedding",
  "Event",
  "Visual Pack",
  "Photo Video",
  "Church",
  "Corporate",
];

const valueRows = [
  {
    icon: UploadCloud,
    title: "Upload and organize",
    body: "Simpan file kerja, dokumen, foto, video, ZIP, dan aset digital dalam satu cloud drive.",
  },
  {
    icon: ShieldCheck,
    title: "Share with control",
    body: "Buat link untuk folder atau file tertentu dengan public access atau private email access.",
  },
  {
    icon: Palette,
    title: "Deliver beautifully",
    body: "Gunakan Custom Link dan Beauty Share saat delivery ke client perlu terlihat lebih profesional.",
  },
];

const featureCards = [
  {
    icon: Cloud,
    title: "Cloud Storage",
    body: "Store project files, client assets, documents, videos, and archives in one daily workspace.",
  },
  {
    icon: LockKeyhole,
    title: "Private Sharing",
    body: "Share folders or files with public links or restrict access to selected client emails.",
  },
  {
    icon: Users,
    title: "Shared with Me",
    body: "Every user, including Free, can receive private shares in a clean shared workspace.",
  },
  {
    icon: Link2,
    title: "Custom Link",
    body: "Turn long folder URLs into memorable client links like driveone.id/ayu-rio.",
  },
  {
    icon: Eye,
    title: "Preview Cache",
    body: "Support smoother image and video previews before clients download final files.",
  },
  {
    icon: ImageIcon,
    title: "Beauty Share",
    body: "Convert selected folders into a polished delivery page when the handoff needs extra care.",
  },
];

const pricingPlans = [
  {
    name: "Free",
    price: "Rp0",
    period: "/month",
    storage: "1 GB",
    description: "For trying driveOne and receiving private shares.",
    cta: "Start for free",
    href: "/signup",
    recommended: false,
    features: [
      "1 GB storage",
      "Shared with Me",
      "Unlimited received shares",
      "2 Beauty Share links",
      "2 Custom Links",
      "All file supported",
      "No daily download limit",
    ],
  },
  {
    name: "Lite",
    price: "Rp14.000",
    period: "/month",
    storage: "25 GB",
    description: "For creators and vendors with regular client files.",
    cta: "Choose Lite",
    href: "https://lynk.id/colorize/2wjv69yl0vj0",
    recommended: false,
    features: [
      "25 GB storage",
      "Unlimited share links",
      "Unlimited Beauty Share",
      "Unlimited Custom Links",
      "Private email access",
      "All file supported",
      "No daily download limit",
    ],
  },
  {
    name: "Basic",
    price: "Rp25.000",
    period: "/month",
    storage: "100 GB",
    description: "Recommended for steady client delivery workflows.",
    cta: "Choose Basic",
    href: "http://lynk.id/colorize/xxqomllw7ge1",
    recommended: true,
    features: [
      "100 GB storage",
      "Unlimited share links",
      "Unlimited Beauty Share",
      "Custom client link",
      "Shared with Me",
      "Client delivery page",
      "No daily download limit",
    ],
  },
  {
    name: "Pro",
    price: "Rp48.000",
    period: "/month",
    storage: "500 GB",
    description: "For studios, event teams, and active digital sellers.",
    cta: "Choose Pro",
    href: "https://lynk.id/colorize/xlqxwn4qxkoo",
    recommended: false,
    features: [
      "500 GB storage",
      "Unlimited share links",
      "Preview cache",
      "Beauty Share themes",
      "Custom client link",
      "Client delivery page",
      "No daily download limit",
    ],
  },
  {
    name: "Business",
    price: "Rp200.000",
    period: "/month",
    storage: "5 TB",
    description: "For larger teams, production archives, and busy delivery cycles.",
    cta: "Choose Business",
    href: "http://lynk.id/colorize/woqld41ykz81",
    recommended: false,
    features: [
      "5 TB storage",
      "Unlimited share links",
      "Preview cache",
      "Priority support",
      "Beauty Share themes",
      "Custom client link",
      "Fair usage applies",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    storage: "Custom",
    description: "For teams that need branded delivery, domains, and setup support.",
    cta: "Talk to us",
    href: "/signup",
    recommended: false,
    features: [
      "Custom storage",
      "Custom domain",
      "Custom branded delivery page",
      "Team access",
      "Dedicated setup",
      "Priority support",
    ],
  },
];

export default function LandingPage() {
  return (
    <main id="home" className="min-h-screen bg-[#f4f4ef] text-black selection:bg-[#d7ff3f]">
      <section
        className="relative min-h-screen overflow-hidden bg-black bg-cover bg-center text-white"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0.18) 38%, rgba(0,0,0,0.78) 100%), url('/hero1.jpg')",
        }}
      >
        <Header />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl items-end px-5 pb-12 pt-32 md:px-8 md:pb-16 lg:pb-20">
          <div className="max-w-5xl">
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white backdrop-blur-md">
              driveOne by VJMRTIM
            </p>
            <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[0.95] tracking-tight text-white md:text-7xl lg:text-[5.8rem]">
              A better cloud drive for creators, vendors, and{" "}
              <span className="text-[#d7ff3f]">digital teams.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-white/76 md:text-lg">
              Simpan file seperti cloud drive biasa. Bagikan dengan cara yang
              lebih rapi, private, dan profesional.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d7ff3f] px-6 py-3.5 text-sm font-black text-black transition hover:bg-[#ccff00]"
              >
                Start for free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/22 bg-white/10 px-6 py-3.5 text-sm font-black text-white backdrop-blur-md transition hover:bg-white/18"
              >
                Open driveOne
              </Link>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-[-0.12em] z-0 text-center text-[18vw] font-black leading-none tracking-tight text-transparent opacity-35 [-webkit-text-stroke:1px_rgba(255,255,255,0.32)]">
          driveOne
        </div>
      </section>

      <section className="bg-white px-5 py-8 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Built for real file workflows.
          </h2>
          <div className="flex flex-wrap gap-2">
            {workflowBadges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-black/10 bg-[#f4f4ef] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-black/62"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#d7ff3f] px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-black/55">
              Why driveOne
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-black leading-[1] tracking-tight md:text-6xl">
              Cloud storage, made cleaner for daily sharing.
            </h2>
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-black px-6 py-3.5 text-sm font-black text-white transition hover:bg-white hover:text-black"
            >
              Get started now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="divide-y divide-black/16 border-y border-black/16">
            {valueRows.map((row) => (
              <ValueRow key={row.title} {...row} />
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-white px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-black/42">
              Features
            </p>
            <h2 className="mt-4 text-4xl font-black leading-[1] tracking-tight md:text-6xl">
              Everything you need to store and share files.
            </h2>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section id="beauty-share" className="bg-[#f4f4ef] px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <BeautyShareMockup />

          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-black/42">
              Beauty Share
            </p>
            <h2 className="mt-4 max-w-xl text-4xl font-black leading-[1] tracking-tight md:text-6xl">
              A feature for premium delivery.
            </h2>
            <p className="mt-6 max-w-xl text-base font-medium leading-8 text-black/64">
              Beauty Share bukan produk utama, tapi fitur di dalam driveOne.
              Ubah folder tertentu menjadi halaman delivery yang lebih cantik
              untuk foto, video, visual pack, dan file client.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-black/42">
              Custom Link
            </p>
            <h2 className="mt-4 max-w-xl text-4xl font-black leading-[1] tracking-tight md:text-6xl">
              File links don&apos;t have to look messy.
            </h2>
            <p className="mt-6 max-w-lg text-base font-medium leading-8 text-black/64">
              Keep cloud-drive sharing familiar, then make client-facing links
              easier to read, remember, and send.
            </p>
          </div>

          <div className="rounded-[2rem] border border-black/10 bg-[#f4f4ef] p-4 shadow-sm md:p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <LinkPanel
                label="Before"
                value="drive.google.com/drive/folders/1exKOp1QJTvEJ48hrDGA..."
                dark={false}
              />
              <LinkPanel label="After" value="driveone.id/ayu-rio" dark />
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-[#f4f4ef] px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <div className="lg:sticky lg:top-8">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-black/42">
              Best pricing plans
            </p>
            <h2 className="mt-4 max-w-xl text-4xl font-black leading-[1] tracking-tight md:text-6xl">
              Flexible pricing plans for you
            </h2>
            <p className="mt-6 max-w-md text-base font-medium leading-8 text-black/64">
              Choose the storage you need today and scale as your delivery
              workflow grows.
            </p>
            <p className="mt-4 max-w-md rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold leading-6 text-black/70">
              Setelah pembayaran, isi email akun driveOne agar plan dapat diaktifkan manual oleh admin.
            </p>
          </div>

          <div className="space-y-4">
            {pricingPlans.map((plan) => (
              <PricingCard key={plan.name} plan={plan} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-black px-5 py-20 text-white md:px-8 md:py-24">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#d7ff3f]">
              driveOne
            </p>
            <h2 className="mt-4 max-w-4xl text-4xl font-black leading-[1] tracking-tight md:text-6xl">
              Store your files. Share them beautifully.
            </h2>
            <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-white/68">
              Mulai dari cloud storage sederhana, lalu pakai private access,
              custom link, dan Beauty Share saat delivery perlu terlihat lebih
              profesional.
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#d7ff3f] px-7 py-4 text-sm font-black text-black transition hover:bg-[#ccff00]"
          >
            Create free account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="bg-[#f4f4ef] px-5 py-10 text-sm font-bold text-black/56 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <p>© 2026 driveOne by VJMRTIM. A better cloud drive for creative teams.</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/login" className="transition hover:text-black">
              Login
            </Link>
            <a href="#pricing" className="transition hover:text-black">
              Pricing
            </a>
            <a href="https://solusivendor.com" className="transition hover:text-black">
              Built by solusivendor.com
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Header() {
  return (
    <header className="absolute inset-x-0 top-0 z-20 px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d7ff3f] text-black">
            <HardDrive className="h-5 w-5" />
          </span>
          <span className="min-w-0 leading-none">
            <span className="block text-lg font-black tracking-tight text-white">driveOne</span>
            <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.18em] text-white/62">
              BY VJMRTIM
            </span>
          </span>
        </Link>

        <nav className="hidden rounded-full border border-white/18 bg-white/12 px-2 py-1 backdrop-blur-md md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-black text-white/76 transition hover:bg-white hover:text-black"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <Link
          href="/signup"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#d7ff3f] px-4 py-2.5 text-sm font-black text-black transition hover:bg-[#ccff00] md:px-5"
        >
          Get started
          <ArrowRight className="hidden h-4 w-4 sm:block" />
        </Link>
      </div>
    </header>
  );
}

function ValueRow({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="grid gap-5 py-8 md:grid-cols-[auto_1fr]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-[#d7ff3f]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-2xl font-black tracking-tight">{title}</h3>
        <p className="mt-2 max-w-2xl text-base font-medium leading-7 text-black/68">{body}</p>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="min-h-64 rounded-[2rem] border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d7ff3f] text-black">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-8 text-2xl font-black tracking-tight">{title}</h3>
      <p className="mt-3 text-sm font-medium leading-7 text-black/62">{body}</p>
    </div>
  );
}

function BeautyShareMockup() {
  return (
    <div className="rounded-[2rem] border border-black/10 bg-white p-4 shadow-sm">
      <div className="rounded-[1.5rem] bg-[#f4f4ef] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-black/42">
              Beauty Share
            </p>
            <h3 className="mt-2 text-3xl font-black tracking-tight">Ayu & Rio Gallery</h3>
          </div>
          <span className="rounded-full bg-[#d7ff3f] px-3 py-1.5 text-xs font-black">
            Feature
          </span>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-3">
          <div className="col-span-2 row-span-2 flex min-h-52 items-center justify-center rounded-[1.25rem] bg-black text-[#d7ff3f]">
            <ImageIcon className="h-10 w-10" />
          </div>
          <GalleryBlock label="Photos" lime />
          <GalleryBlock label="Video" />
          <GalleryBlock label="Pack" />
          <GalleryBlock label="Final" lime />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-black text-white">
            <Download className="h-4 w-4" />
            Download Gallery
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-full border border-black/12 bg-white px-5 py-3 text-sm font-black text-black">
            <Play className="h-4 w-4" />
            Preview Files
          </button>
        </div>
      </div>
    </div>
  );
}

function PricingCard({
  plan,
}: {
  plan: (typeof pricingPlans)[number];
}) {
  const isExternal = /^https?:\/\//.test(plan.href);
  const ctaClass = `mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-black transition ${
    plan.recommended
      ? "bg-[#d7ff3f] text-black hover:bg-[#ccff00]"
      : "bg-black text-white hover:bg-[#d7ff3f] hover:text-black"
  }`;

  return (
    <div
      className={`rounded-[2rem] border p-5 shadow-sm md:p-6 ${
        plan.recommended
          ? "border-black bg-black text-white"
          : "border-black/10 bg-white text-black"
      }`}
    >
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1fr] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-black tracking-tight">{plan.name}</h3>
            {plan.recommended ? (
              <span className="rounded-full bg-[#d7ff3f] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black">
                Recommended
              </span>
            ) : null}
          </div>
          <p
            className={`mt-3 text-sm font-medium leading-6 ${
              plan.recommended ? "text-white/62" : "text-black/56"
            }`}
          >
            {plan.description}
          </p>
          <div className="mt-6">
            <p className="text-4xl font-black tracking-tight">
              {plan.price}
              <span
                className={`text-base font-bold ${
                  plan.recommended ? "text-white/50" : "text-black/42"
                }`}
              >
                {plan.period}
              </span>
            </p>
            <p
              className={`mt-2 text-xs font-black uppercase tracking-[0.16em] ${
                plan.recommended ? "text-[#d7ff3f]" : "text-black/42"
              }`}
            >
              {plan.storage}
            </p>
          </div>
        </div>

        <div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {plan.features.map((feature) => (
              <li
                key={feature}
                className={`flex gap-2 text-sm font-medium ${
                  plan.recommended ? "text-white/78" : "text-black/64"
                }`}
              >
                <Check
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    plan.recommended ? "text-[#d7ff3f]" : "text-black"
                  }`}
                />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          {isExternal ? (
            <a href={plan.href} target="_blank" rel="noopener noreferrer" className={ctaClass}>
              {plan.cta}
            </a>
          ) : (
            <Link href={plan.href} className={ctaClass}>
              {plan.cta}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function LinkPanel({
  label,
  value,
  dark,
}: {
  label: string;
  value: string;
  dark: boolean;
}) {
  return (
    <div
      className={`rounded-[1.5rem] p-5 ${
        dark ? "bg-black text-white" : "border border-black/10 bg-white text-black"
      }`}
    >
      <p
        className={`text-xs font-black uppercase tracking-[0.18em] ${
          dark ? "text-[#d7ff3f]" : "text-black/42"
        }`}
      >
        {label}
      </p>
      <p className="mt-5 min-h-20 break-all text-2xl font-black leading-tight tracking-tight md:text-3xl">
        {value}
      </p>
      <div
        className={`mt-6 flex items-center gap-2 text-sm font-bold ${
          dark ? "text-white/64" : "text-black/52"
        }`}
      >
        {dark ? <Globe2 className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        <span>{dark ? "Clean client-ready link" : "Long raw folder URL"}</span>
      </div>
    </div>
  );
}

function GalleryBlock({ label, lime = false }: { label: string; lime?: boolean }) {
  return (
    <div
      className={`flex min-h-24 items-end rounded-[1.25rem] p-3 ${
        lime ? "bg-[#d7ff3f]" : "bg-white"
      }`}
    >
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-black/56">
        {label}
      </span>
    </div>
  );
}
