const configuredServerOrigin = import.meta.env?.VITE_SERVER_ORIGIN?.replace(/\/$/, "");

function inferServerOrigin() {
  if (configuredServerOrigin) {
    return configuredServerOrigin;
  }

  if (typeof window === "undefined") {
    return "http://localhost:3001";
  }

  const { origin, protocol, hostname, port } = window.location;

  if (port && port !== "3001") {
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
