export const fallbackLocalServerOrigin = "http://127.0.0.1:3001";

export function normalizeServerOrigin(value) {
  const normalizedValue = String(value || "").trim().replace(/\/$/, "");
  if (!normalizedValue) {
    return "";
  }

  try {
    const url = new URL(normalizedValue);
    return url.origin;
  } catch {
    return "";
  }
}

function inferServerOrigin() {
  if (typeof window === "undefined") {
    return fallbackLocalServerOrigin;
  }

  const { origin, protocol, hostname, port } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isFileProtocol = protocol === "file:";
  const isGitHubPages = hostname.endsWith("github.io");

  if (isFileProtocol || isGitHubPages) {
    return fallbackLocalServerOrigin;
  }

  if (isLocalhost && port !== "3001") {
    return `${protocol}//${hostname}:3001`;
  }

  if (isLocalhost) {
    return origin;
  }

  // Hosted frontends either expose /api on the same origin or use one shared backend from env.
  return "";
}

export function getServerOrigin() {
  return inferServerOrigin();
}

export function buildServerUrl(path) {
  const serverOrigin = getServerOrigin();
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  if (!serverOrigin) {
    return "";
  }

  return `${serverOrigin}${path}`;
}
