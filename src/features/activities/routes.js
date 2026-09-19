import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fail, text, date, upload } from "../../shared/validation.js";

export async function handleActivities({
  db,
  route,
  method,
  body,
  user,
  auth,
  send,
  now,
  publicFileDir,
  activityRows,
}) {
  const activityMatch = route.match(/^\/api\/activities(?:\/([\w-]+))?$/);
  if (activityMatch) {
    const id = activityMatch[1];
    if (method === "GET" && id) {
      const row = (await activityRows()).find((r) => r.id === id);
      if (!row) fail(404, "Kegiatan tidak ditemukan");
      return send(row);
    }
    if (
      !["POST", "PATCH", "DELETE"].includes(method) ||
      (method === "POST" && id) ||
      (method !== "POST" && !id)
    )
      fail(404, "Kegiatan tidak ditemukan");
    auth();
    if (user.role !== "admin")
      fail(403, "Hanya admin dapat mengelola kegiatan");
    const old = id ? (await activityRows()).find((r) => r.id === id) : null;
    if (id && !old) fail(404, "Kegiatan tidak ditemukan");
    if (
      old &&
      (!Number.isSafeInteger(body.revision) ||
        body.revision !== Number(old.published))
    )
      fail(409, "Data telah berubah. Muat ulang daftar.");
    let keep = old?.photo_ids || [],
      added = [],
      youtubeId = old?.youtube_id || "",
      values = [];
    if (method !== "DELETE") {
      const next = { ...old, ...body };
      if (
        !["sekretariat", "rehabsos", "linjamsos", "anak", "perempuan"].includes(
          next.field,
        )
      )
        fail(400, "Bidang tidak valid");
      values = [
        text(next.name, 180),
        text(next.description, 10000),
        date(next.activity_date),
        next.field,
      ];
      if (Object.hasOwn(body, "keep_photo_ids")) {
        if (
          !Array.isArray(body.keep_photo_ids) ||
          new Set(body.keep_photo_ids).size !== body.keep_photo_ids.length ||
          body.keep_photo_ids.some((x) => !keep.includes(x))
        )
          fail(400, "Foto lama tidak valid");
        keep = body.keep_photo_ids;
      }
      const photos = body.photos ?? (body.photo ? [body.photo] : []);
      if (!Array.isArray(photos) || keep.length + photos.length > 6)
        fail(400, "Maksimal 6 foto kegiatan");
      added = photos.map((photo) => ({
        ...upload(photo, "image"),
        id: randomUUID(),
      }));
      if (added.reduce((n, f) => n + f.bytes.length, 0) > 20 * 1024 * 1024)
        fail(413, "Total unggahan maksimal 20 MB");
      if (Object.hasOwn(body, "youtube_url")) {
        youtubeId = "";
        if (body.youtube_url) {
          let u;
          try {
            u = new URL(body.youtube_url);
          } catch {
            fail(400, "Tautan YouTube tidak valid");
          }
          if (u.protocol !== "https:" || u.username || u.password || u.port)
            fail(400, "Gunakan tautan HTTPS YouTube");
          const host = u.hostname.toLowerCase();
          if (host === "youtu.be") youtubeId = u.pathname.slice(1);
          else if (
            ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)
          )
            youtubeId =
              u.pathname === "/watch"
                ? u.searchParams.get("v")
                : u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)$/)?.[1];
          if (!/^[A-Za-z0-9_-]{11}$/.test(youtubeId || ""))
            fail(400, "Gunakan tautan video YouTube yang valid");
        }
      }
    }
    const newId = id || randomUUID(),
      allIds = [...keep, ...added.map((f) => f.id)],
      removed =
        method === "DELETE"
          ? old.photo_ids
          : (old?.photo_ids || []).filter((x) => !keep.includes(x)),
      written = [];
    try {
      for (const f of added) {
        await writeFile(path.join(publicFileDir, f.id), f.bytes, {
          mode: 0o600,
          flag: "wx",
        });
        written.push(f.id);
      }
      await db.transaction(async (tx) => {
        if (method === "POST")
          await tx.run(
            "INSERT INTO activities (id,photo_id,name,description,activity_date,field,published) VALUES (?,?,?,?,?,?,?)",
            [newId, allIds[0] || "", ...values, now],
          );
        else {
          const changed =
            method === "DELETE"
              ? await tx.run(
                  "DELETE FROM activities WHERE id=? AND published=?",
                  [id, old.published],
                )
              : await tx.run(
                  "UPDATE activities SET photo_id=?,name=?,description=?,activity_date=?,field=?,published=? WHERE id=? AND published=?",
                  [
                    allIds[0] || "",
                    ...values,
                    Math.max(now, Number(old.published) + 1),
                    id,
                    old.published,
                  ],
                );
          if (!changed) fail(409, "Data telah berubah. Muat ulang daftar.");
        }
        await tx.run("DELETE FROM activity_media WHERE activity_id=?", [newId]);
        await tx.run("DELETE FROM activity_videos WHERE activity_id=?", [
          newId,
        ]);
        if (method !== "DELETE") {
          for (const f of added)
            await tx.run(
              "INSERT INTO public_files (id,name,mime,bytes,kind) VALUES (?,?,?,?,?)",
              [f.id, f.name, f.mime, f.bytes.length, "image"],
            );
          for (let i = 0; i < allIds.length; i++)
            await tx.run(
              "INSERT INTO activity_media (activity_id,file_id,position) VALUES (?,?,?)",
              [newId, allIds[i], i],
            );
          if (youtubeId)
            await tx.run(
              "INSERT INTO activity_videos (activity_id,youtube_id) VALUES (?,?)",
              [newId, youtubeId],
            );
        }
        for (const fileId of removed)
          await tx.run("DELETE FROM public_files WHERE id=?", [fileId]);
      });
    } catch (e) {
      for (const fileId of written)
        await unlink(path.join(publicFileDir, fileId)).catch(() => {});
      throw e;
    }
    for (const fileId of removed)
      await unlink(path.join(publicFileDir, fileId)).catch((e) => {
        if (e.code !== "ENOENT") console.error("Media cleanup:", e.code);
      });
    return send({ id: newId, ok: true }, method === "POST" ? 201 : 200);
  }

  return false;
}
