# VJM Drive

Private asset drive untuk VJMRTIM. Next.js tetap menjadi UI, browser, preview, admin panel, dan fallback download route; file original tetap berada di HDD dan tidak pernah dimodifikasi oleh preview/cache system.

## Roles

- Admin login memakai `ADMIN_PASSWORD` dan cookie `vjm_drive_admin=yes`.
- Admin bisa browse, preview, download, upload, create folder, rename, move, soft-delete, request preview, create share link, dan melihat storage dashboard.
- Client masuk lewat `/share/[token]`.
- Client hanya bisa browse, preview, dan download sesuai share token.
- Share permission bisa `View only` atau `View + Download`.
- Share link MVP disimpan di `CACHE_ROOT/db/share-links.json`.

## UI / UX

- Admin dashboard berisi storage cards, HDD usage bar, preview stats, dan quick actions.
- My Drive punya grid, list, dan compact view.
- Grid/list memakai thumbnail dari `/api/thumbnail` jika tersedia.
- Video tidak autoplay di grid; video hanya dimainkan saat preview modal dibuka.
- Preview file memakai full-screen modal dengan download/copy actions.
- Mobile memakai full-screen preview modal dan selected action bar.

## Local Development

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Untuk local sample, gunakan `ADMIN_PASSWORD` dari `.env.local`.

Local env:

```txt
ADMIN_PASSWORD=admin123
DRIVE_PASSWORD=deprecated_or_client_password_optional
ASSET_ROOT=./public/sample-drive
CACHE_ROOT=./.vjm-drive-cache
PREVIEW_ROOT=./.vjm-drive-cache/previews
THUMBNAIL_ROOT=./.vjm-drive-cache/thumbnails
DOWNLOAD_BASE_URL=
```

`DOWNLOAD_BASE_URL` boleh kosong. Kalau kosong, original download memakai authenticated app route `/api/file?download=1`.

## Production Env

```txt
ADMIN_PASSWORD=change-me
DRIVE_PASSWORD=deprecated_or_client_password_optional
ASSET_ROOT=/mnt/hdd4tb/PublicShare
CACHE_ROOT=/mnt/nvme1tb/vjm-drive
PREVIEW_ROOT=/mnt/nvme1tb/vjm-drive/previews
THUMBNAIL_ROOT=/mnt/nvme1tb/vjm-drive/thumbnails
DOWNLOAD_BASE_URL=
```

Jika direct download domain sudah siap:

```txt
DOWNLOAD_BASE_URL=https://download.vjmrtim.my.id
```

## Preview Cache

Install ffmpeg di VPS:

```bash
sudo apt update && sudo apt install -y ffmpeg
```

Run scanner manual:

```bash
npm run preview:scan
```

Scanner membaca `ASSET_ROOT` secara recursive, mencari video `.mp4 .mov .m4v .webm .avi .mkv`, lalu menulis:

```txt
PREVIEW_ROOT/<hash>.mp4
THUMBNAIL_ROOT/<hash>.jpg
```

Hash dibuat dari relative path, file size, dan modified time. Preview tidak dibuat otomatis saat user membuka folder. Original files are never modified.

Preview command target:

```bash
ffmpeg -ss 00:00:05 -i input.mov -t 15 -vf "scale=1280:-2" -c:v libx264 -preset veryfast -crf 30 -pix_fmt yuv420p -an preview.mp4
```

Thumbnail command target:

```bash
ffmpeg -ss 00:00:05 -i input.mov -frames:v 1 -q:v 3 thumbnail.jpg
```

DXV/HAP bisa dipreview hanya kalau ffmpeg build di server bisa decode codec tersebut.

## Preview Queue

Admin bisa request preview dari UI. Queue disimpan di:

```txt
CACHE_ROOT/db/preview-queue.json
```

Status yang dipakai UI:

```txt
queued | processing | ready | failed
```

`POST /api/admin/preview/process-one` memproses satu queued item dengan ffmpeg, lalu menulis preview dan thumbnail ke cache root. Untuk batch besar, tetap gunakan `npm run preview:scan` atau worker terpisah agar server tidak berat.

Failed scanner log:

```txt
CACHE_ROOT/logs/preview-failed.json
```

## Admin File Management

Semua mutation API wajib admin auth dan memakai relative path dari `ASSET_ROOT`.

- `POST /api/admin/folder`
- `POST /api/admin/upload`
- `POST /api/admin/rename`
- `POST /api/admin/move`
- `DELETE /api/admin/delete`
- `POST /api/admin/share`
- `GET /api/admin/shares`
- `DELETE /api/admin/shares/[token]`

Delete bersifat soft-delete ke:

```txt
CACHE_ROOT/trash/YYYY-MM-DD/<original-relative-path>
```

Tidak ada permanent delete dari client UI.

## Storage Dashboard

`GET /api/admin/storage` membaca ringkasan disk dengan `df -k`, cache usage, count folder saat ini, preview ready/missing, dan failed preview count. UI tidak menampilkan absolute server path.

## Share Links

Share link format:

```json
{
  "token": "48-byte-hex-token",
  "name": "Client A",
  "rootPath": "2 TB/1-50/16/Part01",
  "canDownload": true,
  "expiresAt": null,
  "note": "Optional client note",
  "createdAt": "...",
  "createdBy": "admin"
}
```

Client route:

```txt
/share/[token]
```

Client breadcrumb dimulai dari shared root, bukan full `PublicShare`.

Admin bisa membuat share link dari current folder, selected folder, atau selected file. File-root share didukung; client akan melihat satu item sebagai shared root.

## Direct Download Architecture

- UI: `drive1.vjmrtim.my.id`
- Original file download future route: `download.vjmrtim.my.id`
- `drive1` boleh lewat Cloudflare Tunnel.
- `download` harus Cloudflare DNS only / grey cloud, bukan proxied.
- File original tetap di HDD: `/mnt/hdd4tb/PublicShare`.
- Preview/cache tetap di NVMe: `/mnt/nvme1tb/vjm-drive`.
- Next.js tidak boleh menjadi jalur utama download file besar ketika direct route sudah tersedia.

Saat ini `download.vjmrtim.my.id` belum siap karena router/port forwarding belum tersedia. Biarkan `DOWNLOAD_BASE_URL=` kosong agar download fallback lewat app route/Cloudflare.

Nginx direct-download read-only config untuk nanti:

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

## ZIP Folder Download

Folder ZIP tersedia sebagai advanced action melalui `/api/zip` atau `/api/share/[token]/zip`. ZIP distream langsung, tidak disimpan ke disk, dan tidak menjadi default untuk folder besar.

Warning UX:

```txt
Folder ZIP can be slow for huge folders. For very large assets, download files individually.
```

## Deploy VPS

```bash
git pull
npm install
npm run build
pm2 restart vjm-drive --update-env
```

## Verification

```bash
npm run lint
npm run build
```
