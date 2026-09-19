import { randomUUID } from "node:crypto";
import { mayRead } from "../../security/access.js";
import { fail } from "../../shared/validation.js";
export function applicationService(db) {
  async function findApp(id, user) {
    const [app] = await db.all("SELECT * FROM applications WHERE id=?", [id]);
    if (!app || !mayRead(user, app)) fail(404, "Pengajuan tidak ditemukan");
    return app;
  }
  async function audit(id, u, action, note, store = db) {
    await store.run(
      "INSERT INTO audits (id,application_id,actor,action,note,created) VALUES (?,?,?,?,?,?)",
      [randomUUID(), id, u.id, action, note, Date.now()],
    );
  }

  return { findApp, audit };
}
