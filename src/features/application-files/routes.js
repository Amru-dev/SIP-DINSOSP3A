import { readFile } from "node:fs/promises";
import path from "node:path";

import { fail } from "../../shared/validation.js";

export async function handleApplicationFiles({
  db,
  route,
  method,
  user,
  auth,
  res,
  url,
  fileDir,
  findApp,
}) {
  const fileMatch = route.match(/^\/api\/files\/([\w-]+)$/);
  if (fileMatch && method === "GET") {
    auth();
    const [file] = await db.all("SELECT * FROM files WHERE id=?", [
      fileMatch[1],
    ]);
    if (!file) fail(404, "Berkas tidak ditemukan");
    await findApp(file.application_id, user);
    res.setHeader("Content-Type", file.mime);
    const disposition =
      url.searchParams.get("download") === "1" ? "attachment" : "inline";
    res.setHeader(
      "Content-Disposition",
      disposition + "; filename*=UTF-8''" + encodeURIComponent(file.name),
    );
    return res.end(await readFile(path.join(fileDir, file.id)));
  }

  return false;
}
