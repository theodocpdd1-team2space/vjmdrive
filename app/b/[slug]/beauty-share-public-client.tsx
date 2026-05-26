"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Download,
  Expand,
  FileText,
  Folder,
  Grid2X2,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Video,
  X,
} from "lucide-react";

type BeautyTheme = "light" | "dark";
type BeautyLayout = "collage" | "grid" | "magazine";

type PublicDriveItem = {
  name: string;
  path: string;
  type: string;
  extension: string;
  size: string | null;
  bytes: number;
  modified: string;
  canPreview: boolean;
  previewStatus: string;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  originalUrl: string;
  directDownloadUrl: string | null;
  downloadMode: "direct" | "app";
};

type PublicBeautyShare = {
  slug: string;
  title: string;
  subtitle?: string;
  clientName?: string;
  theme: BeautyTheme;
  layout: BeautyLayout;
};

type MagazinePage = {
  kind: "cover" | "intro" | "media" | "back";
  title: string;
  items: PublicDriveItem[];
};

function isMedia(item: PublicDriveItem) {
  return item.type === "image" || item.type === "video";
}

function isDocument(item: PublicDriveItem) {
  return !isMedia(item) && item.type !== "folder";
}

function mediaSource(item: PublicDriveItem) {
  if (item.type === "image") return item.originalUrl;
  if (item.type === "video") return item.previewUrl || item.originalUrl;
  return item.originalUrl;
}

function previewImage(item: PublicDriveItem | null) {
  if (!item) return "";
  if (item.thumbnailUrl) return item.thumbnailUrl;
  if (item.type === "image") return item.originalUrl;
  return "";
}

function iconFor(item: PublicDriveItem) {
  if (item.type === "folder") return Folder;
  if (item.type === "video") return Video;
  if (item.type === "image") return ImageIcon;
  if (item.type === "archive") return Archive;
  return FileText;
}

function typeLabel(item: PublicDriveItem) {
  if (item.type === "folder") return "Folder";
  if (item.extension) return item.extension.toUpperCase();
  return "File";
}

function chunkMedia(media: PublicDriveItem[]) {
  const pages: MagazinePage[] = [];
  let index = 0;

  while (index < media.length) {
    const size = index % 3 === 0 ? 1 : index % 3 === 1 ? 3 : 4;
    const items = media.slice(index, index + size);
    pages.push({ kind: "media", title: `Gallery ${pages.length + 1}`, items });
    index += items.length;
  }

  return pages;
}

function pageLayoutClass(count: number) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  return "grid-cols-2";
}

export function BeautySharePublicClient({
  share,
  items,
  coverItem,
}: {
  share: PublicBeautyShare;
  items: PublicDriveItem[];
  coverItem: PublicDriveItem | null;
}) {
  const mediaItems = useMemo(() => items.filter(isMedia), [items]);
  const documents = useMemo(() => items.filter(isDocument), [items]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [turning, setTurning] = useState<"next" | "prev" | null>(null);
  const magazineRef = useRef<HTMLDivElement | null>(null);

  const themeClass =
    share.theme === "dark"
      ? "bg-[#050608] text-white [--beauty-card:#111318] [--beauty-soft:#181b22] [--beauty-muted:#a1a1aa] [--beauty-border:rgba(255,255,255,0.12)] [--beauty-hero:#050608]"
      : "bg-[#f4f4ef] text-black [--beauty-card:#ffffff] [--beauty-soft:#ecece4] [--beauty-muted:#52525b] [--beauty-border:rgba(0,0,0,0.10)] [--beauty-hero:#171717]";

  const title = share.title || "Client Delivery";
  const subtitle = share.subtitle || "Your files are ready.";
  const clientName = share.clientName || title;
  const coverSrc = previewImage(coverItem);
  const lightboxItem = lightboxIndex === null ? null : mediaItems[lightboxIndex] || null;
  const downloadHref = items.find((item) => item.directDownloadUrl)?.directDownloadUrl || null;

  const magazinePages = useMemo<MagazinePage[]>(() => {
    return [
      { kind: "cover", title, items: coverItem ? [coverItem] : mediaItems.slice(0, 1) },
      { kind: "intro", title: "Your files are ready.", items: [] },
      ...chunkMedia(mediaItems),
      { kind: "back", title: "Download your files", items: [] },
    ];
  }, [coverItem, mediaItems, title]);

  const currentPage = magazinePages[Math.min(pageIndex, magazinePages.length - 1)];
  const nextPage = magazinePages[Math.min(pageIndex + 1, magazinePages.length - 1)];

  useEffect(() => {
    const timer = window.setTimeout(() => setShowWelcome(false), 1100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (lightboxIndex !== null) setLightboxIndex(null);
        else if (fullscreen) exitFullscreen();
      }
      if (event.key === "ArrowRight") {
        if (lightboxIndex !== null) nextLightbox();
        else goPage("next");
      }
      if (event.key === "ArrowLeft") {
        if (lightboxIndex !== null) previousLightbox();
        else goPage("prev");
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!playing || lightboxIndex !== null) return;
    const timer = window.setInterval(() => goPage("next"), 5000);
    return () => window.clearInterval(timer);
  }, [playing, pageIndex, lightboxIndex]);

  function goPage(direction: "next" | "prev") {
    setPlaying(false);
    setTurning(direction);
    window.setTimeout(() => setTurning(null), 420);
    setPageIndex((current) => {
      if (direction === "next") return Math.min(magazinePages.length - 1, current + 1);
      return Math.max(0, current - 1);
    });
  }

  function nextLightbox() {
    setLightboxIndex((current) => {
      if (current === null) return current;
      return (current + 1) % mediaItems.length;
    });
  }

  function previousLightbox() {
    setLightboxIndex((current) => {
      if (current === null) return current;
      return (current - 1 + mediaItems.length) % mediaItems.length;
    });
  }

  async function enterFullscreen() {
    setFullscreen(true);
    const element = magazineRef.current;
    if (element?.requestFullscreen) await element.requestFullscreen().catch(() => undefined);
  }

  async function exitFullscreen() {
    setFullscreen(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  }

  function openLightbox(item: PublicDriveItem) {
    const index = mediaItems.findIndex((candidate) => candidate.path === item.path);
    if (index >= 0) {
      setPlaying(false);
      setLightboxIndex(index);
    }
  }

  return (
    <main className={`min-h-screen overflow-hidden ${themeClass}`}>
      {showWelcome ? (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#d7ff3f] px-6 text-center text-black transition-opacity duration-500">
          <p className="text-sm font-black uppercase tracking-[0.28em]">driveOne</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight md:text-7xl">Hello, {clientName}</h1>
          <p className="mt-4 text-lg font-bold">File kamu sudah siap.</p>
        </div>
      ) : null}

      <header className="fixed inset-x-0 top-0 z-40 px-4 py-4 text-white md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-full border border-white/15 bg-black/25 px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <a href="#top" className="min-w-0">
            <p className="text-sm font-black leading-none tracking-tight">driveOne</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#d7ff3f]">by VJMRTIM</p>
          </a>
          <nav className="flex items-center gap-2">
            <a href="#gallery" className="rounded-full px-3 py-2 text-xs font-bold text-white/85 hover:bg-white/10">
              View files
            </a>
            {downloadHref ? (
              <a href={downloadHref} className="hidden rounded-full bg-[#d7ff3f] px-3 py-2 text-xs font-black text-black sm:inline-flex">
                Download
              </a>
            ) : null}
          </nav>
        </div>
      </header>

      <section id="top" className="relative flex min-h-[70vh] items-end overflow-hidden md:min-h-[92vh]">
        {coverSrc ? (
          <img src={coverSrc} alt={title} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(215,255,63,0.55),transparent_28%),linear-gradient(135deg,#050608,#202414_45%,#d7ff3f)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/20" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-36 text-white md:px-8 md:pb-24">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-[#d7ff3f]">Delivered with driveOne</p>
          <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[0.95] tracking-tight md:text-8xl">{title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/78 md:text-xl">{subtitle}</p>
          <p className="mt-3 max-w-2xl text-sm font-bold text-white/58">A private delivery page prepared for you.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#album" className="rounded-full bg-[#d7ff3f] px-5 py-3 text-sm font-black text-black transition hover:bg-[#c8ef34]">
              View gallery
            </a>
            <a href="#files" className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/20">
              View files
            </a>
            {downloadHref ? (
              <a href={downloadHref} className="rounded-full border border-white/20 bg-black/20 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/20">
                Download files
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section id="album" className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff3f]">Album preview</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">A polished first look.</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[var(--beauty-muted)]">Preview the delivery as an editorial album before browsing every file.</p>
        </div>

        {mediaItems.length ? (
          <div className="grid gap-4 md:grid-cols-6 md:auto-rows-[190px]">
            {mediaItems.slice(0, 8).map((item, index) => (
              <button
                key={item.path}
                type="button"
                onClick={() => openLightbox(item)}
                className={`group relative overflow-hidden rounded-[1.5rem] border border-[var(--beauty-border)] bg-[var(--beauty-card)] text-left shadow-2xl shadow-black/10 ${
                  index === 0 ? "md:col-span-3 md:row-span-2" : index === 1 ? "md:col-span-3" : "md:col-span-2"
                }`}
              >
                {previewImage(item) ? (
                  <img src={previewImage(item)} alt={item.name} loading={index === 0 ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[var(--beauty-muted)]">
                    <Video className="h-10 w-10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent opacity-90" />
                <p className="absolute inset-x-0 bottom-0 truncate p-4 text-sm font-bold text-white">{item.name}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {items.slice(0, 6).map((item) => (
              <FileCard key={item.path} item={item} onPreview={openLightbox} />
            ))}
          </div>
        )}
      </section>

      <section ref={magazineRef} className={`${fullscreen ? "fixed inset-0 z-[120] overflow-auto bg-[#050608] p-4 text-white" : ""}`}>
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff3f]">Magazine mode</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Flip through the delivery.</h2>
            </div>
            <MagazineControls
              pageIndex={pageIndex}
              total={magazinePages.length}
              playing={playing}
              fullscreen={fullscreen}
              onPrevious={() => goPage("prev")}
              onNext={() => goPage("next")}
              onPlay={() => setPlaying((value) => !value)}
              onFullscreen={() => (fullscreen ? void exitFullscreen() : void enterFullscreen())}
            />
          </div>

          <div className={`relative rounded-[2rem] border border-[var(--beauty-border)] bg-[var(--beauty-soft)] p-3 shadow-2xl shadow-black/20 transition duration-500 ${turning ? "scale-[0.99]" : "scale-100"}`}>
            <div className={`grid gap-3 md:grid-cols-2 ${turning === "next" ? "animate-[beautyPageNext_420ms_ease]" : turning === "prev" ? "animate-[beautyPagePrev_420ms_ease]" : ""}`}>
              <MagazinePageView page={currentPage} share={share} coverItem={coverItem} stats={{ total: items.length, photos: mediaItems.filter((item) => item.type === "image").length, videos: mediaItems.filter((item) => item.type === "video").length, documents: documents.length }} onGallery={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })} />
              <div className="hidden md:block">
                <MagazinePageView page={nextPage} share={share} coverItem={coverItem} stats={{ total: items.length, photos: mediaItems.filter((item) => item.type === "image").length, videos: mediaItems.filter((item) => item.type === "video").length, documents: documents.length }} onGallery={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })} />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-y-4 left-1/2 hidden w-px bg-black/10 md:block" />
          </div>
        </div>
      </section>

      <section id="gallery" className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff3f]">Gallery</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Browse and download your files.</h2>
          </div>
          <p className="text-sm text-[var(--beauty-muted)]">{items.length} item ready for delivery</p>
        </div>

        {mediaItems.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mediaItems.map((item) => (
              <button key={item.path} type="button" onClick={() => openLightbox(item)} className="group overflow-hidden rounded-[1.5rem] border border-[var(--beauty-border)] bg-[var(--beauty-card)] text-left shadow-xl shadow-black/5">
                <div className="relative aspect-[4/3] overflow-hidden bg-black/10">
                  {previewImage(item) ? (
                    <img src={previewImage(item)} alt={item.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[var(--beauty-muted)]">
                      <Video className="h-10 w-10" />
                    </div>
                  )}
                  <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">{item.type}</span>
                </div>
                <div className="p-4">
                  <p className="truncate text-sm font-black">{item.name}</p>
                  <p className="mt-1 text-xs text-[var(--beauty-muted)]">{item.size || typeLabel(item)}</p>
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section id="files" className="mx-auto max-w-7xl px-4 pb-16 md:px-8 md:pb-24">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <FileCard key={item.path} item={item} onPreview={openLightbox} />
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-[var(--beauty-border)] px-4 py-10 text-sm font-bold text-[var(--beauty-muted)] md:flex-row md:items-center md:justify-between md:px-8">
        <span>Delivered with driveOne by VJMRTIM</span>
        <a href="https://solusivendor.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#d7ff3f]">Built by solusivendor.com</a>
      </footer>

      {lightboxItem ? (
        <Lightbox
          item={lightboxItem}
          index={lightboxIndex || 0}
          total={mediaItems.length}
          onClose={() => setLightboxIndex(null)}
          onNext={nextLightbox}
          onPrevious={previousLightbox}
        />
      ) : null}
    </main>
  );
}

function MagazineControls({
  pageIndex,
  total,
  playing,
  fullscreen,
  onPrevious,
  onNext,
  onPlay,
  onFullscreen,
}: {
  pageIndex: number;
  total: number;
  playing: boolean;
  fullscreen: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onPlay: () => void;
  onFullscreen: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onPrevious} disabled={pageIndex <= 0} className="rounded-full border border-[var(--beauty-border)] bg-[var(--beauty-card)] p-3 disabled:opacity-40">
        <ArrowLeft className="h-4 w-4" />
      </button>
      <span className="rounded-full border border-[var(--beauty-border)] bg-[var(--beauty-card)] px-4 py-3 text-xs font-black">
        Page {pageIndex + 1} / {total}
      </span>
      <button type="button" onClick={onNext} disabled={pageIndex >= total - 1} className="rounded-full border border-[var(--beauty-border)] bg-[var(--beauty-card)] p-3 disabled:opacity-40">
        <ArrowRight className="h-4 w-4" />
      </button>
      <button type="button" onClick={onPlay} className="rounded-full border border-[var(--beauty-border)] bg-[var(--beauty-card)] p-3">
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button type="button" onClick={onFullscreen} className="rounded-full border border-[var(--beauty-border)] bg-[var(--beauty-card)] p-3">
        {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
      <a href="#gallery" className="rounded-full bg-[#d7ff3f] px-4 py-3 text-xs font-black text-black">
        View gallery
      </a>
    </div>
  );
}

function MagazinePageView({
  page,
  share,
  coverItem,
  stats,
  onGallery,
}: {
  page: MagazinePage;
  share: PublicBeautyShare;
  coverItem: PublicDriveItem | null;
  stats: { total: number; photos: number; videos: number; documents: number };
  onGallery: () => void;
}) {
  const coverSrc = previewImage(coverItem || page.items[0] || null);

  if (page.kind === "cover") {
    return (
      <article className="relative min-h-[520px] overflow-hidden rounded-[1.5rem] bg-black text-white shadow-xl">
        {coverSrc ? <img src={coverSrc} alt={share.title} className="absolute inset-0 h-full w-full object-cover" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
        <div className="relative flex min-h-[520px] flex-col justify-end p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d7ff3f]">Cover</p>
          <h3 className="mt-4 text-4xl font-black leading-none md:text-6xl">{share.title}</h3>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/75">{share.subtitle || "Your files are ready."}</p>
        </div>
      </article>
    );
  }

  if (page.kind === "intro") {
    return (
      <article className="flex min-h-[520px] flex-col justify-between rounded-[1.5rem] bg-[var(--beauty-card)] p-8 shadow-xl">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d7ff3f]">Intro</p>
          <h3 className="mt-4 text-4xl font-black leading-none">Your files are ready.</h3>
          <p className="mt-5 max-w-md text-sm leading-7 text-[var(--beauty-muted)]">Preview, browse, and download your files in one place.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total files" value={stats.total} />
          <Stat label="Photos" value={stats.photos} />
          <Stat label="Videos" value={stats.videos} />
          <Stat label="Documents" value={stats.documents} />
        </div>
      </article>
    );
  }

  if (page.kind === "back") {
    return (
      <article className="flex min-h-[520px] flex-col justify-between rounded-[1.5rem] bg-[#d7ff3f] p-8 text-black shadow-xl">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em]">Back cover</p>
          <h3 className="mt-4 text-4xl font-black leading-none">Download your files</h3>
          <p className="mt-5 max-w-md text-sm font-bold leading-7 text-black/70">This delivery was prepared with driveOne by VJMRTIM.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onGallery} className="rounded-full bg-black px-4 py-3 text-xs font-black text-white">
            View gallery
          </button>
          <a href="#files" className="rounded-full border border-black/20 px-4 py-3 text-xs font-black">
            View files
          </a>
        </div>
      </article>
    );
  }

  return (
    <article className="min-h-[520px] rounded-[1.5rem] bg-[var(--beauty-card)] p-3 shadow-xl">
      <div className={`grid h-full min-h-[496px] gap-3 ${pageLayoutClass(page.items.length)}`}>
        {page.items.map((item, index) => (
          <div key={item.path} className={`relative overflow-hidden rounded-[1.2rem] bg-black/10 ${page.items.length === 3 && index === 0 ? "row-span-2" : ""}`}>
            {previewImage(item) ? (
              <img src={previewImage(item)} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-56 items-center justify-center text-[var(--beauty-muted)]">
                <Video className="h-10 w-10" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-xs font-bold text-white">{item.name}</div>
          </div>
        ))}
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--beauty-border)] bg-[var(--beauty-soft)] p-4">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold text-[var(--beauty-muted)]">{label}</p>
    </div>
  );
}

function FileCard({ item, onPreview }: { item: PublicDriveItem; onPreview: (item: PublicDriveItem) => void }) {
  const Icon = iconFor(item);
  const canLightbox = isMedia(item);

  return (
    <article className="rounded-[1.25rem] border border-[var(--beauty-border)] bg-[var(--beauty-card)] p-4 shadow-xl shadow-black/5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#d7ff3f] text-black">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-black">{item.name}</h3>
          <p className="mt-1 text-xs text-[var(--beauty-muted)]">{typeLabel(item)} {item.size ? `- ${item.size}` : ""}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {canLightbox ? (
          <button type="button" onClick={() => onPreview(item)} className="rounded-full border border-[var(--beauty-border)] px-3 py-2 text-xs font-bold">
            Preview
          </button>
        ) : item.canPreview ? (
          <a href={item.previewUrl || item.originalUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-[var(--beauty-border)] px-3 py-2 text-xs font-bold">
            Preview
          </a>
        ) : null}
        {item.directDownloadUrl ? (
          <a href={item.directDownloadUrl} className="inline-flex items-center gap-2 rounded-full bg-[#d7ff3f] px-3 py-2 text-xs font-black text-black">
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        ) : null}
      </div>
    </article>
  );
}

function Lightbox({
  item,
  index,
  total,
  onClose,
  onNext,
  onPrevious,
}: {
  item: PublicDriveItem;
  index: number;
  total: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[180] flex flex-col bg-black/92 text-white backdrop-blur-xl">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{item.name}</p>
          <p className="mt-1 text-xs text-white/50">{index + 1} / {total}</p>
        </div>
        <div className="flex items-center gap-2">
          {item.directDownloadUrl ? (
            <a href={item.directDownloadUrl} className="rounded-full bg-[#d7ff3f] px-3 py-2 text-xs font-black text-black">
              Download
            </a>
          ) : null}
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 p-2">
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        <button type="button" onClick={onPrevious} className="absolute left-3 top-1/2 z-10 rounded-full border border-white/10 bg-black/50 p-3">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {item.type === "video" ? (
          <video src={mediaSource(item)} poster={item.thumbnailUrl || undefined} controls playsInline className="max-h-full max-w-full rounded-2xl bg-black" />
        ) : (
          <img src={mediaSource(item)} alt={item.name} className="max-h-full max-w-full rounded-2xl object-contain" />
        )}
        <button type="button" onClick={onNext} className="absolute right-3 top-1/2 z-10 rounded-full border border-white/10 bg-black/50 p-3">
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
