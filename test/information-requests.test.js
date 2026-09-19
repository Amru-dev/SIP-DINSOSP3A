import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { openDB, initialize } from "../db.js";
import { createApp } from "../server.js";
import { hash } from "../security.js";

test("information approval: all fields and Secretariat, private drafts, return, approval and exact publication", async () => {
  const dir = await mkdtemp(tmpdir() + "/information-flow-");
  let db = await openDB({ dir });
  await initialize(db);
  const assignments = [
    ["citizen", "masyarakat", "umum"],
    ["other", "masyarakat", "umum"],
    ["admin", "admin", "umum"],
    ["pimpinan", "pimpinan", "umum"],
    ["sec", "operator", "sekretariat"],
    ["secretary", "sekretaris", "sekretariat"],
  ];
  for (const field of ["rehabsos", "linjamsos", "anak", "perempuan"])
    assignments.push(
      ["op-" + field, "operator", field],
      ["head-" + field, "kabid", field],
    );
  for (const [id, role, field] of assignments) {
    await db.run(
      "INSERT INTO users (id,email,name,password,role,field) VALUES (?,?,?,?,?,?)",
      [id, id + "@test.local", id, "unused", role, field],
    );
    await db.run(
      "INSERT INTO sessions (id,user_id,csrf,expires) VALUES (?,?,?,?)",
      [hash(id + "-session"), id, "csrf", Date.now() + 600000],
    );
  }
  let server = await createApp({ db, dir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  let base = "http://127.0.0.1:" + server.address().port;
  const request = async (
    route,
    role = "",
    method = "GET",
    body,
    csrf = "csrf",
  ) => {
    const r = await fetch(base + "/api" + route, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        Cookie: role ? "sid=" + role + "-session" : "",
        "X-CSRF-Token": csrf,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: r.status,
      headers: r.headers,
      data: r.headers.get("content-type")?.includes("application/json")
        ? await r.json()
        : Buffer.from(await r.arrayBuffer()),
    };
  };
  const form = {
    subject: "Dokumen Renja",
    field: "sekretariat",
    details: "Mohon dokumen.",
    purpose: "Penelitian",
    phone: "081234567890",
  };
  const pdf = {
    name: "jawaban.pdf",
    data: Buffer.from("%PDF-1.4\nPDF test fixture\n%%EOF").toString("base64"),
  };
  let lastRoute, lastFile;
  try {
    assert.equal(
      (await request("/information-requests", "", "POST", form)).status,
      401,
    );
    assert.equal(
      (await request("/information-requests", "admin", "POST", form)).status,
      403,
    );
    assert.equal(
      (await request("/information-requests", "citizen", "POST", form, "wrong"))
        .status,
      403,
    );
    assert.equal(
      (
        await request("/information-requests", "citizen", "POST", {
          ...form,
          field: "umum",
        })
      ).status,
      400,
    );
    for (const field of [
      "sekretariat",
      "rehabsos",
      "linjamsos",
      "anak",
      "perempuan",
    ]) {
      const worker = field === "sekretariat" ? "sec" : "op-" + field,
        head = field === "sekretariat" ? "secretary" : "head-" + field;
      const created = await request(
        "/information-requests",
        "citizen",
        "POST",
        { ...form, field, owner_id: "other", status: "selesai" },
      );
      assert.equal(created.status, 201);
      const route = "/information-requests/" + created.data.id;
      lastRoute = route;
      const action = (role, version, status, extra = {}) =>
        request(route + "/replies", role, "POST", {
          version,
          status,
          ...extra,
        });
      assert.equal((await request(route, "other")).status, 404);
      assert.equal((await request(route, worker)).status, 404);
      assert.equal((await request(route, head)).status, 404);
      assert.equal((await request(route, "pimpinan")).status, 403);
      assert.equal((await action("admin", 0, "selesai")).status, 403);
      assert.equal(
        (
          await action("admin", 0, "diteruskan", {
            field,
            message: "Internal routing note",
          })
        ).status,
        201,
      );
      assert.equal((await request(route, "citizen")).data.status, "diproses");
      assert.deepEqual((await request(route, "citizen")).data.replies, []);
      assert.equal((await request(route, worker)).status, 200);
      const foreign = field === "rehabsos" ? "op-anak" : "op-rehabsos";
      assert.equal((await request(route, foreign)).status, 404);
      assert.equal(
        (await action(worker, 1, "disetujui_bidang", { message: "skip" }))
          .status,
        403,
      );
      assert.equal((await action(head, 1, "disetujui_bidang")).status, 403);
      assert.equal(
        (
          await action(worker, 1, "menunggu_persetujuan", {
            message: "Draft A",
            file: pdf,
          })
        ).status,
        201,
      );
      let row = (await request(route, head)).data;
      const oldFile = row.replies.find((r) => r.file_id).file_id;
      assert.equal(
        (await request(route + "/files/" + oldFile, "citizen")).status,
        404,
      );
      assert.equal(
        (await request(route + "/files/" + oldFile, head)).status,
        200,
      );
      assert.equal((await action("admin", 2, "selesai")).status, 403);
      assert.equal(
        (
          await action(head, 2, "perbaikan_bidang", {
            message: "Perbaiki jawaban internal",
          })
        ).status,
        201,
      );
      assert.equal(
        (
          await action(worker, 3, "menunggu_persetujuan", {
            message: "Final draft " + field,
            file: pdf,
          })
        ).status,
        201,
      );
      assert.equal((await action(head, 2, "disetujui_bidang")).status, 409);
      assert.equal(
        (
          await action(head, 4, "disetujui_bidang", {
            message: "Approved internal note",
          })
        ).status,
        201,
      );
      assert.deepEqual((await request(route, "citizen")).data.replies, []);
      assert.equal(
        (await action("admin", 5, "selesai", { message: "Tamper" })).status,
        400,
      );
      assert.equal((await action("admin", 5, "selesai")).status, 201);
      row = (await request(route, "citizen")).data;
      assert.equal(row.status, "selesai");
      assert.equal(row.replies.length, 1);
      assert.equal(row.replies[0].body, "Final draft " + field);
      const fileRoute = route + "/files/" + row.replies[0].file_id;
      lastFile = fileRoute;
      assert.equal((await request(fileRoute, "other")).status, 404);
      assert.equal((await request(fileRoute)).status, 401);
      assert.equal(
        (await request(route + "/files/" + oldFile, "citizen")).status,
        404,
      );
      const preview = await request(fileRoute, "citizen");
      assert.equal(preview.status, 200);
      assert.match(preview.headers.get("content-disposition"), /^inline/);
      assert.deepEqual(preview.data, Buffer.from(pdf.data, "base64"));
      assert.match(
        (await request(fileRoute + "?download=1", "admin")).headers.get(
          "content-disposition",
        ),
        /^attachment/,
      );
      assert.equal(
        (await request("/public-files/" + row.replies[0].file_id)).status,
        404,
      );
      assert.equal((await action("admin", 6, "selesai")).status, 403);
    }
    assert.equal(
      (await request("/information-requests", "other")).data.length,
      0,
    );
    assert.equal(
      (await request("/information-requests", "op-anak")).data.length,
      1,
    );
    assert.equal(
      (await request("/information-requests", "admin")).data.length,
      5,
    );
    assert.equal((await readdir(dir + "/information-uploads")).length, 10);
    await new Promise((r) => server.close(r));
    await db.close();
    db = await openDB({ dir });
    await initialize(db);
    server = await createApp({ db, dir });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = "http://127.0.0.1:" + server.address().port;
    assert.equal((await request(lastRoute, "citizen")).data.replies.length, 1);
    assert.equal((await request(lastFile, "citizen")).status, 200);
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
