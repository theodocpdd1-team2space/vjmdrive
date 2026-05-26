import path from "path";
import { HardDrive } from "lucide-react";
import { getBeautyShareBySlug, incrementBeautyShareView } from "@/lib/beauty-share-db";
import { listDriveFolder } from "@/lib/drive-list";
import { isDriveSubPath } from "@/lib/safe-path";
import { type DriveItem } from "@/components/drive/drive-ui";
import { BeautySharePublicClient } from "./beauty-share-public-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMedia(item: DriveItem) {
  return item.type === "image" || item.type === "video";
}

function chooseCoverItem(items: DriveItem[], rootPath: string, coverFilePath?: string) {
  if (coverFilePath && isDriveSubPath(rootPath, coverFilePath)) {
    const relativeCoverPath = path.posix.relative(rootPath, coverFilePath);
    const explicitCover = items.find((item) => item.path === relativeCoverPath);
    if (explicitCover) return explicitCover;
  }

  const firstLandscapeImage = items.find((item) => item.type === "image" && item.thumbnailUrl);
  if (firstLandscapeImage) return firstLandscapeImage;

  const firstImage = items.find((item) => item.type === "image");
  if (firstImage) return firstImage;

  const firstVideo = items.find((item) => item.type === "video" && item.thumbnailUrl);
  if (firstVideo) return firstVideo;

  return items.find(isMedia) || null;
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
  const coverItem = chooseCoverItem(items, share.rootPath, share.coverFilePath);

  return (
    <BeautySharePublicClient
      share={{
        slug: share.slug,
        title: share.title,
        subtitle: share.subtitle || "",
        clientName: share.clientName || "",
        theme: share.theme,
        layout: share.layout,
      }}
      items={items}
      coverItem={coverItem}
    />
  );
}
