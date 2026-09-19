import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { openDB, initialize } from "../db.js";
import { createApp } from "../server.js";
import { passwordHash } from "../security.js";

test("optional employee photos and activity gallery lifecycle preserve legacy data", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "dinsos-media-")),
    db = await openDB({ dir });
  await initialize(db);
  const password = "Test-Password-1234";
  await db.run(
    "INSERT INTO users (id,email,name,password,role,field) VALUES (?,?,?,?,?,?)",
    [
      "admin",
      "admin@test.local",
      "Admin",
      await passwordHash(password),
      "admin",
      "umum",
    ],
  );
  const server = await createApp({ db, dir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  let cookie = "",
    csrf = "";
  async function call(route, method = "GET", body, authenticated = true) {
    const r = await fetch(base + "/api" + route, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        Cookie: authenticated ? cookie : "",
        "X-CSRF-Token": authenticated ? csrf : "",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const value = await r.json();
    return {
      status: r.status,
      value,
      headers: r.headers,
      cookie: r.headers.get("set-cookie"),
    };
  }
  const photo = {
    name: "photo.png",
    data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=",
  };
  const details = {
    name: "Kegiatan uji",
    description: "Deskripsi panjang\n\nParagraf kedua.",
    activity_date: "2026-09-15",
    field: "anak",
  };
  try {
    const login = await call("/login", "POST", {
      email: "admin@test.local",
      password,
    });
    cookie = login.cookie.split(";")[0];
    csrf = login.value.csrf;
    assert.equal(
      (await call("/activities", "POST", details, false)).status,
      401,
    );
    const employee = await call("/employees", "POST", {
      name: "Pegawai",
      nip: "199908052025051002",
      position: "Pranata Komputer",
      employment_type: "PNS",
      placement: "sekretariat",
    });
    assert.equal(employee.status, 201);
    let e = (await call("/public-information")).value.employees[0];
    assert.equal(e.photo_id, "");
    assert.equal(
      (
        await call("/employees/" + e.id, "PATCH", {
          revision: e.published,
          photo,
        })
      ).status,
      200,
    );
    e = (await call("/public-information")).value.employees[0];
    const employeePhoto = e.photo_id;
    assert.ok(employeePhoto);
    assert.equal(
      (
        await call("/employees/" + e.id, "PATCH", {
          revision: e.published,
          photo: null,
        })
      ).status,
      200,
    );
    assert.equal(
      (await fetch(base + "/api/public-files/" + employeePhoto)).status,
      404,
    );
    // Legacy rows have a single photo and no gallery/video records.
    await db.run(
      "INSERT INTO public_files (id,name,mime,bytes,kind) VALUES (?,?,?,?,?)",
      ["legacy-photo", "old.png", "image/png", 8, "image"],
    );
    await writeFile(
      path.join(dir, "public-uploads", "legacy-photo"),
      Buffer.from(photo.data, "base64"),
    );
    await db.run(
      "INSERT INTO activities (id,photo_id,name,description,activity_date,field,published) VALUES (?,?,?,?,?,?,?)",
      [
        "legacy",
        "legacy-photo",
        details.name,
        details.description,
        details.activity_date,
        details.field,
        1,
      ],
    );
    await initialize(db);
    assert.deepEqual((await call("/activities/legacy")).value.photo_ids, [
      "legacy-photo",
    ]);
    assert.equal(
      (
        await call("/activities/legacy", "PATCH", {
          revision: 1,
          photos: [photo],
        })
      ).status,
      200,
    );
    assert.equal((await call("/activities/legacy")).value.photo_ids.length, 2);
    const created = await call("/activities", "POST", {
      ...details,
      photos: [photo, photo],
      youtube_url: "https://youtu.be/dQw4w9WgXcQ",
    });
    assert.equal(created.status, 201);
    const id = created.value.id;
    let row = (await call("/activities/" + id)).value;
    assert.equal(row.photo_ids.length, 2);
    assert.equal(row.youtube_id, "dQw4w9WgXcQ");
    assert.match(
      (await call("/activities/" + id)).headers.get("content-security-policy"),
      /frame-src 'self' https:\/\/www.youtube-nocookie.com/,
    );
    const before = await readdir(path.join(dir, "public-uploads"));
    assert.equal(
      (
        await call("/activities/" + id, "PATCH", {
          revision: row.published,
          keep_photo_ids: ["legacy-photo"],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/activities/" + id, "PATCH", {
          revision: 0,
          photos: [photo],
        })
      ).status,
      409,
    );
    for (const url of [
      "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
      "javascript:alert(1)",
      "https://youtu.be/invalid",
    ])
      assert.equal(
        (
          await call("/activities/" + id, "PATCH", {
            revision: row.published,
            youtube_url: url,
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await call("/activities", "POST", {
          ...details,
          photos: Array(7).fill(photo),
        })
      ).status,
      400,
    );
    assert.deepEqual(await readdir(path.join(dir, "public-uploads")), before);
    const removed = row.photo_ids[0],
      kept = row.photo_ids[1];
    assert.equal(
      (
        await call("/activities/" + id, "PATCH", {
          revision: row.published,
          keep_photo_ids: [kept],
          photos: [photo],
          youtube_url: "",
        })
      ).status,
      200,
    );
    row = (await call("/activities/" + id)).value;
    assert.equal(row.photo_ids.length, 2);
    assert.equal(row.photo_ids[0], kept);
    assert.equal(row.youtube_id, "");
    assert.equal(
      (await fetch(base + "/api/public-files/" + removed)).status,
      404,
    );
    assert.equal((await fetch(base + "/api/public-files/" + kept)).status, 200);
    assert.equal(
      (await call("/activities/" + id, "DELETE", { revision: row.published }))
        .status,
      200,
    );
    for (const file of row.photo_ids)
      assert.equal(
        (await fetch(base + "/api/public-files/" + file)).status,
        404,
      );
    assert.equal((await call("/activities/" + id)).status, 404);
    const videoOnly = await call("/activities", "POST", {
      ...details,
      youtube_url: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    });
    assert.equal(videoOnly.status, 201);
    assert.deepEqual(
      (await call("/activities/" + videoOnly.value.id)).value.photo_ids,
      [],
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
