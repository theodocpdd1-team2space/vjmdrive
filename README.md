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
DOWNLOAD_BASE_URL=http://localhost:3000/api/file
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
CACHE_ROOT=/mnt/nvme1tb/vjm-drive
PREVIEW_ROOT=/mnt/nvme1tb/vjm-drive/previews
THUMBNAIL_ROOT=/mnt/nvme1tb/vjm-drive/thumbnails
DOWNLOAD_BASE_URL=https://download.vjmrtim.my.id
```

Struktur API sudah dipisah agar ffmpeg preview generator bisa ditambahkan nanti tanpa mengubah UI utama.

## Direct Download Architecture

- UI and browsing: `drive1.vjmrtim.my.id`
- Original file download: `download.vjmrtim.my.id`
- `drive1` may run through Cloudflare Tunnel.
- `download` should be Cloudflare DNS only / grey cloud, not proxied.
- `download` points directly to the server for speed.
- Original files stay on HDD at `/mnt/hdd4tb/PublicShare`.
- Preview/cache files stay on NVMe at `/mnt/nvme1tb/vjm-drive`.
- Next.js should not be the main path for large original downloads.

Production direct-download env:

```txt
DOWNLOAD_BASE_URL=https://download.vjmrtim.my.id
```

Example Nginx config for read-only direct downloads:

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name download.vjmrtim.my.id;

    root /mnt/hdd4tb/PublicShare;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;

    autoindex on;
    autoindex_exact_size off;
    autoindex_localtime on;

    location / {
        limit_except GET HEAD {
            deny all;
        }

        try_files $uri $uri/ =404;
    }
}
```

With `DOWNLOAD_BASE_URL` set to the production domain, `/api/list` emits encoded direct links such as:

```txt
https://download.vjmrtim.my.id/2%20TB/1-50/Video.mov
```

In local development, `DOWNLOAD_BASE_URL=http://localhost:3000/api/file` intentionally falls back to the authenticated app download route.
