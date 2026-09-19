import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { openDB, initialize } from "../db.js";
import { createApp } from "../server.js";
import { hash } from "../security.js";

test("aid drafts hidden from staff and summaries; required document counts follow uploads", async () => {
  const dir = await mkdtemp(tmpdir() + "/aid-private-"),
    db = await openDB({ dir });
  await initialize(db);
  for (const [id, role] of [
    ["citizen", "masyarakat"],
    ["admin", "admin"],
    ["op", "operator"],
    ["head", "kabid"],
    ["boss", "pimpinan"],
  ]) {
    await db.run(
      "INSERT INTO users (id,email,name,password,role,field) VALUES (?,?,?,?,?,?)",
      [id, id + "@test.local", id, "unused", role, "rehabsos"],
    );
    await db.run(
      "INSERT INTO sessions (id,user_id,csrf,expires) VALUES (?,?,?,?)",
      [hash(id), id, "csrf", Date.now() + 600000],
    );
  }
  await db.run("UPDATE programs SET is_open=1,requirements=? WHERE id=?", [
    JSON.stringify(["KTP", "KK"]),
    "alat-bantu",
  ]);
  const server = await createApp({ db, dir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  const req = async (id, route, method = "GET", body) => {
    const r = await fetch(base + "/api" + route, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        Cookie: "sid=" + id,
        "X-CSRF-Token": "csrf",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: r.status,
      data: r.headers.get("content-type").includes("application/json")
        ? await r.json()
        : await r.text(),
    };
  };
  try {
    const created = await req("citizen", "/applications", "POST", {
      program_id: "alat-bantu",
      phone: "081234567890",
      address: "Alamat uji",
    });
    assert.equal(created.status, 201);
    const path = "/applications/" + created.data.id;
    let own = (await req("citizen", "/applications")).data[0];
    assert.deepEqual(own.documents.missing, ["KTP", "KK"]);
    assert.equal(own.documents.complete, false);
    for (const staff of ["admin", "op", "head", "boss"]) {
      assert.equal((await req(staff, path)).status, 404);
      assert.equal((await req(staff, "/summary")).data.length, 0);
    }
    for (const staff of ["op", "head"])
      assert.equal((await req(staff, "/applications")).data.length, 0);
    const pdf = Buffer.from("%PDF-1.4\nFixture").toString("base64");
    const upload = await req("citizen", path + "/files", "POST", {
      requirement: "KTP",
      name: "ktp.pdf",
      data: pdf,
    });
    assert.equal(upload.status, 201);
    for (const staff of ["admin", "op", "head", "boss"])
      assert.equal((await req(staff, "/files/" + upload.data.id)).status, 404);
    own = (await req("citizen", "/applications")).data[0];
    assert.deepEqual(own.documents.missing, ["KK"]);
    assert.equal(own.documents.uploaded, 1);
    assert.equal(
      (await req("citizen", path + "/submit", "POST", {})).status,
      400,
    );
    assert.equal(
      (
        await req("citizen", path + "/files", "POST", {
          requirement: "KK",
          name: "kk.pdf",
          data: pdf,
        })
      ).status,
      201,
    );
    own = (await req("citizen", "/applications")).data[0];
    assert.equal(own.status, "draf");
    assert.equal(own.documents.complete, true);
    assert.equal((await req("op", path)).status, 404);
    assert.equal(
      (await req("citizen", path + "/submit", "POST", {})).status,
      200,
    );
    for (const staff of ["op", "head"]) {
      assert.equal((await req(staff, path)).status, 200);
      assert.equal(
        (await req(staff, "/applications")).data[0].documents.complete,
        true,
      );
    }
    assert.equal((await req("admin", path)).status, 404);
    for (const staff of ["admin", "boss"])
      assert.equal((await req(staff, "/summary")).data[0].total, 1);
    const password = "Account-Test-12345";
    for (const role of ["operator", "sekretaris"]) {
      assert.equal(
        (
          await req("admin", "/users", "POST", {
            name: role,
            email: role + "@test.local",
            password,
            role,
            field: "umum",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await req("admin", "/users", "POST", {
            name: role,
            email: role + "@test.local",
            password,
            role,
            field: "sekretariat",
          })
        ).status,
        201,
      );
    }
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("legacy information migration keeps public replies and completed requests, routes unfinished Umum to Secretariat once", async () => {
  const dir = await mkdtemp(tmpdir() + "/information-migration-"),
    db = await openDB({ dir });
  try {
    const schema = await readFile(
      new URL("../src/database/schema.sql", import.meta.url),
      "utf8",
    );
    const replySQL = schema
      .split(";")
      .find((x) => x.includes("CREATE TABLE IF NOT EXISTS information_replies"))
      .replace(", is_public INTEGER NOT NULL DEFAULT 1", "");
    await db.run(replySQL);
    await initialize(db);
    for (const [id, status] of [
      ["open", "diproses"],
      ["done", "selesai"],
    ])
      await db.run(
        "INSERT INTO information_requests (id,owner_id,subject,details,purpose,phone,field,status,created,updated,version) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [
          id,
          "owner",
          "Judul",
          "Rincian",
          "Tujuan",
          "081234567890",
          "umum",
          status,
          1,
          1,
          2,
        ],
      );
    await db.run(
      "INSERT INTO information_replies (id,request_id,actor_id,body,status,file_id,file_name,created) VALUES (?,?,?,?,?,?,?,?)",
      ["old", "done", "admin", "Jawaban lama", "selesai", "", "", 2],
    );
    await db.run(
      "INSERT INTO users (id,email,name,password,role,field) VALUES (?,?,?,?,?,?)",
      [
        "legacy-secretariat",
        "legacy@test.local",
        "Petugas Lama",
        "unchanged-hash",
        "sekretariat",
        "sekretariat",
      ],
    );
    await initialize(db);
    await initialize(db);
    const [migrated] = await db.all("SELECT * FROM users WHERE id=?", [
      "legacy-secretariat",
    ]);
    assert.equal(migrated.role, "operator");
    assert.equal(migrated.field, "sekretariat");
    assert.equal(migrated.password, "unchanged-hash");
    const [open] = await db.all(
        "SELECT * FROM information_requests WHERE id=?",
        ["open"],
      ),
      [done] = await db.all("SELECT * FROM information_requests WHERE id=?", [
        "done",
      ]);
    assert.equal(open.field, "sekretariat");
    assert.equal(open.status, "diajukan");
    assert.equal(open.version, 3);
    assert.equal(done.status, "selesai");
    assert.equal(done.version, 2);
    assert.equal(
      (await db.all("SELECT * FROM information_replies WHERE id=?", ["old"]))[0]
        .is_public,
      1,
    );
  } finally {
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
