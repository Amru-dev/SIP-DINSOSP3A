import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fail, text, date, upload } from "../../shared/validation.js";

export async function handlePublicContent({
  db,
  route,
  method,
  body,
  user,
  auth,
  send,
  now,
  publicFileDir,
}) {
  const contentMatch = route.match(
    /^\/api\/(employees|public-documents)\/([\w-]+)$/,
  );
  if (contentMatch && ["PATCH", "DELETE"].includes(method)) {
    auth();
    if (user.role !== "admin")
      fail(403, "Hanya admin dapat mengedit atau menghapus informasi publik");
    const type = contentMatch[1],
      id = contentMatch[2];
    // SQL identifiers come exclusively from this fixed map.
    const table = {
      employees: "employees",
      "public-documents": "public_documents",
    }[type];
    const fileColumn = type === "public-documents" ? "file_id" : "photo_id";
    const fileInput = type === "public-documents" ? "file" : "photo";
    const [old] = await db.all("SELECT * FROM " + table + " WHERE id=?", [id]);
    if (!old) fail(404, "Informasi tidak ditemukan");
    if (
      !Number.isSafeInteger(body.revision) ||
      body.revision !== Number(old.published)
    )
      fail(409, "Data telah berubah. Muat ulang daftar sebelum melanjutkan.");
    let replacement = null,
      newFileId = null,
      removedFileId = null;
    const next = { ...old, ...body };
    const values = [],
      columns = [];
    if (method === "PATCH") {
      columns.push("name");
      values.push(text(next.name, 180));
      if (type === "employees") {
        const nip = text(next.nip, 18);
        if (!/^\d{18}$/.test(nip)) fail(400, "NIP harus tepat 18 digit");
        if (
          !["PNS", "PPPK"].includes(next.employment_type) ||
          ![
            "sekretariat",
            "rehabsos",
            "linjamsos",
            "anak",
            "perempuan",
          ].includes(next.placement)
        )
          fail(400, "Jenis pegawai atau penempatan tidak valid");
        columns.push("nip", "position", "employment_type", "placement");
        values.push(
          nip,
          text(next.position, 180),
          next.employment_type,
          next.placement,
        );
      } else {
        const year = Number(next.year);
        if (!Number.isInteger(year) || year < 2000 || year > 2100)
          fail(400, "Tahun tidak valid");
        columns.push("year", "publish_date");
        values.push(year, date(next.publish_date));
      }
      if (Object.hasOwn(body, fileInput)) {
        if (type === "employees" && body.photo === null) {
          columns.push(fileColumn);
          values.push("");
          removedFileId = old[fileColumn];
        } else {
          replacement = upload(
            body[fileInput],
            type === "public-documents" ? "document" : "image",
          );
          newFileId = randomUUID();
          columns.push(fileColumn);
          values.push(newFileId);
          await writeFile(
            path.join(publicFileDir, newFileId),
            replacement.bytes,
            { mode: 0o600, flag: "wx" },
          );
        }
      }
      columns.push("published");
      values.push(Math.max(now, Number(old.published) + 1));
    }
    try {
      await db.transaction(async (tx) => {
        if (method === "DELETE") {
          if (
            !(await tx.run(
              "DELETE FROM " + table + " WHERE id=? AND published=?",
              [id, old.published],
            ))
          )
            fail(409, "Data berubah. Muat ulang daftar.");
          removedFileId = old[fileColumn];
        } else {
          if (
            !(await tx.run(
              "UPDATE " +
                table +
                " SET " +
                columns.map((c) => c + "=?").join(",") +
                " WHERE id=? AND published=?",
              [...values, id, old.published],
            ))
          )
            fail(409, "Data berubah. Muat ulang daftar.");
          if (replacement) {
            await tx.run(
              "INSERT INTO public_files (id,name,mime,bytes,kind) VALUES (?,?,?,?,?)",
              [
                newFileId,
                replacement.name,
                replacement.mime,
                replacement.bytes.length,
                type === "public-documents" ? "document" : "image",
              ],
            );
            removedFileId = old[fileColumn];
          }
        }
        if (removedFileId)
          await tx.run("DELETE FROM public_files WHERE id=?", [removedFileId]);
      });
    } catch (e) {
      if (newFileId)
        await unlink(path.join(publicFileDir, newFileId)).catch(() => {});
      if (
        e.errcode === 2067 ||
        e.code === "SQLITE_CONSTRAINT_UNIQUE" ||
        e.code === "ER_DUP_ENTRY"
      )
        fail(409, "NIP sudah terdaftar");
      throw e;
    }
    if (removedFileId)
      await unlink(path.join(publicFileDir, removedFileId)).catch((e) => {
        if (e.code !== "ENOENT")
          console.error("Public file cleanup failed:", e.code);
      });
    return send({
      ok: true,
      message:
        method === "DELETE"
          ? "Informasi dan berkas terkait dihapus."
          : "Perubahan tersimpan.",
    });
  }
  if (route === "/api/employees" && method === "POST") {
    auth();
    if (user.role !== "admin") fail(403, "Hanya admin");
    const allowedPlacement = [
      "sekretariat",
      "rehabsos",
      "linjamsos",
      "anak",
      "perempuan",
    ];
    const employment = text(body.employment_type, 10),
      placement = text(body.placement, 30);
    if (
      !["PNS", "PPPK"].includes(employment) ||
      !allowedPlacement.includes(placement)
    )
      fail(400, "Jenis pegawai atau penempatan tidak valid");
    const nip = text(body.nip, 18);
    if (!/^\d{18}$/.test(nip)) fail(400, "NIP harus tepat 18 digit");
    const file = body.photo ? upload(body.photo, "image") : null,
      fileId = file ? randomUUID() : "",
      id = randomUUID();
    if (file)
      await writeFile(path.join(publicFileDir, fileId), file.bytes, {
        mode: 0o600,
        flag: "wx",
      });
    try {
      await db.transaction(async (tx) => {
        if (file)
          await tx.run(
            "INSERT INTO public_files (id,name,mime,bytes,kind) VALUES (?,?,?,?,?)",
            [fileId, file.name, file.mime, file.bytes.length, "image"],
          );
        await tx.run(
          "INSERT INTO employees (id,photo_id,name,nip,position,employment_type,placement,published) VALUES (?,?,?,?,?,?,?,?)",
          [
            id,
            fileId,
            text(body.name, 180),
            nip,
            text(body.position, 180),
            employment,
            placement,
            now,
          ],
        );
      });
    } catch (e) {
      if (fileId)
        await unlink(path.join(publicFileDir, fileId)).catch(() => {});
      if (
        e.errcode === 2067 ||
        e.code === "SQLITE_CONSTRAINT_UNIQUE" ||
        e.code === "ER_DUP_ENTRY"
      )
        fail(409, "NIP sudah terdaftar");
      throw e;
    }
    return send({ id }, 201);
  }
  if (route === "/api/public-documents" && method === "POST") {
    auth();
    if (user.role !== "admin") fail(403, "Hanya admin");
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100)
      fail(400, "Tahun tidak valid");
    const file = upload(body.file, "document"),
      fileId = randomUUID(),
      id = randomUUID();
    if (file)
      await writeFile(path.join(publicFileDir, fileId), file.bytes, {
        mode: 0o600,
        flag: "wx",
      });
    try {
      await db.transaction(async (tx) => {
        if (file)
          await tx.run(
            "INSERT INTO public_files (id,name,mime,bytes,kind) VALUES (?,?,?,?,?)",
            [fileId, file.name, file.mime, file.bytes.length, "document"],
          );
        await tx.run(
          "INSERT INTO public_documents (id,file_id,name,year,publish_date,published) VALUES (?,?,?,?,?,?)",
          [
            id,
            fileId,
            text(body.name, 180),
            year,
            date(body.publish_date),
            now,
          ],
        );
      });
    } catch (e) {
      if (fileId)
        await unlink(path.join(publicFileDir, fileId)).catch(() => {});
      throw e;
    }
    return send({ id }, 201);
  }

  return false;
}
