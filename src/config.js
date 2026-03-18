export const fallbackLocalServerOrigin = "http://127.0.0.1:3001";
export const serverOriginStorageKey = "chat-free-server-origin";
const configuredServerOrigin = import.meta.env?.VITE_SERVER_ORIGIN?.replace(/\/$/, "");

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

function getStoredServerOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  const normalizedValue = normalizeServerOrigin(window.localStorage.getItem(serverOriginStorageKey));
  if (!normalizedValue) {
    return "";
  }

  const { origin, protocol, hostname } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isFileProtocol = protocol === "file:";

  // Older builds may have saved the frontend URL itself as the backend on hosted pages.
  // Drop that stale value so the runtime health probe can re-check same-origin safely.
  if (!isLocalhost && !isFileProtocol && normalizedValue === origin) {
    window.localStorage.removeItem(serverOriginStorageKey);
    return "";
  }

  return normalizedValue;
}

function getServerOriginFromQuery() {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);
  return normalizeServerOrigin(params.get("server"));
}

export function setStoredServerOrigin(value) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedValue = normalizeServerOrigin(value);
  if (normalizedValue) {
    window.localStorage.setItem(serverOriginStorageKey, normalizedValue);
    return;
  }

  window.localStorage.removeItem(serverOriginStorageKey);
}

function inferServerOrigin() {
  const queryServerOrigin = getServerOriginFromQuery();
  if (queryServerOrigin) {
    setStoredServerOrigin(queryServerOrigin);
    return queryServerOrigin;
  }

  const storedServerOrigin = getStoredServerOrigin();
  if (storedServerOrigin) {
    return storedServerOrigin;
  }

  if (configuredServerOrigin) {
    return configuredServerOrigin;
  }

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

  // For hosted frontends, wait for an explicit backend URL or a runtime health probe.
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
