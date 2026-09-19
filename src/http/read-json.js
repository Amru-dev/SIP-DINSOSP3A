import { fail } from "../shared/validation.js";
export async function readJson(req, { method, origin, route }) {
  let body = {};
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    if (req.headers.origin !== origin) fail(403, "Origin tidak diizinkan");
    if (!String(req.headers["content-type"]).startsWith("application/json"))
      fail(415, "Gunakan application/json");
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (
        size >
        (/^\/api\/activities(?:\/[\w-]+)?$/.test(route) ? 29000000 : 7500000)
      )
        fail(413, "Berkas maksimal 5 MB");
      chunks.push(chunk);
    }
    try {
      body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    } catch {
      fail(400, "JSON tidak valid");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      fail(400, "Data tidak valid");
  }
  return body;
}
