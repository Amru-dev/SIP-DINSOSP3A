import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
export async function openDB({
  driver = process.env.DB_DRIVER || "sqlite",
  dir = process.env.DATA_DIR || "./data",
} = {}) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  let sql;
  if (driver === "mysql") {
    const { default: mysql } = await import("mysql2/promise");
    sql = await mysql.createPool(process.env.MYSQL_URL);
    const wrap = (c) => ({
      all: async (q, p = []) => {
        const [rows] = await c.execute(q, p);
        return rows;
      },
      run: async (q, p = []) => {
        const [r] = await c.execute(q, p);
        return r.affectedRows;
      },
    });
    return {
      ...wrap(sql),
      transaction: async (fn) => {
        const conn = await sql.getConnection();
        try {
          await conn.beginTransaction();
          const result = await fn(wrap(conn));
          await conn.commit();
          return result;
        } catch (e) {
          await conn.rollback();
          throw e;
        } finally {
          conn.release();
        }
      },
      close: () => sql.end(),
    };
  }
  if (driver !== "sqlite") throw Error("DB_DRIVER harus mysql atau sqlite");
  const { DatabaseSync } = await import("node:sqlite");
  sql = new DatabaseSync(path.join(dir, "dinsos.sqlite"));
  sql.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  const raw = {
    all: async (q, p = []) => sql.prepare(q).all(...p),
    run: async (q, p = []) => sql.prepare(q).run(...p).changes,
  };
  let tail = Promise.resolve();
  const queue = (fn) => {
    const next = tail.then(fn);
    tail = next.catch(() => {});
    return next;
  };
  return {
    all: (...a) => queue(() => raw.all(...a)),
    run: (...a) => queue(() => raw.run(...a)),
    transaction: (fn) =>
      queue(async () => {
        sql.exec("BEGIN IMMEDIATE");
        try {
          const value = await fn(raw);
          sql.exec("COMMIT");
          return value;
        } catch (e) {
          sql.exec("ROLLBACK");
          throw e;
        }
      }),
    close: () => queue(() => sql.close()),
  };
}
export const seedPrograms = [
  ["alat-bantu", "Alat Bantu Disabilitas", "rehabsos", "bantuan"],
  ["bpjs-rujukan", "BPJS Rujukan", "rehabsos", "bantuan"],
  ["beasiswa", "Beasiswa Mahasiswa Miskin Berprestasi", "rehabsos", "bantuan"],
  ["kip", "KIP Sekolah dan Kuliah", "linjamsos", "bantuan"],
  ["pbi", "PBI BPJS", "linjamsos", "bantuan"],
  [
    "bencana-kebakaran",
    "Bantuan Korban Bencana Alam dan Kebakaran",
    "linjamsos",
    "bantuan",
  ],
  ["lapor-anak", "Pelaporan Kekerasan Anak", "anak", "laporan"],
  ["lapor-perempuan", "Pelaporan Kekerasan Perempuan", "perempuan", "laporan"],
];
export async function initialize(db) {
  const schema = await readFile(
    new URL("./schema.sql", import.meta.url),
    "utf8",
  );
  for (const query of schema
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean))
    await db.run(query);
  // Migration for installations created before account management existed.
  try {
    await db.all("SELECT active FROM users LIMIT 1");
  } catch {
    await db.run(
      "ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1",
    );
  }
  // Old replies were already visible to applicants; preserve their visibility.
  try {
    await db.all("SELECT is_public FROM information_replies LIMIT 1");
  } catch {
    await db.run(
      "ALTER TABLE information_replies ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1",
    );
  }
  await db.run(
    "UPDATE information_requests SET field='sekretariat' WHERE field='umum'",
  );
  // Legacy in-progress requests return to admin routing for the new approval flow.
  await db.run(
    "UPDATE information_requests SET status='diajukan',version=version+1 WHERE status='diproses'",
  );
  // Normalize the former standalone Secretariat role, preserving identity/history.
  await db.run(
    "UPDATE users SET role='operator',field='sekretariat' WHERE role='sekretariat'",
  );
  for (const field of ["rehabsos", "linjamsos", "anak", "perempuan"]) {
    if (
      !(await db.all("SELECT field FROM field_contacts WHERE field=?", [field]))
        .length
    )
      await db.run(
        "INSERT INTO field_contacts (field,contact_name,phone,email,schedule,revision) VALUES (?,?,?,?,?,?)",
        [field, "", "", "", "", 0],
      );
  }
  for (const [id, name, field, kind] of seedPrograms) {
    if (!(await db.all("SELECT id FROM programs WHERE id=?", [id])).length)
      await db.run(
        "INSERT INTO programs (id,name,field,kind,description,requirements,is_open) VALUES (?,?,?,?,?,?,?)",
        [
          id,
          name,
          field,
          kind,
          "Informasi dan persyaratan resmi belum ditetapkan.",
          "[]",
          0,
        ],
      );
  }
}
