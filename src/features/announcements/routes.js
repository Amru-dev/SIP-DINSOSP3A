import { randomUUID } from "node:crypto";
import { fail, text, date, optionalDate } from "../../shared/validation.js";

export async function handleAnnouncements({
  db,
  route,
  method,
  body,
  user,
  auth,
  send,
  now,
}) {
  const announcementMatch = route.match(
    /^\/api\/announcements(?:\/([\w-]+))?$/,
  );
  if (announcementMatch && ["POST", "PATCH", "DELETE"].includes(method)) {
    auth();
    if (user.role !== "admin")
      fail(403, "Hanya admin dapat mengelola pengumuman");
    const id = announcementMatch[1],
      allowedFields = [
        "umum",
        "sekretariat",
        "rehabsos",
        "linjamsos",
        "anak",
        "perempuan",
      ];
    if ((method === "POST" && id) || (method !== "POST" && !id))
      fail(404, "Pengumuman tidak ditemukan");
    if (method === "POST") {
      const publishDate = date(body.publish_date),
        expiresDate = optionalDate(body.expires_date),
        field = text(body.field, 30);
      if (!allowedFields.includes(field))
        fail(400, "Bidang penerbit tidak valid");
      if (expiresDate && expiresDate < publishDate)
        fail(400, "Batas tampil tidak boleh sebelum tanggal publikasi");
      const newId = randomUUID();
      await db.run(
        "INSERT INTO announcements (id,title,body,publish_date,expires_date,field,important,published) VALUES (?,?,?,?,?,?,?,?)",
        [
          newId,
          text(body.title, 180),
          text(body.body, 10000),
          publishDate,
          expiresDate,
          field,
          body.important === true ? 1 : 0,
          now,
        ],
      );
      return send({ id: newId }, 201);
    }
    const [old] = await db.all("SELECT * FROM announcements WHERE id=?", [id]);
    if (!old) fail(404, "Pengumuman tidak ditemukan");
    if (
      !Number.isSafeInteger(body.revision) ||
      body.revision !== Number(old.published)
    )
      fail(409, "Data telah berubah. Muat ulang daftar sebelum melanjutkan.");
    if (method === "DELETE") {
      if (
        !(await db.run("DELETE FROM announcements WHERE id=? AND published=?", [
          id,
          old.published,
        ]))
      )
        fail(409, "Data berubah. Muat ulang daftar.");
      return send({ ok: true, message: "Pengumuman dihapus." });
    }
    const publishDate = date(body.publish_date),
      expiresDate = optionalDate(body.expires_date),
      field = text(body.field, 30);
    if (!allowedFields.includes(field))
      fail(400, "Bidang penerbit tidak valid");
    if (expiresDate && expiresDate < publishDate)
      fail(400, "Batas tampil tidak boleh sebelum tanggal publikasi");
    const revision = Math.max(now, Number(old.published) + 1);
    if (
      !(await db.run(
        "UPDATE announcements SET title=?,body=?,publish_date=?,expires_date=?,field=?,important=?,published=? WHERE id=? AND published=?",
        [
          text(body.title, 180),
          text(body.body, 10000),
          publishDate,
          expiresDate,
          field,
          body.important === true ? 1 : 0,
          revision,
          id,
          old.published,
        ],
      ))
    )
      fail(409, "Data berubah. Muat ulang daftar.");
    return send({ ok: true, message: "Perubahan pengumuman tersimpan." });
  }

  return false;
}
