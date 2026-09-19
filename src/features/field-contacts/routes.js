import { fail } from "../../shared/validation.js";

export async function handleFieldContacts({
  db,
  route,
  method,
  body,
  user,
  auth,
  send,
  now,
}) {
  if (route === "/api/field-contacts" && method === "GET")
    return send(await db.all("SELECT * FROM field_contacts ORDER BY field"));
  const fieldContactMatch = route.match(
    /^\/api\/field-contacts\/(rehabsos|linjamsos|anak|perempuan)$/,
  );
  if (fieldContactMatch && method === "PATCH") {
    auth();
    if (user.role !== "admin")
      fail(403, "Hanya admin dapat mengatur kontak dan jadwal bidang");
    const optional = (key, max) => {
      const value = body[key];
      if (typeof value !== "string" || value.length > max)
        fail(400, "Isian " + key + " tidak valid atau terlalu panjang");
      return value.trim();
    };
    const name = optional("contact_name", 120),
      phone = optional("phone", 30),
      email = optional("email", 180),
      schedule = optional("schedule", 3000);
    if (
      phone &&
      (!/^\+?[0-9 ()-]+$/.test(phone) ||
        phone.replace(/\D/g, "").length < 7 ||
        phone.replace(/\D/g, "").length > 15)
    )
      fail(400, "Nomor telepon tidak valid");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail(400, "Alamat surel tidak valid");
    if (!Number.isSafeInteger(body.revision) || body.revision < 0)
      fail(400, "Revisi tidak valid");
    const revision = Math.max(now, body.revision + 1);
    if (
      !(await db.run(
        "UPDATE field_contacts SET contact_name=?,phone=?,email=?,schedule=?,revision=? WHERE field=? AND revision=?",
        [
          name,
          phone,
          email,
          schedule,
          revision,
          fieldContactMatch[1],
          body.revision,
        ],
      ))
    )
      fail(
        409,
        "Data telah berubah. Muat ulang pengaturan bidang sebelum menyimpan.",
      );
    return send({ ok: true, revision });
  }

  return false;
}
