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

  return normalizeServerOrigin(window.localStorage.getItem(serverOriginStorageKey));
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

  return origin;
}

export function getServerOrigin() {
  return inferServerOrigin();
}

export function buildServerUrl(path) {
  const serverOrigin = getServerOrigin();
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${serverOrigin}${path}`;
}
