# VJM Drive

Private asset drive MVP untuk VJMRTIM. Saat ini berjalan lokal, read-only, tanpa database, dan memakai satu master password dari `.env.local`.

## Local Development

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000), lalu login dengan:

```txt
admin123
```

Local environment default:

```txt
DRIVE_PASSWORD=admin123
ASSET_ROOT=./public/sample-drive
CACHE_ROOT=./.vjm-drive-cache
PREVIEW_ROOT=./.vjm-drive-cache/previews
THUMBNAIL_ROOT=./.vjm-drive-cache/thumbnails
```

Generated preview and thumbnail files are not served from `public`; they stay private and are streamed through authenticated API routes.

## Preview Cache

Video files that browsers can usually play (`mp4`, `webm`, `m4v`) use native preview. Unsupported or inconsistent codecs such as MOV/DXV/HAP/ProRes can use generated preview cache files later.

Production preview command target:

```bash
ffmpeg -ss 00:00:05 -i input.mov -t 15 -vf "scale=1280:-2" -c:v libx264 -preset veryfast -crf 30 -pix_fmt yuv420p -an preview.mp4
```

Production thumbnail command target:

```bash
ffmpeg -ss 00:00:05 -i input.mov -frames:v 1 -q:v 3 thumbnail.jpg
```

Local placeholder endpoint:

```bash
curl -b cookies.txt -H "Content-Type: application/json" \
  -d '{"path":"Video Samples/unsupported-codec-placeholder.mov"}' \
  http://localhost:3000/api/preview/mark-sample
```

If no sample MP4 exists in `ASSET_ROOT`, this creates a dummy job record only. The original asset is never modified.

## Production Note

Nanti di VPS `.env.local` diganti menjadi:

```txt
DRIVE_PASSWORD=<password asli>
ASSET_ROOT=/mnt/hdd4tb/PublicShare
CACHE_ROOT=/var/cache/vjm-drive
PREVIEW_ROOT=/var/cache/vjm-drive/previews
THUMBNAIL_ROOT=/var/cache/vjm-drive/thumbnails
```

Struktur API sudah dipisah agar ffmpeg preview generator bisa ditambahkan nanti tanpa mengubah UI utama.
