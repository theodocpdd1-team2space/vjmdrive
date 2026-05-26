import Image from "next/image";
import { FileArchive, FileAudio, FileImage, FileText, FileVideo, Folder, HardDrive, Download } from "lucide-react";
import { getBeautyShareBySlug, incrementBeautyShareView } from "@/lib/beauty-share-db";
import { listDriveFolder } from "@/lib/drive-list";
import { type DriveItem } from "@/components/drive/drive-ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function iconFor(item: DriveItem) {
  if (item.type === "folder") return Folder;
  if (item.type === "video") return FileVideo;
  if (item.type === "audio") return FileAudio;
  if (item.type === "image") return FileImage;
  if (item.type === "archive") return FileArchive;
  return FileText;
}

function typeLabel(item: DriveItem) {
  if (item.type === "folder") return "Folder";
  if (item.extension) return item.extension.toUpperCase();
  return "File";
}

export default async function BeautySharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await getBeautyShareBySlug(slug).catch(() => null);

  if (!share || !share.isActive) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050608] px-4 text-white">
        <section className="max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#d7ff3f] text-black">
            <HardDrive className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-black">Beauty Share unavailable</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            This delivery link is inactive, expired, or no longer available.
          </p>
        </section>
      </main>
    );
  }

  await incrementBeautyShareView(share.id).catch(() => undefined);

  const listing = await listDriveFolder({
    path: "",
    scopeRootPath: share.rootPath,
    urlPrefix: `/api/b/${share.slug}`,
    canDownload: true,
  }).catch(() => ({ items: [] as DriveItem[] }));

  const items = listing.items as DriveItem[];
  const mediaItems = items
    .filter((item) => item.type === "image" || item.type === "video")
    .slice(0, 8);
  const themeClass =
    share.theme === "dark"
      ? "bg-[#050608] text-white [--beauty-card:#111318] [--beauty-muted:#a1a1aa] [--beauty-border:rgba(255,255,255,0.12)]"
      : "bg-[#f4f4ef] text-black [--beauty-card:#ffffff] [--beauty-muted:#52525b] [--beauty-border:rgba(0,0,0,0.10)]";

  return (
    <main className={`min-h-screen ${themeClass}`}>
      <section className="mx-auto flex min-h-[76vh] max-w-6xl flex-col justify-center px-4 py-16 md:px-6">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full border border-[var(--beauty-border)] bg-[var(--beauty-card)] px-3 py-1 text-xs font-black uppercase tracking-[0.18em]">
            Delivered with driveOne
          </span>
          <h1 className="mt-6 text-5xl font-black tracking-tight md:text-7xl">{share.title}</h1>
          {share.subtitle ? (
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--beauty-muted)]">{share.subtitle}</p>
          ) : null}
          {share.clientName ? (
            <p className="mt-4 text-sm font-bold text-[var(--beauty-muted)]">{share.clientName}</p>
          ) : null}
          <a
            href="#files"
            className="mt-8 inline-flex items-center rounded-full bg-[#d7ff3f] px-5 py-3 text-sm font-black text-black transition hover:bg-[#c8ef34]"
          >
            View files
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-6">
        {mediaItems.length ? (
          <div className="grid auto-rows-[160px] gap-3 md:grid-cols-4 md:auto-rows-[210px]">
            {mediaItems.map((item, index) => {
              const Icon = iconFor(item);
              const src = item.thumbnailUrl || (item.type === "image" ? item.originalUrl : null);
              return (
                <a
                  key={item.path}
                  href={item.previewUrl || item.originalUrl}
                  className={`relative overflow-hidden rounded-lg border border-[var(--beauty-border)] bg-[var(--beauty-card)] ${
                    index === 0 || index === 3 ? "md:col-span-2 md:row-span-2" : ""
                  }`}
                >
                  {src ? (
                    <Image src={src} alt={item.name} fill unoptimized sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[var(--beauty-muted)]">
                      <Icon className="h-10 w-10" />
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-sm font-bold text-white">
                    {item.name}
                  </span>
                </a>
              );
            })}
          </div>
        ) : null}
      </section>

      <section id="files" className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">Files</h2>
            <p className="mt-1 text-sm text-[var(--beauty-muted)]">{items.length} item ready for delivery</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const Icon = iconFor(item);
            return (
              <article key={item.path} className="rounded-lg border border-[var(--beauty-border)] bg-[var(--beauty-card)] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#d7ff3f] text-black">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-black">{item.name}</h3>
                    <p className="mt-1 text-xs text-[var(--beauty-muted)]">
                      {typeLabel(item)} {item.size ? `- ${item.size}` : ""}
                    </p>
                  </div>
                </div>

                {item.type !== "folder" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.canPreview ? (
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
                ) : null}
              </article>
            );
          })}
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-[var(--beauty-border)] bg-[var(--beauty-card)] p-8 text-center text-[var(--beauty-muted)]">
            No files are available in this delivery folder.
          </div>
        ) : null}
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm font-bold text-[var(--beauty-muted)] md:px-6">
        Delivered with driveOne by VJMRTIM
      </footer>
    </main>
  );
}
