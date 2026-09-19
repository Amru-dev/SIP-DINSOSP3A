import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { openDB, initialize } from "../db.js";
import { createApp } from "../server.js";
import { passwordHash } from "../security.js";

test("UI keeps public navigation concise and separates admin workspaces", async () => {
  const html = await readFile(
    new URL("../public/index.html", import.meta.url),
    "utf8",
  );
  const script = (
    await Promise.all(
      [
        "../public/js/features/dashboard/views.js",
        "../public/js/features/public-information/gateway.js",
      ].map((file) => readFile(new URL(file, import.meta.url), "utf8")),
    )
  ).join("\n");
  assert.equal(
    (html.match(/<nav[^>]*>[\s\S]*?<\/nav>/)?.[0].match(/<a /g) || []).length,
    4,
  );
  assert.match(html, /id="navToggle"/);
  for (const label of [
    "Ringkasan",
    "Program & Persyaratan",
    "Informasi Publik",
    "Akun Petugas",
  ])
    assert.equal(script.includes(label), true);
  assert.match(script, /admin-layout/);
  assert.match(html, /id="struktur-organisasi-beranda"/);
  assert.match(script, /showOrganizationChart/);
});

test("HTTP: login, roles, uploads, decisions, audit and persistence", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "dinsos-test-"));
  let db = await openDB({ driver: "sqlite", dir });
  await initialize(db);
  const password = "Only-Automated-Test-123!";
  for (const [id, role, field] of [
    ["admin", "admin", "umum"],
    ["op", "operator", "rehabsos"],
    ["kabid", "kabid", "rehabsos"],
    ["other", "kabid", "linjamsos"],
  ]) {
    await db.run(
      "INSERT INTO users (id,email,name,password,role,field) VALUES (?,?,?,?,?,?)",
      [id, id + "@test.local", id, await passwordHash(password), role, field],
    );
  }
  let server = await createApp({ db, dir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  let base = "http://127.0.0.1:" + server.address().port;
  const client = () => ({ cookie: "", csrf: "" });
  async function request(c, route, method = "GET", body, extra = {}) {
    const res = await fetch(base + "/api" + route, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        Cookie: c.cookie,
        "X-CSRF-Token": c.csrf,
        ...extra,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.headers.get("set-cookie"))
      c.cookie = res.headers.get("set-cookie").split(";")[0];
    const type = res.headers.get("content-type");
    const data = type?.includes("application/json")
      ? await res.json()
      : Buffer.from(await res.arrayBuffer());
    if (data.csrf) c.csrf = data.csrf;
    return { status: res.status, data, headers: res.headers };
  }
  const admin = client(),
    op = client(),
    kabid = client(),
    other = client(),
    citizen = client(),
    stranger = client(),
    anonymous = client();
  const close = async () => {
    await new Promise((r) => server.close(r));
    await db.close();
  };
  try {
    const organizationImage = await fetch(base + "/struktur-organisasi.png");
    assert.equal(organizationImage.status, 200);
    assert.equal(organizationImage.headers.get("content-type"), "image/png");
    for (const [c, name] of [
      [admin, "admin"],
      [op, "op"],
      [kabid, "kabid"],
      [other, "other"],
    ])
      assert.equal(
        (
          await request(c, "/login", "POST", {
            email: name + "@test.local",
            password,
          })
        ).status,
        200,
      );
    await t.test("public signup cannot choose a privileged role", async () => {
      assert.equal(
        (
          await request(citizen, "/register", "POST", {
            name: "Pemohon Uji",
            email: "citizen@test.local",
            password,
            role: "admin",
            field: "rehabsos",
          })
        ).status,
        201,
      );
      assert.equal(
        (
          await request(stranger, "/register", "POST", {
            name: "Pemohon Lain",
            email: "stranger@test.local",
            password,
          })
        ).status,
        201,
      );
      assert.equal(
        (
          await request(citizen, "/login", "POST", {
            email: "citizen@test.local",
            password,
          })
        ).data.user.role,
        "masyarakat",
      );
      await request(stranger, "/login", "POST", {
        email: "stranger@test.local",
        password,
      });
      // Profil/visi-misi is fixed on the homepage; the former contents endpoint no longer exists.
      assert.equal(
        (
          await request(citizen, "/contents", "POST", {
            category: "profil",
            title: "X",
            body: "Y",
            year: 2026,
          })
        ).status,
        404,
      );
      assert.equal((await request(anonymous, "/applications")).status, 401);
    });
    await t.test(
      "admin manages staff accounts without server access",
      async () => {
        assert.equal((await request(op, "/users")).status, 403);
        assert.equal((await request(anonymous, "/users")).status, 401);
        assert.equal(
          (
            await request(admin, "/users", "POST", {
              name: "Operator Anak",
              email: "operator-anak@test.local",
              password,
              role: "operator",
              field: "anak",
            })
          ).status,
          201,
        );
        const created = await request(admin, "/users", "POST", {
          name: "Operator Baru",
          email: "operator.baru@test.local",
          password,
          role: "operator",
          field: "rehabsos",
        });
        assert.equal(created.status, 201);
        let list = await request(admin, "/users");
        assert.equal(list.status, 200);
        assert.equal(
          Object.hasOwn(
            list.data.find((x) => x.email === "operator.baru@test.local"),
            "password",
          ),
          false,
        );
        const account = list.data.find(
          (x) => x.email === "operator.baru@test.local",
        );
        const managed = client();
        assert.equal(
          (
            await request(managed, "/login", "POST", {
              email: account.email,
              password,
            })
          ).status,
          200,
        );
        const replacement = "Replacement-Test-Password-456!";
        assert.equal(
          (
            await request(admin, "/users/" + account.id, "PATCH", {
              name: "Petugas Perempuan",
              email: "petugas.perempuan@test.local",
              password: replacement,
              role: "petugas",
              field: "perempuan",
              active: true,
            })
          ).status,
          200,
        );
        const newLogin = client();
        assert.equal(
          (
            await request(newLogin, "/login", "POST", {
              email: "petugas.perempuan@test.local",
              password: replacement,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request(admin, "/users/" + account.id, "PATCH", {
              name: "Petugas Perempuan",
              email: "petugas.perempuan@test.local",
              role: "petugas",
              field: "perempuan",
              active: false,
            })
          ).status,
          200,
        );
        assert.equal((await request(newLogin, "/me")).data.user, null);
        assert.equal(
          (
            await request(client(), "/login", "POST", {
              email: "petugas.perempuan@test.local",
              password: replacement,
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request(admin, "/users/admin", "PATCH", {
              name: "admin",
              email: "admin@test.local",
              role: "admin",
              field: "umum",
              active: false,
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "admin publishes, edits and deletes public announcements",
      async () => {
        const today = new Date().toISOString().slice(0, 10);
        assert.equal(
          (
            await request(op, "/announcements", "POST", {
              title: "Ditolak",
              body: "Bukan admin",
              publish_date: today,
              field: "umum",
            })
          ).status,
          403,
        );
        const created = await request(admin, "/announcements", "POST", {
          title: "Jadwal Pelayanan",
          body: "Pelayanan dibuka pada hari kerja.",
          publish_date: today,
          expires_date: "",
          field: "umum",
          important: true,
        });
        assert.equal(created.status, 201);
        let info = await request(anonymous, "/public-information");
        let announcement = info.data.announcements.find(
          (x) => x.id === created.data.id,
        );
        assert.equal(announcement.title, "Jadwal Pelayanan");
        assert.equal(Number(announcement.important), 1);
        assert.equal(
          (
            await request(admin, "/announcements/" + announcement.id, "PATCH", {
              title: "Jadwal Pelayanan Terbaru",
              body: "Pelayanan dibuka Senin sampai Jumat.",
              publish_date: today,
              expires_date: "2020-01-01",
              field: "sekretariat",
              important: false,
              revision: Number(announcement.published),
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(admin, "/announcements/" + announcement.id, "PATCH", {
              title: "Jadwal Pelayanan Terbaru",
              body: "Pelayanan dibuka Senin sampai Jumat.",
              publish_date: today,
              expires_date: "",
              field: "sekretariat",
              important: false,
              revision: Number(announcement.published),
            })
          ).status,
          200,
        );
        info = await request(admin, "/public-information");
        announcement = info.data.announcements.find(
          (x) => x.id === created.data.id,
        );
        assert.equal(announcement.title, "Jadwal Pelayanan Terbaru");
        assert.equal(
          (
            await request(
              admin,
              "/announcements/" + announcement.id,
              "DELETE",
              { revision: Number(announcement.published) },
            )
          ).status,
          200,
        );
        info = await request(anonymous, "/public-information");
        assert.equal(
          info.data.announcements.some((x) => x.id === created.data.id),
          false,
        );
      },
    );
    await t.test(
      "public PDF supports preview and explicit download",
      async () => {
        const viewer = await fetch(base + "/vendor/pdf.mjs");
        assert.equal(viewer.status, 200);
        assert.match(viewer.headers.get("content-type"), /^text\/javascript/);
        const pdf = Buffer.from("%PDF-1.7\n%%EOF").toString("base64");
        const created = await request(admin, "/public-documents", "POST", {
          name: "Dokumen Uji",
          year: 2026,
          publish_date: "2026-09-05",
          file: { name: "dokumen-uji.pdf", data: pdf },
        });
        assert.equal(created.status, 201);
        const info = await request(anonymous, "/public-information");
        const document = info.data.documents.find(
          (x) => x.id === created.data.id,
        );
        const preview = await request(
          anonymous,
          "/public-files/" + document.file_id,
        );
        assert.equal(preview.status, 200);
        assert.match(preview.headers.get("content-disposition"), /^inline;/);
        const download = await request(
          anonymous,
          "/public-files/" + document.file_id + "?download=1",
        );
        assert.equal(download.status, 200);
        assert.match(
          download.headers.get("content-disposition"),
          /^attachment;/,
        );
      },
    );
    await t.test(
      "closed programs and unfinished case reporting are blocked",
      async () => {
        assert.equal(
          (
            await request(citizen, "/applications", "POST", {
              program_id: "alat-bantu",
              phone: "08000",
              address: "Alamat uji",
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request(admin, "/programs/lapor-anak", "PATCH", {
              description: "uji",
              requirements: ["uji"],
              is_open: true,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request(admin, "/programs/alat-bantu", "PATCH", {
              description: "uji",
              requirements: [],
              is_open: true,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(op, "/programs/alat-bantu", "PATCH", {
              description: "uji",
              requirements: ["Surat uji"],
              is_open: true,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(admin, "/programs/alat-bantu", "PATCH", {
              description: "PROGRAM UJI SAJA",
              requirements: ["Surat uji"],
              is_open: true,
            })
          ).status,
          200,
        );
      },
    );
    let id, fileId;
    await t.test(
      "draft requires documents; invalid file content is rejected",
      async () => {
        const result = await request(citizen, "/applications", "POST", {
          program_id: "alat-bantu",
          phone: "080000",
          address: "Alamat fiktif pengujian",
        });
        assert.equal(result.status, 201);
        id = result.data.id;
        assert.equal(
          (
            await request(
              citizen,
              "/applications/" + id + "/submit",
              "POST",
              {},
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(citizen, "/applications/" + id + "/files", "POST", {
              requirement: "Surat uji",
              name: "x.pdf",
              data: Buffer.from("<script>alert(1)</script>").toString("base64"),
            })
          ).status,
          415,
        );
        const upload = await request(
          citizen,
          "/applications/" + id + "/files",
          "POST",
          {
            requirement: "Surat uji",
            name: "contoh.pdf",
            data: Buffer.from("%PDF-1.7\n%%EOF").toString("base64"),
          },
        );
        assert.equal(upload.status, 201);
        fileId = upload.data.id;
        const preview = await request(citizen, "/files/" + fileId);
        assert.equal(preview.status, 200);
        assert.match(preview.headers.get("content-disposition"), /^inline;/);
        const download = await request(
          citizen,
          "/files/" + fileId + "?download=1",
        );
        assert.equal(download.status, 200);
        assert.match(
          download.headers.get("content-disposition"),
          /^attachment;/,
        );
        assert.equal(
          (
            await request(
              citizen,
              "/applications/" + id + "/submit",
              "POST",
              {},
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      "object access, CSRF and field separation are server enforced",
      async () => {
        for (const c of [stranger, other, admin]) {
          assert.equal((await request(c, "/applications/" + id)).status, 404);
          assert.equal((await request(c, "/files/" + fileId)).status, 404);
        }
        assert.equal(
          (await request(anonymous, "/files/" + fileId)).status,
          401,
        );
        assert.equal((await request(op, "/applications/" + id)).status, 200);
        assert.equal(
          (
            await request(
              op,
              "/applications/" + id + "/transition",
              "POST",
              { status: "diverifikasi", note: "Uji" },
              { "X-CSRF-Token": "" },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              op,
              "/applications/" + id + "/transition",
              "POST",
              { status: "diverifikasi", note: "Uji" },
              { Origin: "https://evil.test" },
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "operator review, citizen correction, kabid approval and realization",
      async () => {
        const change = (c, status) =>
          request(c, "/applications/" + id + "/transition", "POST", {
            status,
            note: "Catatan uji " + status,
          });
        assert.equal((await change(kabid, "disetujui")).status, 403);
        assert.equal((await change(op, "diverifikasi")).status, 200);
        assert.equal((await change(op, "perbaikan")).status, 200);
        assert.equal(
          (
            await request(citizen, "/applications/" + id, "PATCH", {
              phone: "080001",
              address: "Alamat diperbaiki",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              citizen,
              "/applications/" + id + "/submit",
              "POST",
              {},
            )
          ).status,
          200,
        );
        assert.equal((await change(op, "diverifikasi")).status, 200);
        assert.equal((await change(op, "menunggu_kabid")).status, 200);
        assert.equal((await change(op, "disetujui")).status, 403);
        assert.equal((await change(other, "disetujui")).status, 404);
        assert.equal((await change(kabid, "disetujui")).status, 200);
        assert.equal((await change(op, "direalisasikan")).status, 200);
        const detail = (await request(citizen, "/applications/" + id)).data;
        assert.equal(detail.status, "direalisasikan");
        assert.equal(detail.history.at(-1).actor, "op");
        assert.equal((await change(kabid, "ditolak")).status, 403);
      },
    );
    await t.test("database transaction rolls back failed updates", async () => {
      await assert.rejects(
        db.transaction(async (tx) => {
          await tx.run("UPDATE applications SET status=? WHERE id=?", [
            "wrong",
            id,
          ]);
          throw Error("forced failure");
        }),
      );
      assert.equal(
        (await db.all("SELECT status FROM applications WHERE id=?", [id]))[0]
          .status,
        "direalisasikan",
      );
    });
    await t.test(
      "data and sessions survive a server restart; logout revokes session",
      async () => {
        await close();
        db = await openDB({ driver: "sqlite", dir });
        server = await createApp({ db, dir });
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        base = "http://127.0.0.1:" + server.address().port;
        assert.equal(
          (await request(citizen, "/applications/" + id)).data.status,
          "direalisasikan",
        );
        assert.equal((await request(citizen, "/files/" + fileId)).status, 200);
        const old = { ...citizen };
        assert.equal(
          (await request(citizen, "/logout", "POST", {})).status,
          200,
        );
        assert.equal((await request(old, "/applications")).status, 401);
      },
    );
  } finally {
    await close();
    await rm(dir, { recursive: true, force: true });
  }
});
