# VJM Drive

Private asset drive untuk VJMRTIM. Next.js tetap menjadi UI, browser, preview, admin panel, dan fallback download route; file original tetap berada di HDD dan tidak pernah dimodifikasi oleh preview/cache system.

## Roles

- Admin login memakai `ADMIN_PASSWORD` dan cookie `vjm_drive_admin=yes`.
- Admin bisa browse, preview, download, upload, create folder, rename, move, soft-delete, request preview, create share link, dan melihat storage dashboard.
- Client masuk lewat `/share/[token]`.
- Client hanya bisa browse, preview, dan download sesuai share token.
- Share permission bisa `View only` atau `View + Download`.
- Share visibility bisa `PUBLIC`, `PUBLIC_LOGIN`, atau `PRIVATE`.
- Share link MVP disimpan di `CACHE_ROOT/db/shares.json` dengan fallback baca legacy `CACHE_ROOT/db/share-links.json`.

## UI / UX

- Admin dashboard berisi storage cards, HDD usage bar, preview stats, dan quick actions.
- My Drive punya grid, list, dan compact view.
- Grid/list memakai thumbnail dari `/api/thumbnail` jika tersedia.
- Video tidak autoplay di grid; video hanya dimainkan saat preview modal dibuka.
- Preview file memakai full-screen modal dengan share/download/copy actions.
- Video preview selalu memakai cached `/api/preview` lebih dulu; original video besar hanya dipakai sebagai native fallback jika tidak ada cache.
- Upload memakai modal dengan multiple file picker, selected file list, dan loading state.
- Admin destructive actions memakai confirmation modal dan soft-delete.
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

Scanner membaca `ASSET_ROOT` secara recursive, mencari video `.mp4 .mov .m4v .webm .avi .mkv .dxv`, lalu menulis:

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
  "visibility": "PUBLIC_LOGIN",
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
Share modal mendukung client name, View only / View + Download, expiry Never / 1 day / 7 days / 30 days / custom, note, Copy, dan Open.

Visibility behavior:

- `PUBLIC`: guest bisa membuka `/share/[token]` tanpa login. `allowedEmails` tetap disimpan tetapi tidak dipakai untuk guest access.
- `PUBLIC_LOGIN`: harus login. Jika `allowedEmails` berisi email, hanya email tersebut yang bisa akses.
- `PRIVATE`: tidak bisa dibuka publik; hanya admin atau owner share.

Existing legacy share dengan visibility lama `PUBLIC` tanpa marker access baru dibaca sebagai `PUBLIC_LOGIN`, supaya link lama tidak tiba-tiba menjadi guest-public. Tombol `Make Public` di admin akan menyimpan mode baru `PUBLIC`.

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

## Client Select

Client Select adalah modul terpisah dari Share Link dan Beauty Share. Metadata disimpan di:

```txt
CACHE_ROOT/db/selection-links.json
CACHE_ROOT/db/selection-submissions.json
```

Create link:

- Buka `/client-select`, isi project name, client info opsional, root folder path, max selected photos, dan allow original download.
- Atau buka My Drive, pilih/current folder, klik Share, lalu pilih Client Select.
- Public link memakai `/select/[token]` dan bisa dibuka tanpa login.

Smoke test public link:

- Buka link `/select/[token]` di incognito/private browser.
- Pilih beberapa foto, isi global note, lalu submit.
- Setelah submit, public page harus menampilkan “Selection submitted. Thank you.”
- Bad token atau disabled link harus menampilkan unavailable.

Export:

- Owner/admin buka `/client-select` atau `/admin/client-select`.
- Klik Detail pada link yang sudah submitted.
- Export TXT berisi filename per baris.
- Export CSV memakai columns `filename,path,note`; note per foto akan ikut di kolom `note`.
- Export API hanya bisa diakses owner/admin.

MVP 2 behavior:

- Client wajib mengisi client name dan client email sebelum submit.
- Client bisa menulis note per foto untuk foto yang dipilih.
- Owner bisa set deadline (`expiresAt`). Public route dan public API akan unavailable setelah deadline, tetapi owner/admin detail tetap bisa dibuka.
- `allowEditAfterSubmit=false` mengunci public form setelah submit.
- `allowEditAfterSubmit=true` membuat client bisa update selection dan note sampai deadline; submission existing di-update, bukan dibuat duplikat.
- Owner/admin bisa Download Selected ZIP dari detail Client Select.
- Public selected ZIP tersedia di `/api/select/[token]/download-selected-zip` hanya jika `allowOriginalDownload=true`.
- Owner/admin bisa Create Selected Folder; file terpilih dicopy ke folder `Selected by Client - [Project Name]` di dalam root folder Client Select. Original file tidak dipindah atau dihapus.
- Subscription guard dasar saat create link baru: FREE 1 active link, LITE/PERSONAL 3 active links, BASIC/PRO/BUSINESS/CUSTOM/Admin unlimited. Existing links tidak diblokir.

Email notification:

- Saat client submit/update selection, sistem mencoba mengirim email ke owner.
- Existing sender memakai Resend:

```txt
RESEND_API_KEY=
RESEND_FROM="VJM Drive <no-reply@example.com>"
ADMIN_EMAIL=
APP_URL=https://drive.example.com
```

- Jika env email belum lengkap atau owner email tidak ditemukan, submit tetap sukses.
- Hasil notifikasi disimpan di submission:

```txt
emailSentAt
emailError
```

Selected ZIP:

- ZIP hanya berisi selected files dan tidak menampilkan absolute server path.
- Missing files akan diskip dan ditulis ke `manifest.txt` di dalam ZIP.
- Nama ZIP: `[project-slug]-selected-files.zip`.
- Jika filename konflik di ZIP, sistem memakai suffix `-copy-N`.

Selected folder copy:

- Endpoint owner/admin hanya melakukan copy, tidak move.
- Hasil operation disimpan di Client Select link:

```txt
selectedFolderPath
selectedFolderCopiedCount
selectedFolderSkippedCount
selectedFolderErrors
selectedFolderCreatedAt
```

Backup metadata sebelum deploy atau perubahan besar:

```bash
mkdir -p .vjm-drive-cache/db/backups/before-client-select-$(date +%Y%m%d-%H%M%S)
cp -a .vjm-drive-cache/db/*.json .vjm-drive-cache/db/backups/before-client-select-$(date +%Y%m%d-%H%M%S)/ 2>/dev/null || true
```

Deploy checklist:

- Jangan reset database/cache.
- Jangan rewrite `shares.json`, users metadata, preview queue/jobs, atau Beauty Share metadata.
- Jalankan `npm run build`.
- Test `/share/[token]`, `/b/[slug]`, `/client-select`, dan `/select/[token]` setelah deploy.

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
