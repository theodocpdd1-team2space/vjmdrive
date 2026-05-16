const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type DownloadLink = {
  directDownloadUrl: string | null;
  downloadMode: "direct" | "app";
};

function appDownloadUrl(relativePath: string) {
  return `/api/file?${new URLSearchParams({ path: relativePath, download: "1" }).toString()}`;
}

function encodePathSegments(relativePath: string) {
  return relativePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function createDownloadLink(relativePath: string, isDirectory: boolean): DownloadLink {
  if (isDirectory) {
    return {
      directDownloadUrl: null,
      downloadMode: "app",
    };
  }

  const configuredBaseUrl = process.env.DOWNLOAD_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    return {
      directDownloadUrl: appDownloadUrl(relativePath),
      downloadMode: "app",
    };
  }

  try {
    const url = new URL(configuredBaseUrl);
    const isLocal = LOCAL_HOSTS.has(url.hostname);
    const isAppFileEndpoint = url.pathname.replace(/\/$/, "") === "/api/file";

    if (isLocal || isAppFileEndpoint) {
      return {
        directDownloadUrl: appDownloadUrl(relativePath),
        downloadMode: "app",
      };
    }

    const encodedPath = encodePathSegments(relativePath);
    const base = configuredBaseUrl.replace(/\/+$/, "");

    return {
      directDownloadUrl: `${base}/${encodedPath}`,
      downloadMode: "direct",
    };
  } catch {
    return {
      directDownloadUrl: appDownloadUrl(relativePath),
      downloadMode: "app",
    };
  }
}
