"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  Folder,
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

type MagazineTemplate = "cover" | "intro" | "full" | "duo" | "feature-grid" | "quad" | "download" | "back";

type MagazinePage = {
  template: MagazineTemplate;
  title: string;
  eyebrow?: string;
  items: PublicDriveItem[];
};

type Stats = {
  total: number;
  photos: number;
  videos: number;
  documents: number;
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

function shortName(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function buildMagazinePages(media: PublicDriveItem[], coverItem: PublicDriveItem | null, title: string): MagazinePage[] {
  const imageItems = media.filter((item) => item.type === "image");
  const orderedMedia = [...imageItems, ...media.filter((item) => item.type !== "image")];
  const pages: MagazinePage[] = [
    {
      template: "cover",
      title,
      eyebrow: "Private Digital Album",
      items: coverItem ? [coverItem] : orderedMedia.slice(0, 1),
    },
    {
      template: "intro",
      title: "Your files are ready.",
      eyebrow: "Delivery Notes",
      items: [],
    },
  ];

  let index = 0;
  const pattern: Array<{ template: MagazineTemplate; size: number; title: string; eyebrow: string }> = [
    { template: "full", size: 1, title: "Featured Memory", eyebrow: "Full Page" },
    { template: "duo", size: 2, title: "Quiet Details", eyebrow: "Two Image Story" },
    { template: "feature-grid", size: 4, title: "A Day in Frames", eyebrow: "Editorial Spread" },
    { template: "quad", size: 4, title: "Collected Moments", eyebrow: "Gallery Page" },
  ];

  while (index < orderedMedia.length) {
    const option = pattern[pages.length % pattern.length];
    const items = orderedMedia.slice(index, index + option.size);
    if (!items.length) break;

    pages.push({
      template: items.length === 1 ? "full" : items.length === 2 ? "duo" : items.length === 3 ? "feature-grid" : option.template,
      title: option.title,
      eyebrow: option.eyebrow,
      items,
    });
    index += items.length;
  }

  pages.push(
    {
      template: "download",
      title: "Download your files",
      eyebrow: "Complete Delivery",
      items: [],
    },
    {
      template: "back",
      title: "Thank you",
      eyebrow: "Your delivery is ready",
      items: coverItem ? [coverItem] : orderedMedia.slice(0, 1),
    },
  );

  return pages;
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
  const stats = useMemo<Stats>(
    () => ({
      total: items.length,
      photos: mediaItems.filter((item) => item.type === "image").length,
      videos: mediaItems.filter((item) => item.type === "video").length,
      documents: documents.length,
    }),
    [documents.length, items.length, mediaItems],
  );
  const [showWelcome, setShowWelcome] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [turning, setTurning] = useState<"next" | "prev" | null>(null);
  const magazineRef = useRef<HTMLDivElement | null>(null);

  const title = share.title || "Client Delivery";
  const subtitle = share.subtitle || "Preview, browse, and download your files in one place.";
  const clientName = share.clientName || title;
  const coverSrc = previewImage(coverItem || mediaItems.find((item) => item.type === "image") || mediaItems[0] || null);
  const lightboxItem = lightboxIndex === null ? null : mediaItems[lightboxIndex] || null;
  const downloadHref = items.find((item) => item.directDownloadUrl)?.directDownloadUrl || null;
  const magazinePages = useMemo(() => buildMagazinePages(mediaItems, coverItem, title), [coverItem, mediaItems, title]);
  const currentPage = magazinePages[Math.min(pageIndex, magazinePages.length - 1)];
  const nextPage = magazinePages[pageIndex + 1] || null;

  const themeClass =
    share.theme === "dark"
      ? "bg-[#11110f] text-[#f7f4ec] [--beauty-paper:#fbfaf5] [--beauty-ink:#171717] [--beauty-soft:#e8e3d8] [--beauty-muted:#6d675d] [--beauty-border:rgba(31,28,24,0.16)] [--beauty-table:#d8d3c9]"
      : "bg-[#ece8df] text-[#171717] [--beauty-paper:#fffdf7] [--beauty-ink:#171717] [--beauty-soft:#e6dfd2] [--beauty-muted:#6b6258] [--beauty-border:rgba(31,28,24,0.14)] [--beauty-table:#ded8cc]";

  useEffect(() => {
    const timer = window.setTimeout(() => setShowWelcome(false), 1150);
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
    const timer = window.setInterval(() => goPage("next"), 5200);
    return () => window.clearInterval(timer);
  }, [playing, pageIndex, lightboxIndex]);

  function goPage(direction: "next" | "prev") {
    setPlaying(false);
    setTurning(direction);
    window.setTimeout(() => setTurning(null), 440);
    setPageIndex((current) => {
      if (direction === "next") return Math.min(magazinePages.length - 1, current + 1);
      return Math.max(0, current - 1);
    });
  }

  function nextLightbox() {
    setLightboxIndex((current) => {
      if (current === null || mediaItems.length === 0) return current;
      return (current + 1) % mediaItems.length;
    });
  }

  function previousLightbox() {
    setLightboxIndex((current) => {
      if (current === null || mediaItems.length === 0) return current;
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

  function scrollToGallery() {
    document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main className={`min-h-screen overflow-hidden ${themeClass}`}>
      {showWelcome ? (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#d7ff3f] px-6 text-center text-black transition-opacity duration-500">
          <p className="text-sm font-black uppercase tracking-[0.28em]">Private Album</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight md:text-7xl">Hello, {clientName}</h1>
          <p className="mt-4 text-lg font-bold">File kamu sudah siap.</p>
        </div>
      ) : null}

      <AlbumCover
        title={title}
        subtitle={subtitle}
        coverSrc={coverSrc}
        downloadHref={downloadHref}
        onOpenAlbum={() => document.getElementById("album")?.scrollIntoView({ behavior: "smooth" })}
      />

      <section ref={magazineRef} id="album" className={`${fullscreen ? "fixed inset-0 z-[120] overflow-auto bg-[#d8d3c9] text-[#171717]" : ""}`}>
        <div className="bg-[var(--beauty-table)] px-4 py-14 md:px-8 md:py-20">
          <div className="mx-auto max-w-[1360px]">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#5c5a42]">Magazine Mode</p>
                <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight text-[#171717] md:text-5xl">Digital wedding book</h2>
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

            <div className="mx-auto max-w-[1320px]">
              <div
                className={`beauty-book-frame relative mx-auto transition duration-500 ${
                  turning === "next" ? "animate-[beautyPageNext_440ms_ease]" : turning === "prev" ? "animate-[beautyPagePrev_440ms_ease]" : ""
                }`}
              >
                <div className="beauty-book-spread">
                  <MagazinePageView
                    page={currentPage}
                    share={share}
                    stats={stats}
                    coverItem={coverItem}
                    downloadHref={downloadHref}
                    side="left"
                    onGallery={scrollToGallery}
                    onOpenLightbox={openLightbox}
                  />
                  {nextPage ? (
                    <div className="hidden md:block">
                      <MagazinePageView
                        page={nextPage}
                        share={share}
                        stats={stats}
                        coverItem={coverItem}
                        downloadHref={downloadHref}
                        side="right"
                        onGallery={scrollToGallery}
                        onOpenLightbox={openLightbox}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-center md:hidden">
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
          </div>
        </div>
      </section>

      <section id="gallery" className="bg-[#f8f6ef] px-4 py-16 text-[#171717] md:px-8 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#7a744b]">All Files</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Browse and download every file from this delivery.</h2>
            </div>
            <p className="text-sm font-bold text-[#6b6258]">{items.length} item ready</p>
          </div>

          {mediaItems.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {mediaItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => openLightbox(item)}
                  className="group overflow-hidden border border-black/10 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#e6dfd2]">
                    {previewImage(item) ? (
                      <img src={previewImage(item)} alt={item.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#6b6258]">
                        <Video className="h-10 w-10" />
                      </div>
                    )}
                    <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">{item.type}</span>
                  </div>
                  <div className="p-4">
                    <p className="truncate text-sm font-black">{item.name}</p>
                    <p className="mt-1 text-xs font-bold text-[#6b6258]">{item.size || typeLabel(item)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          <div id="files" className="mt-10 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <FileCard key={item.path} item={item} onPreview={openLightbox} />
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#11110f] px-4 py-7 text-center text-[11px] font-bold text-white/45 md:px-8">
        <div className="mx-auto max-w-7xl">
          <span>Delivered with driveOne by VJMRTIM · </span>
          <a href="https://solusivendor.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/75">
            Built by solusivendor.com
          </a>
        </div>
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

function AlbumCover({
  title,
  subtitle,
  coverSrc,
  downloadHref,
  onOpenAlbum,
}: {
  title: string;
  subtitle: string;
  coverSrc: string;
  downloadHref: string | null;
  onOpenAlbum: () => void;
}) {
  return (
    <section id="top" className="relative flex min-h-screen items-center overflow-hidden bg-[#15130f] px-4 py-24 text-white md:px-8">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,#11110f,#2b271e_46%,#11110f)]" />
      {coverSrc ? <img src={coverSrc} alt={title} className="absolute inset-0 h-full w-full object-cover opacity-[0.38]" /> : null}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(215,255,63,0.18),transparent_26%),linear-gradient(to_bottom,rgba(0,0,0,0.28),rgba(0,0,0,0.74))]" />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 md:grid-cols-[0.9fr_1.1fr]">
        <div className="order-2 md:order-1">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-[#d7ff3f]">Private Digital Album</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight md:text-8xl">{title}</h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-white/76 md:text-lg">{subtitle}</p>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-white/50">Your files are ready</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={onOpenAlbum} className="inline-flex items-center gap-2 rounded-full bg-[#d7ff3f] px-5 py-3 text-sm font-black text-black transition hover:bg-[#c8ef34]">
              Open Album
              <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#gallery" className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/20">
              View Files
            </a>
            {downloadHref ? (
              <a href={downloadHref} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/20">
                <Download className="h-4 w-4" />
                Download
              </a>
            ) : null}
          </div>
        </div>

        <div className="order-1 mx-auto w-full max-w-[460px] md:order-2">
          <div className="relative aspect-[4/5] bg-[#f7f3e8] p-4 text-[#171717] shadow-[0_34px_90px_rgba(0,0,0,0.48)]">
            <div className="absolute -right-4 top-5 h-[calc(100%-2.5rem)] w-4 bg-[#c9c0af] shadow-[inset_8px_0_16px_rgba(0,0,0,0.18)]" />
            <div className="absolute -bottom-4 left-6 h-4 w-[calc(100%-2.5rem)] bg-[#bdb4a5] blur-[1px]" />
            <div className="relative h-full overflow-hidden border border-black/10 bg-[#11110f]">
              {coverSrc ? <img src={coverSrc} alt={title} className="h-full w-full object-cover" /> : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/[0.82] via-black/[0.16] to-black/20" />
              <div className="absolute inset-x-0 bottom-0 p-7 text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d7ff3f]">Digital Wedding Book</p>
                <h2 className="mt-3 text-3xl font-black leading-none">{title}</h2>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-white/54">Private Digital Album</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
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
    <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-black/10 bg-white/60 p-1 text-[#171717] shadow-md shadow-black/10 backdrop-blur">
      <button type="button" aria-label="Previous page" onClick={onPrevious} disabled={pageIndex <= 0} className="rounded-full p-3 transition hover:bg-black/5 disabled:opacity-[0.35]">
        <ArrowLeft className="h-4 w-4" />
      </button>
      <span className="px-2 text-xs font-black uppercase tracking-[0.12em]">
        Page {pageIndex + 1} / {total}
      </span>
      <button type="button" aria-label="Next page" onClick={onNext} disabled={pageIndex >= total - 1} className="rounded-full p-3 transition hover:bg-black/5 disabled:opacity-[0.35]">
        <ArrowRight className="h-4 w-4" />
      </button>
      <button type="button" aria-label={playing ? "Pause album" : "Play album"} onClick={onPlay} className="rounded-full p-3 transition hover:bg-black/5">
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button type="button" aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={onFullscreen} className="rounded-full p-3 transition hover:bg-black/5">
        {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
      <a href="#gallery" className="rounded-full bg-[#d7ff3f] px-3.5 py-3 text-xs font-black text-black">
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
  downloadHref,
  side,
  onGallery,
  onOpenLightbox,
}: {
  page: MagazinePage;
  share: PublicBeautyShare;
  coverItem: PublicDriveItem | null;
  stats: Stats;
  downloadHref: string | null;
  side: "left" | "right";
  onGallery: () => void;
  onOpenLightbox: (item: PublicDriveItem) => void;
}) {
  const coverSrc = previewImage(coverItem || page.items[0] || null);
  const sideClass = side === "left" ? "beauty-book-page-left" : "beauty-book-page-right";

  if (page.template === "cover") {
    return (
      <article className={`beauty-book-page ${sideClass} relative overflow-hidden bg-[#11110f] p-0 text-white`}>
        {coverSrc ? <img src={coverSrc} alt={share.title} loading="eager" className="absolute inset-0 h-full w-full object-cover" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/[0.18]" />
        <div className="relative flex h-full min-h-[560px] flex-col justify-between p-8 md:min-h-[680px] md:p-12">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d7ff3f]">Digital Wedding Book</p>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.24em] text-white/56">Private Digital Album</p>
          </div>
          <div>
            <h3 className="max-w-xl text-4xl font-black leading-none tracking-tight md:text-6xl">{share.title}</h3>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/72">{share.subtitle || "Your files are ready."}</p>
          </div>
        </div>
      </article>
    );
  }

  if (page.template === "intro") {
    return (
      <article className={`beauty-book-page ${sideClass}`}>
        <div className="flex h-full min-h-[560px] flex-col justify-between md:min-h-[680px]">
          <div>
            <PageLabel>{page.eyebrow}</PageLabel>
            <h3 className="mt-8 max-w-md text-4xl font-black leading-none tracking-tight md:text-6xl">Your files are ready.</h3>
            <p className="mt-6 max-w-md text-base leading-8 text-[var(--beauty-muted)]">Preview, browse, and download your files in one place.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Total files" value={stats.total} />
            <Stat label="Photos" value={stats.photos} />
            <Stat label="Videos" value={stats.videos} />
            <Stat label="Documents" value={stats.documents} />
          </div>
        </div>
      </article>
    );
  }

  if (page.template === "download") {
    return (
      <article className={`beauty-book-page ${sideClass}`}>
        <div className="flex h-full min-h-[560px] flex-col justify-between md:min-h-[680px]">
          <div>
            <PageLabel>{page.eyebrow}</PageLabel>
            <h3 className="mt-8 max-w-md text-4xl font-black leading-none tracking-tight md:text-6xl">Download your files</h3>
            <p className="mt-6 max-w-md text-base leading-8 text-[var(--beauty-muted)]">The album preview is only the beginning. Browse the full delivery and save the files you need.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onGallery} className="rounded-full bg-[#171717] px-5 py-3 text-xs font-black text-white">
              View gallery
            </button>
            {downloadHref ? (
              <a href={downloadHref} className="inline-flex items-center gap-2 rounded-full bg-[#d7ff3f] px-5 py-3 text-xs font-black text-black">
                <Download className="h-4 w-4" />
                Download
              </a>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  if (page.template === "back") {
    return (
      <article className={`beauty-book-page ${sideClass} relative overflow-hidden bg-[#16140f] p-0 text-white`}>
        {coverSrc ? <img src={coverSrc} alt={share.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-[0.35]" /> : null}
        <div className="absolute inset-0 bg-black/[0.58]" />
        <div className="relative flex h-full min-h-[560px] flex-col items-center justify-center p-8 text-center md:min-h-[680px] md:p-12">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d7ff3f]">Thank you</p>
          <h3 className="mt-6 max-w-md text-4xl font-black leading-none md:text-6xl">Your delivery is ready to download</h3>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onGallery} className="rounded-full bg-white px-5 py-3 text-xs font-black text-[#171717]">
              View files
            </button>
            {downloadHref ? (
              <a href={downloadHref} className="inline-flex items-center gap-2 rounded-full bg-[#d7ff3f] px-5 py-3 text-xs font-black text-black">
                <Download className="h-4 w-4" />
                Download
              </a>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={`beauty-book-page ${sideClass}`}>
      <div className="flex h-full min-h-[560px] flex-col md:min-h-[680px]">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <PageLabel>{page.eyebrow}</PageLabel>
            <h3 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">{page.title}</h3>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--beauty-muted)]">{page.items.length} frame</p>
        </div>
        <MediaLayout page={page} onOpenLightbox={onOpenLightbox} />
      </div>
    </article>
  );
}

function MediaLayout({ page, onOpenLightbox }: { page: MagazinePage; onOpenLightbox: (item: PublicDriveItem) => void }) {
  if (page.template === "full") {
    return (
      <div className="min-h-0 flex-1">
        <AlbumImage item={page.items[0]} className="h-full min-h-[430px]" captionSize="large" onOpenLightbox={onOpenLightbox} />
      </div>
    );
  }

  if (page.template === "duo") {
    return (
      <div className="grid min-h-0 flex-1 gap-4">
        {page.items.map((item) => (
          <AlbumImage key={item.path} item={item} className="min-h-[210px]" onOpenLightbox={onOpenLightbox} />
        ))}
      </div>
    );
  }

  if (page.template === "feature-grid") {
    const [feature, ...rest] = page.items;
    return (
      <div className="grid min-h-0 flex-1 grid-rows-[1.55fr_1fr] gap-4">
        <AlbumImage item={feature} className="min-h-[280px]" captionSize="large" onOpenLightbox={onOpenLightbox} />
        <div className="grid grid-cols-3 gap-4">
          {rest.map((item) => (
            <AlbumImage key={item.path} item={item} className="min-h-[135px]" compact onOpenLightbox={onOpenLightbox} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
      {page.items.map((item) => (
        <AlbumImage key={item.path} item={item} className="min-h-[210px]" onOpenLightbox={onOpenLightbox} />
      ))}
    </div>
  );
}

function AlbumImage({
  item,
  className,
  captionSize = "normal",
  compact = false,
  onOpenLightbox,
}: {
  item: PublicDriveItem | undefined;
  className?: string;
  captionSize?: "normal" | "large";
  compact?: boolean;
  onOpenLightbox: (item: PublicDriveItem) => void;
}) {
  if (!item) return <div className={`bg-[#e6dfd2] ${className || ""}`} />;

  return (
    <button type="button" onClick={() => onOpenLightbox(item)} className={`group relative block overflow-hidden bg-[#e6dfd2] text-left ${className || ""}`}>
      {previewImage(item) ? (
        <img src={previewImage(item)} alt={item.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" />
      ) : (
        <div className="flex h-full min-h-40 w-full items-center justify-center text-[#6b6258]">
          <Video className="h-10 w-10" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/72 to-transparent p-3 text-white">
        <p className={`truncate font-bold ${captionSize === "large" ? "text-sm" : "text-xs"} ${compact ? "text-[11px]" : ""}`}>{shortName(item.name)}</p>
      </div>
    </button>
  );
}

function PageLabel({ children }: { children?: string }) {
  return <p className="text-xs font-black uppercase tracking-[0.24em] text-[#7a744b]">{children}</p>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-black/10 bg-[#f6f1e7] p-4">
      <p className="text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--beauty-muted)]">{label}</p>
    </div>
  );
}

function FileCard({ item, onPreview }: { item: PublicDriveItem; onPreview: (item: PublicDriveItem) => void }) {
  const Icon = iconFor(item);
  const canLightbox = isMedia(item);

  return (
    <article className="border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#d7ff3f] text-black">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-black">{item.name}</h3>
          <p className="mt-1 text-xs font-bold text-[#6b6258]">
            {typeLabel(item)} {item.size ? `- ${item.size}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {canLightbox ? (
          <button type="button" onClick={() => onPreview(item)} className="rounded-full border border-black/10 px-3 py-2 text-xs font-bold">
            Preview
          </button>
        ) : item.canPreview ? (
          <a href={item.previewUrl || item.originalUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-black/10 px-3 py-2 text-xs font-bold">
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
    <div className="fixed inset-0 z-[180] flex flex-col bg-black/[0.94] text-white backdrop-blur-xl">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{item.name}</p>
          <p className="mt-1 text-xs text-white/50">
            {index + 1} / {total}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {item.directDownloadUrl ? (
            <a href={item.directDownloadUrl} className="inline-flex items-center gap-2 rounded-full bg-[#d7ff3f] px-3 py-2 text-xs font-black text-black">
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          ) : null}
          <button type="button" aria-label="Close lightbox" onClick={onClose} className="rounded-full border border-white/10 p-2">
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        <button type="button" aria-label="Previous media" onClick={onPrevious} className="absolute left-3 top-1/2 z-10 rounded-full border border-white/10 bg-black/50 p-3">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {item.type === "video" ? (
          <video src={mediaSource(item)} poster={item.thumbnailUrl || undefined} controls playsInline className="max-h-full max-w-full bg-black" />
        ) : (
          <img src={mediaSource(item)} alt={item.name} className="max-h-full max-w-full object-contain" />
        )}
        <button type="button" aria-label="Next media" onClick={onNext} className="absolute right-3 top-1/2 z-10 rounded-full border border-white/10 bg-black/50 p-3">
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
