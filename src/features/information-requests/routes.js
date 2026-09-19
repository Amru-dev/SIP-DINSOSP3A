import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const destinations = [
  "sekretariat",
  "rehabsos",
  "linjamsos",
  "anak",
  "perempuan",
];
const roles = ["admin", "masyarakat", "operator", "kabid", "sekretaris"];
export function informationActions(user, row) {
  if (user.role === "admin")
    return row.status === "diajukan"
      ? ["diteruskan"]
      : row.status === "disetujui_bidang"
        ? ["selesai"]
        : [];
  if (user.field !== row.field) return [];
  const worker = user.role === "operator";
  const approver =
    row.field === "sekretariat"
      ? user.role === "sekretaris"
      : user.role === "kabid";
  if (worker && ["diteruskan", "perbaikan_bidang"].includes(row.status))
    return ["menunggu_persetujuan"];
  if (approver && row.status === "menunggu_persetujuan")
    return ["disetujui_bidang", "perbaikan_bidang"];
  return [];
}
function canRead(user, row) {
  if (user.role === "masyarakat") return row.owner_id === user.id;
  if (user.role === "admin") return true;
  if (row.status === "diajukan" || user.field !== row.field) return false;
  return row.field === "sekretariat"
    ? ["operator", "sekretaris"].includes(user.role)
    : ["operator", "kabid"].includes(user.role);
}
function publicRow(row, user) {
  if (user.role !== "masyarakat")
    return { ...row, allowed_actions: informationActions(user, row) };
  return {
    ...row,
    status: ["diajukan", "selesai"].includes(row.status)
      ? row.status
      : "diproses",
    allowed_actions: [],
  };
}
export async function informationRequestHandler({
  db,
  dir,
  fail,
  text,
  upload,
}) {
  const storage = path.resolve(dir, "information-uploads");
  await mkdir(storage, { recursive: true, mode: 0o700 });
  const readRequest = async (id, user) => {
    const [row] = await db.all(
      "SELECT r.*,u.name AS applicant_name,u.email AS applicant_email FROM information_requests r JOIN users u ON u.id=r.owner_id WHERE r.id=?",
      [id],
    );
    if (!row || !canRead(user, row)) fail(404, "Permohonan tidak ditemukan");
    return row;
  };
  return async ({ route, method, body, user, auth, send, res, url }) => {
    const match = route.match(
      /^\/api\/information-requests(?:\/([\w-]+)(?:\/(replies|files)(?:\/([\w-]+))?)?)?$/,
    );
    if (!match) return false;
    auth();
    if (!roles.includes(user.role))
      fail(403, "Akses permohonan informasi tidak diizinkan");
    const [, id, action, fileId] = match,
      now = Date.now();
    if (!id && method === "GET") {
      const sql =
        "SELECT r.*,u.name AS applicant_name FROM information_requests r JOIN users u ON u.id=r.owner_id";
      const where =
        user.role === "admin"
          ? ""
          : user.role === "masyarakat"
            ? " WHERE r.owner_id=?"
            : " WHERE r.field=? AND r.status<>'diajukan'";
      const rows = await db.all(
        sql + where + " ORDER BY r.updated DESC",
        user.role === "admin"
          ? []
          : [user.role === "masyarakat" ? user.id : user.field],
      );
      send(
        rows
          .filter((r) => canRead(user, r))
          .map(({ details, purpose, phone, ...r }) => publicRow(r, user)),
      );
      return true;
    }
    if (!id && method === "POST") {
      if (user.role !== "masyarakat")
        fail(403, "Gunakan akun masyarakat untuk mengirim permohonan");
      const field = text(body.field, 20),
        phone = text(body.phone, 30);
      if (!destinations.includes(field)) fail(400, "Bidang tujuan tidak valid");
      if (
        !/^\+?[0-9 ()-]+$/.test(phone) ||
        phone.replace(/\D/g, "").length < 7 ||
        phone.replace(/\D/g, "").length > 15
      )
        fail(400, "Nomor telepon tidak valid");
      const newId = randomUUID();
      await db.run(
        "INSERT INTO information_requests (id,owner_id,subject,details,purpose,phone,field,status,created,updated,version) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [
          newId,
          user.id,
          text(body.subject, 180),
          text(body.details, 5000),
          text(body.purpose, 2000),
          phone,
          field,
          "diajukan",
          now,
          now,
          0,
        ],
      );
      send({ id: newId }, 201);
      return true;
    }
    if (!id) fail(404, "Endpoint tidak ditemukan");
    const row = await readRequest(id, user);
    if (!action && method === "GET") {
      const replies = await db.all(
        "SELECT r.*,u.name AS actor_name FROM information_replies r JOIN users u ON u.id=r.actor_id WHERE r.request_id=?" +
          (user.role === "masyarakat" ? " AND r.is_public=1" : "") +
          " ORDER BY r.created,r.id",
        [id],
      );
      send({ ...publicRow(row, user), replies });
      return true;
    }
    if (action === "files" && fileId && method === "GET") {
      const [file] = await db.all(
        "SELECT file_name FROM information_replies WHERE request_id=? AND file_id=?" +
          (user.role === "masyarakat" ? " AND is_public=1" : ""),
        [id, fileId],
      );
      if (!file) fail(404, "Dokumen jawaban tidak ditemukan");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        (url.searchParams.get("download") === "1" ? "attachment" : "inline") +
          "; filename*=UTF-8''" +
          encodeURIComponent(file.file_name),
      );
      res.end(await readFile(path.join(storage, fileId)));
      return true;
    }
    if (action === "replies" && !fileId && method === "POST") {
      if (
        !Number.isSafeInteger(body.version) ||
        body.version !== Number(row.version)
      )
        fail(
          409,
          "Permohonan telah berubah. Buka ulang detail sebelum menyimpan.",
        );
      const status = text(body.status, 20);
      if (!informationActions(user, row).includes(status))
        fail(403, "Tindakan tidak sesuai peran, bidang, atau tahap permohonan");
      const field = status === "diteruskan" ? text(body.field, 20) : row.field;
      if (!destinations.includes(field)) fail(400, "Bidang tujuan tidak valid");
      let message = "",
        newFileId = "",
        fileName = "",
        file = null;
      // Only the assigned drafting officer can upload a proposed response.
      if (status !== "menunggu_persetujuan" && body.file)
        fail(400, "Lampiran jawaban hanya dapat diunggah petugas penyusun");
      if (status === "menunggu_persetujuan") {
        message = text(body.message, 5000);
        file = body.file ? upload(body.file, "document") : null;
        newFileId = file ? randomUUID() : "";
        fileName = file?.name || "";
      } else if (status === "selesai") {
        // Publish exactly the latest approved proposal; admin cannot replace its contents.
        if (body.message || body.file)
          fail(
            400,
            "Admin meneruskan jawaban yang telah disetujui tanpa mengubahnya",
          );
        const [draft] = await db.all(
          "SELECT * FROM information_replies WHERE request_id=? AND status='menunggu_persetujuan' ORDER BY created DESC,id DESC",
          [id],
        );
        if (!draft) fail(409, "Draf jawaban yang disetujui tidak ditemukan");
        message = draft.body;
        newFileId = draft.file_id;
        fileName = draft.file_name;
      } else if (status === "perbaikan_bidang")
        message = text(body.message, 5000);
      else
        message = body.message
          ? text(body.message, 5000)
          : status === "diteruskan"
            ? "Admin meneruskan permohonan ke bidang tujuan."
            : "Jawaban bidang disetujui dan dikembalikan ke admin.";
      const replyId = randomUUID(),
        at = Math.max(now, Number(row.updated) + 1);
      if (file)
        await writeFile(path.join(storage, newFileId), file.bytes, {
          mode: 0o600,
          flag: "wx",
        });
      try {
        await db.transaction(async (tx) => {
          if (
            !(await tx.run(
              "UPDATE information_requests SET status=?,field=?,updated=?,version=version+1 WHERE id=? AND version=?",
              [status, field, at, id, row.version],
            ))
          )
            fail(
              409,
              "Permohonan telah berubah. Buka ulang detail sebelum menyimpan.",
            );
          await tx.run(
            "INSERT INTO information_replies (id,request_id,actor_id,body,status,file_id,file_name,created,is_public) VALUES (?,?,?,?,?,?,?,?,?)",
            [
              replyId,
              id,
              user.id,
              message,
              status,
              newFileId,
              fileName,
              at,
              status === "selesai" ? 1 : 0,
            ],
          );
        });
      } catch (e) {
        if (file) await unlink(path.join(storage, newFileId)).catch(() => {});
        throw e;
      }
      send({ ok: true }, 201);
      return true;
    }
    fail(404, "Endpoint tidak ditemukan");
  };
}
