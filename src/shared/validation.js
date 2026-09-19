export const fail = (status, message) => {
  throw Object.assign(Error(message), { status });
};
export const text = (x, max = 200) =>
  typeof x === "string" && x.trim().length > 0 && x.length <= max
    ? x.trim()
    : fail(400, "Isian wajib kosong atau terlalu panjang");
export const date = (x) => {
  if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x))
    fail(400, "Tanggal tidak valid");
  const d = new Date(x + "T00:00:00Z");
  if (Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== x)
    fail(400, "Tanggal tidak valid");
  return x;
};
export const optionalDate = (x) => (x == null || x === "" ? null : date(x));
export function upload(body, kind) {
  if (!body || typeof body !== "object")
    fail(400, "Foto atau file wajib diunggah");
  if (
    typeof body.data !== "string" ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(body.data)
  )
    fail(400, "Berkas tidak valid");
  const bytes = Buffer.from(body.data, "base64");
  if (!bytes.length || bytes.length > 5 * 1024 * 1024)
    fail(413, "Ukuran berkas 1 byte–5 MB");
  let mime;
  if (bytes.subarray(0, 5).toString() === "%PDF-") mime = "application/pdf";
  else if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    mime = "image/png";
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    mime = "image/jpeg";
  else fail(415, "Format berkas tidak didukung");
  if (kind === "image" && !mime.startsWith("image/"))
    fail(415, "Foto harus JPG atau PNG");
  if (kind === "document" && mime !== "application/pdf")
    fail(415, "Dokumen harus PDF");
  return { bytes, mime, name: text(body.name, 180).replace(/[\r\n"]/g, "_") };
}
