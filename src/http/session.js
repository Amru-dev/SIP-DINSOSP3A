import { hash } from "../security/access.js";
import { fail } from "../shared/validation.js";
export async function requestSession(req, { db, now, method }) {
  const cookie = String(req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("sid="))
    ?.slice(4);
  const [session] = cookie
    ? await db.all("SELECT * FROM sessions WHERE id=? AND expires>?", [
        hash(cookie),
        now,
      ])
    : [];
  const [sessionUser] = session
    ? await db.all("SELECT * FROM users WHERE id=?", [session.user_id])
    : [];
  const user =
    sessionUser && Number(sessionUser.active) !== 0 ? sessionUser : null;
  const auth = () => {
    if (!user) fail(401, "Silakan masuk terlebih dahulu");
    return user;
  };
  if (
    session &&
    !["GET", "HEAD"].includes(method) &&
    req.headers["x-csrf-token"] !== session.csrf
  )
    fail(403, "Token keamanan tidak valid");
  return { cookie, session, user, auth };
}
