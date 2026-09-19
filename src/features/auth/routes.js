import { randomUUID } from "node:crypto";
import { fail, text } from "../../shared/validation.js";
import {
  token,
  hash,
  passwordHash,
  verifyPassword,
} from "../../security/access.js";
import { safeUser } from "../../security/staff-roles.js";

export async function handleAuth({
  db,
  route,
  method,
  body,
  user,
  auth,
  send,
  res,
  now,
  cookie,
  session,
  production,
}) {
  if (route === "/api/register" && method === "POST") {
    const email = text(body.email, 180).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail(400, "Email tidak valid");
    let password;
    try {
      password = await passwordHash(body.password);
    } catch (e) {
      fail(400, e.message);
    }
    if ((await db.all("SELECT id FROM users WHERE email=?", [email])).length)
      fail(409, "Email tidak dapat digunakan");
    await db.run(
      "INSERT INTO users (id,email,name,password,role,field) VALUES (?,?,?,?,?,?)",
      [
        randomUUID(),
        email,
        text(body.name, 120),
        password,
        "masyarakat",
        "umum",
      ],
    );
    return send({ message: "Akun dibuat. Silakan masuk." }, 201);
  }
  if (route === "/api/login" && method === "POST") {
    const [u] = await db.all("SELECT * FROM users WHERE email=?", [
      text(body.email, 180).toLowerCase(),
    ]);
    const dummy = "00000000000000000000000000000000:" + "00".repeat(64);
    const valid = await verifyPassword(body.password, u?.password || dummy);
    if (!u || Number(u.active) === 0 || !valid)
      fail(401, "Email atau kata sandi salah");
    if (cookie) await db.run("DELETE FROM sessions WHERE id=?", [hash(cookie)]);
    const sid = token(),
      csrf = token();
    await db.run("DELETE FROM sessions WHERE expires<?", [now]);
    await db.run(
      "INSERT INTO sessions (id,user_id,csrf,expires) VALUES (?,?,?,?)",
      [hash(sid), u.id, csrf, now + 8 * 3600000],
    );
    res.setHeader(
      "Set-Cookie",
      "sid=" +
        sid +
        "; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800" +
        (production ? "; Secure" : ""),
    );
    return send({ user: safeUser(u), csrf });
  }
  if (route === "/api/me" && method === "GET")
    return send({
      user: user ? safeUser(user) : null,
      csrf: session?.csrf || null,
    });
  if (route === "/api/logout" && method === "POST") {
    auth();
    await db.run("DELETE FROM sessions WHERE id=?", [hash(cookie)]);
    res.setHeader(
      "Set-Cookie",
      "sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" +
        (production ? "; Secure" : ""),
    );
    return send({ ok: true });
  }

  return false;
}
