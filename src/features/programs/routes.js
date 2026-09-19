import { fail, text } from "../../shared/validation.js";

export async function handlePrograms({
  db,
  route,
  method,
  body,
  user,
  auth,
  send,
}) {
  if (route === "/api/programs" && method === "GET") {
    const rows = await db.all("SELECT * FROM programs ORDER BY field,name");
    return send(
      rows.map((p) => ({
        ...p,
        requirements: JSON.parse(p.requirements),
        is_open: p.kind === "laporan" ? 0 : p.is_open,
      })),
    );
  }
  const programMatch = route.match(/^\/api\/programs\/([\w-]+)$/);
  if (programMatch && method === "PATCH") {
    auth();
    if (user.role !== "admin") fail(403, "Hanya admin dapat mengatur program");
    const [p] = await db.all("SELECT * FROM programs WHERE id=?", [
      programMatch[1],
    ]);
    if (!p) fail(404, "Program tidak ditemukan");
    const reqs = body.requirements;
    if (!Array.isArray(reqs) || reqs.length > 10)
      fail(400, "Maksimal 10 persyaratan");
    const cleaned = reqs.map((x) => text(x, 120));
    if (new Set(cleaned).size !== cleaned.length)
      fail(400, "Persyaratan duplikat");
    const isOpen = body.is_open === true ? 1 : 0;
    if (p.kind === "laporan" && isOpen)
      fail(
        409,
        "Pelaporan kasus belum diaktifkan. Perlu review keamanan dan SOP.",
      );
    if (isOpen && !cleaned.length)
      fail(
        400,
        "Tetapkan minimal satu persyaratan resmi sebelum membuka program",
      );
    await db.run(
      "UPDATE programs SET description=?, requirements=?, is_open=? WHERE id=?",
      [text(body.description, 4000), JSON.stringify(cleaned), isOpen, p.id],
    );
    return send({ ok: true });
  }

  return false;
}
