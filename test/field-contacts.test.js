import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { openDB, initialize } from "../db.js";
import { createApp } from "../server.js";
import { hash } from "../security.js";

test("field contacts: admin access, validation, revision, separation and persistence", async () => {
  const dir = await mkdtemp(tmpdir() + "/field-contacts-");
  let db = await openDB({ dir });
  await initialize(db);
  for (const role of ["admin", "operator"]) {
    await db.run(
      "INSERT INTO users (id,email,name,password,role,field) VALUES (?,?,?,?,?,?)",
      [role, role + "@test.local", role, "unused", role, "rehabsos"],
    );
    await db.run(
      "INSERT INTO sessions (id,user_id,csrf,expires) VALUES (?,?,?,?)",
      [hash(role + "-session"), role, "test-csrf", Date.now() + 600000],
    );
  }
  const server = await createApp({ db, dir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  const request = async (
    method,
    route,
    body,
    role = "",
    csrf = "test-csrf",
  ) => {
    const response = await fetch(base + "/api" + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        Cookie: role ? "sid=" + role + "-session" : "",
        "X-CSRF-Token": csrf,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    let rows = (await request("GET", "/field-contacts")).data;
    assert.equal(rows.length, 4);
    assert.ok(rows.every((x) => x.phone === "" && x.schedule === ""));
    const data = {
      contact_name: "Unit Rehabsos",
      phone: "0812 3456 7890",
      email: "rehabsos@example.test",
      schedule: "Senin–Jumat: 08.00–16.00 WIB\nIstirahat: 12.00–13.00 WIB",
      revision: 0,
    };
    assert.equal(
      (await request("PATCH", "/field-contacts/rehabsos", data)).status,
      401,
    );
    assert.equal(
      (await request("PATCH", "/field-contacts/rehabsos", data, "operator"))
        .status,
      403,
    );
    assert.equal(
      (
        await request(
          "PATCH",
          "/field-contacts/rehabsos",
          data,
          "admin",
          "wrong",
        )
      ).status,
      403,
    );
    assert.equal(
      (await request("PATCH", "/field-contacts/invalid", data, "admin")).status,
      404,
    );
    assert.equal(
      (
        await request(
          "PATCH",
          "/field-contacts/rehabsos",
          { ...data, phone: "javascript:alert(1)" },
          "admin",
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          "PATCH",
          "/field-contacts/rehabsos",
          { ...data, email: "invalid" },
          "admin",
        )
      ).status,
      400,
    );
    assert.equal(
      (await request("PATCH", "/field-contacts/rehabsos", data, "admin"))
        .status,
      200,
    );
    assert.equal(
      (await request("PATCH", "/field-contacts/rehabsos", data, "admin"))
        .status,
      409,
    );
    rows = (await request("GET", "/field-contacts")).data;
    const saved = rows.find((x) => x.field === "rehabsos");
    assert.equal(saved.schedule, data.schedule);
    assert.ok(
      rows.filter((x) => x.field !== "rehabsos").every((x) => x.phone === ""),
    );
    await initialize(db);
    assert.equal(
      (
        await db.all("SELECT phone FROM field_contacts WHERE field=?", [
          "rehabsos",
        ])
      )[0].phone,
      data.phone,
    );
    await db.close();
    db = await openDB({ dir });
    await initialize(db);
    assert.equal(
      (
        await db.all("SELECT schedule FROM field_contacts WHERE field=?", [
          "rehabsos",
        ])
      )[0].schedule,
      data.schedule,
    );
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
