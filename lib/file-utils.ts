import path from "path";

export type DriveItemType =
  | "folder"
  | "image"
  | "video"
  | "pdf"
  | "text"
  | "archive"
  | "file";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "avi", "mkv"]);
const TEXT_EXTENSIONS = new Set(["txt", "json", "md", "log"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z"]);

export function getExtension(fileName: string) {
  return path.extname(fileName).replace(/^\./, "").toLowerCase();
}

export function getDriveItemType(fileName: string, isDirectory: boolean): DriveItemType {
  if (isDirectory) {
    return "folder";
  }

  const extension = getExtension(fileName);

  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (extension === "pdf") return "pdf";
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  if (ARCHIVE_EXTENSIONS.has(extension)) return "archive";

  return "file";
}

export function canPreviewType(type: DriveItemType) {
  return type === "image" || type === "video" || type === "pdf" || type === "text";
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function getContentType(fileName: string) {
  const extension = getExtension(fileName);

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    case "m4v":
      return "video/x-m4v";
    case "avi":
      return "video/x-msvideo";
    case "mkv":
      return "video/x-matroska";
    case "pdf":
      return "application/pdf";
    case "json":
      return "application/json; charset=utf-8";
    case "md":
      return "text/markdown; charset=utf-8";
    case "txt":
    case "log":
      return "text/plain; charset=utf-8";
    case "zip":
      return "application/zip";
    case "rar":
      return "application/vnd.rar";
    case "7z":
      return "application/x-7z-compressed";
    default:
      return "application/octet-stream";
  }
}

export function contentDisposition(fileName: string, download: boolean) {
  const disposition = download ? "attachment" : "inline";
  const fallbackName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");

  return `${disposition}; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(
    fileName
  )}`;
}
