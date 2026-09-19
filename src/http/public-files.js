import { readFile } from "node:fs/promises";
import path from "node:path";
import { fail } from "../shared/validation.js";
export async function servePublicFile({
  db,
  route,
  method,
  res,
  url,
  publicFileDir,
}) {
  const publicFileMatch = route.match(/^\/api\/public-files\/([\w-]+)$/);
  if (publicFileMatch && method === "GET") {
    const [file] = await db.all("SELECT * FROM public_files WHERE id=?", [
      publicFileMatch[1],
    ]);
    if (!file) fail(404, "Berkas publik tidak ditemukan");
    res.setHeader("Content-Type", file.mime);
    if (file.kind === "document") {
      const disposition =
        url.searchParams.get("download") === "1" ? "attachment" : "inline";
      res.setHeader(
        "Content-Disposition",
        disposition + "; filename*=UTF-8''" + encodeURIComponent(file.name),
      );
    } else if (url.searchParams.get("download") === "1")
      res.setHeader(
        "Content-Disposition",
        "attachment; filename*=UTF-8''" + encodeURIComponent(file.name),
      );
    res.setHeader("Cache-Control", "no-store");
    return res.end(await readFile(path.join(publicFileDir, file.id)));
  }
  return false;
}
