import { createApp } from "../server/app.js";

const app = createApp();

function normalizePathSegments(pathValue) {
  if (Array.isArray(pathValue)) {
    return pathValue.flatMap((value) => String(value).split("/").filter(Boolean));
  }

  if (typeof pathValue === "string") {
    return pathValue.split("/").filter(Boolean);
  }

  return [];
}

export default function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathSegments = normalizePathSegments(req.query?.path ?? url.searchParams.getAll("path"));

  url.searchParams.delete("path");
  req.url = `/api${pathSegments.length ? `/${pathSegments.join("/")}` : ""}${url.search}`;

  return app(req, res);
}
