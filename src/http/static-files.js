import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fail } from "../shared/validation.js";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const assets = {
  "/": "index.html",
  "/app.js": "app.js",
  "/style.css": "style.css",
  "/struktur-organisasi.png": "assets/images/struktur-organisasi.png",
  "/logo.png": "assets/images/logo.png",
  "/kantor-dinas-sosial.jpg": "assets/images/kantor-dinas-sosial.jpg",
};
const vendors = {
  "/vendor/pdf.mjs": "pdf.mjs",
  "/vendor/pdf.worker.mjs": "pdf.worker.mjs",
};
export async function serveStatic({ route, method, res }) {
  if (method !== "GET") fail(404, "Halaman tidak ditemukan");
  let target, mime;
  if (vendors[route]) {
    target = path.join(root, "node_modules/pdfjs-dist/build", vendors[route]);
    mime = "text/javascript";
  } else {
    // Only front-end modules/styles and known image assets are publicly served.
    // The pattern excludes dot segments, secrets and arbitrary source files.
    const modulePath = /^\/(?:js|css)\/[a-zA-Z0-9_/-]+\.(?:js|css)$/.test(route)
      ? route.slice(1)
      : null;
    const imagePath =
      /^\/assets\/images\/(?:logo\.png|kantor-dinas-sosial\.jpg|struktur-organisasi\.png)$/.test(
        route,
      )
        ? route.slice(1)
        : null;
    const relative = assets[route] || modulePath || imagePath;
    if (!relative) fail(404, "Halaman tidak ditemukan");
    target = path.join(root, "public", relative);
    mime = relative.endsWith(".html")
      ? "text/html"
      : relative.endsWith(".js")
        ? "text/javascript"
        : relative.endsWith(".css")
          ? "text/css"
          : relative.endsWith(".png")
            ? "image/png"
            : "image/jpeg";
  }
  let bytes;
  try {
    bytes = await readFile(target);
  } catch (e) {
    if (e.code === "ENOENT" || e.code === "ENOTDIR")
      fail(404, "Berkas tidak ditemukan");
    throw e;
  }
  res.setHeader(
    "Content-Type",
    mime + (mime.startsWith("text/") ? "; charset=utf-8" : ""),
  );
  if (vendors[route]) res.setHeader("Cache-Control", "public, max-age=86400");
  res.end(bytes);
}
