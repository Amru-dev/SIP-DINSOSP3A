import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fail, text } from "../../shared/validation.js";
import { mayRead, nextAllowed } from "../../security/access.js";

export async function handleApplications({
  db,
  route,
  method,
  body,
  user,
  auth,
  send,
  now,
  fileDir,
  findApp,
  audit,
}) {
  if (route === "/api/applications" && method === "POST") {
    auth();
    if (user.role !== "masyarakat") fail(403, "Gunakan akun masyarakat");
    const [p] = await db.all("SELECT * FROM programs WHERE id=?", [
      text(body.program_id, 40),
    ]);
    if (!p || !p.is_open || p.kind === "laporan")
      fail(409, "Program belum menerima pengajuan");
    const details = {
      phone: text(body.phone, 30),
      address: text(body.address, 500),
      note: typeof body.note === "string" ? body.note.slice(0, 2000) : "",
    };
    const id = randomUUID();
    await db.run(
      "INSERT INTO applications (id,owner_id,program_id,field,kind,status,details,created,updated,version) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        user.id,
        p.id,
        p.field,
        p.kind,
        "draf",
        JSON.stringify(details),
        now,
        now,
        0,
      ],
    );
    await audit(id, user, "draf", "Draf pengajuan dibuat");
    return send({ id }, 201);
  }
  if (route === "/api/applications" && method === "GET") {
    auth();
    let rows;
    if (user.role === "masyarakat")
      rows = await db.all(
        "SELECT * FROM applications WHERE owner_id=? ORDER BY created DESC",
        [user.id],
      );
    else if (["operator", "kabid", "petugas"].includes(user.role))
      rows = (
        await db.all(
          "SELECT * FROM applications WHERE field=? ORDER BY created DESC",
          [user.field],
        )
      ).filter((x) => mayRead(user, x));
    else fail(403, "Akun ini tidak dapat membuka data pribadi pengajuan");
    return send(
      await Promise.all(
        rows.map(async ({ details, ...rest }) => {
          const [program] = await db.all(
            "SELECT requirements FROM programs WHERE id=?",
            [rest.program_id],
          );
          const requirements = program ? JSON.parse(program.requirements) : [],
            files = await db.all(
              "SELECT requirement FROM files WHERE application_id=?",
              [rest.id],
            );
          const missing = requirements.filter(
            (r) => !files.some((f) => f.requirement === r),
          );
          return {
            ...rest,
            documents: {
              required: requirements.length,
              uploaded: requirements.length - missing.length,
              missing,
              complete: requirements.length > 0 && !missing.length,
            },
          };
        }),
      ),
    );
  }
  if (route === "/api/summary" && method === "GET") {
    auth();
    if (!["admin", "pimpinan", "kabid", "operator"].includes(user.role))
      fail(403, "Akses ditolak");
    return send(
      ["kabid", "operator"].includes(user.role)
        ? await db.all(
            "SELECT field,status,COUNT(*) AS total FROM applications WHERE kind=? AND field=? AND status<>'draf' GROUP BY field,status",
            ["bantuan", user.field],
          )
        : await db.all(
            "SELECT field,status,COUNT(*) AS total FROM applications WHERE kind=? AND status<>'draf' GROUP BY field,status",
            ["bantuan"],
          ),
    );
  }
  const appMatch = route.match(
    /^\/api\/applications\/([\w-]+)(?:\/(files|submit|transition))?$/,
  );
  if (appMatch) {
    auth();
    const app = await findApp(appMatch[1], user),
      action = appMatch[2];
    if (!action && method === "GET") {
      const files = await db.all("SELECT * FROM files WHERE application_id=?", [
        app.id,
      ]);
      const history = await db.all(
        "SELECT a.action,a.note,a.created,u.name AS actor FROM audits a JOIN users u ON a.actor=u.id WHERE application_id=? ORDER BY created",
        [app.id],
      );
      return send({ ...app, details: JSON.parse(app.details), files, history });
    }
    if (!action && method === "PATCH") {
      if (
        user.id !== app.owner_id ||
        !["draf", "perbaikan"].includes(app.status)
      )
        fail(403, "Pengajuan tidak dapat diedit");
      await db.run(
        "UPDATE applications SET details=?,updated=?,version=version+1 WHERE id=? AND version=?",
        [
          JSON.stringify({
            phone: text(body.phone, 30),
            address: text(body.address, 500),
            note: typeof body.note === "string" ? body.note.slice(0, 2000) : "",
          }),
          now,
          app.id,
          app.version,
        ],
      );
      return send({ ok: true });
    }
    if (action === "files" && method === "POST") {
      if (
        user.id !== app.owner_id ||
        !["draf", "perbaikan"].includes(app.status)
      )
        fail(403, "Unggah hanya pada draf atau perbaikan");
      const [p] = await db.all("SELECT * FROM programs WHERE id=?", [
        app.program_id,
      ]);
      const requirement = text(body.requirement, 120);
      if (!JSON.parse(p.requirements).includes(requirement))
        fail(400, "Jenis persyaratan tidak dikenali");
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
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        mime = "image/png";
      else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
        mime = "image/jpeg";
      else fail(415, "Hanya PDF, PNG, JPG yang didukung");
      const id = randomUUID(),
        name = text(body.name, 180).replace(/[\r\n"]/g, "_");
      await writeFile(path.join(fileDir, id), bytes, {
        mode: 0o600,
        flag: "wx",
      });
      let previous = [];
      try {
        await db.transaction(async (tx) => {
          // Serialize mutations on this application, including across MySQL processes.
          // A concurrent submission/upload must reload instead of overwriting newer data.
          const changed = await tx.run(
            "UPDATE applications SET updated=?,version=version+1 WHERE id=? AND version=? AND owner_id=? AND status IN (?,?)",
            [now, app.id, app.version, user.id, "draf", "perbaikan"],
          );
          if (!changed)
            fail(
              409,
              "Pengajuan berubah. Muat ulang sebelum mengunggah kembali.",
            );
          const files = await tx.all(
            "SELECT id,requirement FROM files WHERE application_id=?",
            [app.id],
          );
          previous = files.filter((f) => f.requirement === requirement);
          if (files.length - previous.length >= 20)
            fail(400, "Maksimal 20 lampiran per pengajuan");
          // Also collapse duplicates created by older versions, only for this requirement.
          for (const old of previous)
            await tx.run("DELETE FROM files WHERE id=? AND application_id=?", [
              old.id,
              app.id,
            ]);
          await tx.run(
            "INSERT INTO files (id,application_id,requirement,name,mime,bytes) VALUES (?,?,?,?,?,?)",
            [id, app.id, requirement, name, mime, bytes.length],
          );
          await audit(
            app.id,
            user,
            previous.length ? "ganti_berkas" : "unggah",
            requirement,
            tx,
          );
        });
      } catch (e) {
        // Keep every old file if validation or the database transaction fails.
        await unlink(path.join(fileDir, id)).catch(() => {});
        throw e;
      }
      // Never remove the old bytes until the replacement is safely committed.
      for (const old of previous) {
        await unlink(path.join(fileDir, old.id)).catch((e) => {
          if (e.code !== "ENOENT")
            console.error("Old upload cleanup failed:", e.code);
        });
      }
      return send({ id, replaced: previous.length > 0 }, 201);
    }
    if (action === "submit" && method === "POST") {
      if (
        user.id !== app.owner_id ||
        !["draf", "perbaikan"].includes(app.status)
      )
        fail(403, "Pengajuan tidak dapat dikirim");
      const [p] = await db.all("SELECT * FROM programs WHERE id=?", [
        app.program_id,
      ]);
      if (!p.is_open) fail(409, "Program ditutup");
      const files = await db.all(
        "SELECT requirement FROM files WHERE application_id=?",
        [app.id],
      );
      const missing = JSON.parse(p.requirements).filter(
        (x) => !files.some((f) => f.requirement === x),
      );
      if (missing.length)
        fail(400, "Dokumen belum lengkap: " + missing.join(", "));
      await db.transaction(async (tx) => {
        if (
          !(await tx.run(
            "UPDATE applications SET status=?,updated=?,version=version+1 WHERE id=? AND version=?",
            ["diajukan", now, app.id, app.version],
          ))
        )
          fail(409, "Data berubah. Muat ulang.");
        await audit(app.id, user, "diajukan", "Pengajuan dikirim", tx);
      });
      return send({ ok: true });
    }
    if (action === "transition" && method === "POST") {
      const next = text(body.status, 30),
        note = text(body.note, 2000);
      if (!nextAllowed(user.role, app.kind, app.status, next))
        fail(403, "Perubahan status tidak diizinkan untuk peran/tahap ini");
      await db.transaction(async (tx) => {
        if (
          !(await tx.run(
            "UPDATE applications SET status=?,updated=?,version=version+1 WHERE id=? AND version=?",
            [next, now, app.id, app.version],
          ))
        )
          fail(409, "Data berubah. Muat ulang.");
        await audit(app.id, user, next, note, tx);
      });
      return send({ ok: true });
    }
  }

  return false;
}
