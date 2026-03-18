const fallbackLocalServerOrigin = "http://127.0.0.1:3001";
const configuredServerOrigin = import.meta.env?.VITE_SERVER_ORIGIN?.replace(/\/$/, "");

function inferServerOrigin() {
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

export const serverOrigin = inferServerOrigin();

export function buildServerUrl(path) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${serverOrigin}${path}`;
}
