import { randomUUID } from "node:crypto";
import { fail, text } from "../../shared/validation.js";
import { passwordHash } from "../../security/access.js";
import { safeUser, staffAssignment } from "../../security/staff-roles.js";

export async function handleAccounts({
  db,
  route,
  method,
  body,
  user,
  auth,
  send,
}) {
  if (route === "/api/users" && method === "GET") {
    auth();
    if (user.role !== "admin") fail(403, "Hanya admin dapat mengelola akun");
    const rows = await db.all(
      "SELECT id,email,name,role,field,active FROM users WHERE role<>'masyarakat' ORDER BY role,name",
    );
    return send(rows.map(safeUser));
  }
  if (route === "/api/users" && method === "POST") {
    auth();
    if (user.role !== "admin") fail(403, "Hanya admin dapat mengelola akun");
    const email = text(body.email, 180).toLowerCase(),
      role = text(body.role, 20),
      field = text(body.field, 20);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail(400, "Email tidak valid");
    staffAssignment(role, field);
    let password;
    try {
      password = await passwordHash(body.password);
    } catch (e) {
      fail(400, e.message);
    }
    try {
      await db.run(
        "INSERT INTO users (id,email,name,password,role,field,active) VALUES (?,?,?,?,?,?,1)",
        [randomUUID(), email, text(body.name, 120), password, role, field],
      );
    } catch (e) {
      if (
        e.errcode === 2067 ||
        e.code === "SQLITE_CONSTRAINT_UNIQUE" ||
        e.code === "ER_DUP_ENTRY"
      )
        fail(409, "Email sudah digunakan");
      throw e;
    }
    return send({ message: "Akun petugas berhasil dibuat." }, 201);
  }
  const userMatch = route.match(/^\/api\/users\/([\w-]+)$/);
  if (userMatch && method === "PATCH") {
    auth();
    if (user.role !== "admin") fail(403, "Hanya admin dapat mengelola akun");
    const [current] = await db.all("SELECT * FROM users WHERE id=?", [
      userMatch[1],
    ]);
    if (!current || current.role === "masyarakat")
      fail(404, "Akun petugas tidak ditemukan");
    const email = text(body.email, 180).toLowerCase(),
      role = text(body.role, 20),
      field = text(body.field, 20),
      active = body.active === false ? 0 : 1;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail(400, "Email tidak valid");
    staffAssignment(role, field);
    if (
      current.id === user.id &&
      (role !== "admin" || field !== "umum" || !active)
    )
      fail(
        409,
        "Anda tidak dapat menurunkan peran atau menonaktifkan akun sendiri",
      );
    if (
      current.role === "admin" &&
      Number(current.active) !== 0 &&
      (role !== "admin" || !active)
    ) {
      const [count] = await db.all(
        "SELECT COUNT(*) AS total FROM users WHERE role='admin' AND active=1",
      );
      if (Number(count.total) <= 1)
        fail(409, "Minimal satu akun admin harus tetap aktif");
    }
    let password = current.password;
    if (typeof body.password === "string" && body.password.length) {
      try {
        password = await passwordHash(body.password);
      } catch (e) {
        fail(400, e.message);
      }
    }
    try {
      await db.transaction(async (tx) => {
        await tx.run(
          "UPDATE users SET email=?,name=?,password=?,role=?,field=?,active=? WHERE id=?",
          [
            email,
            text(body.name, 120),
            password,
            role,
            field,
            active,
            current.id,
          ],
        );
        if (!active)
          await tx.run("DELETE FROM sessions WHERE user_id=?", [current.id]);
      });
    } catch (e) {
      if (
        e.errcode === 2067 ||
        e.code === "SQLITE_CONSTRAINT_UNIQUE" ||
        e.code === "ER_DUP_ENTRY"
      )
        fail(409, "Email sudah digunakan");
      throw e;
    }
    return send({
      message: active ? "Perubahan akun tersimpan." : "Akun dinonaktifkan.",
    });
  }

  return false;
}
