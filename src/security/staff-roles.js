import { fail } from "../shared/validation.js";
export const safeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  field: u.field,
  active: Number(u.active) !== 0,
});
const staffRoles = [
  "admin",
  "operator",
  "kabid",
  "petugas",
  "pimpinan",
  "sekretaris",
];
const staffFields = [
  "umum",
  "rehabsos",
  "linjamsos",
  "anak",
  "perempuan",
  "sekretariat",
];
export function staffAssignment(role, field) {
  if (!staffRoles.includes(role) || !staffFields.includes(field))
    fail(400, "Peran atau bidang tidak valid");
  if (["admin", "pimpinan"].includes(role) && field !== "umum")
    fail(400, "Admin dan pimpinan harus ditempatkan pada Umum");
  if (
    role === "operator" &&
    !["sekretariat", "rehabsos", "linjamsos", "anak", "perempuan"].includes(
      field,
    )
  )
    fail(
      400,
      "Operator harus ditempatkan pada Sekretariat atau salah satu dari empat bidang",
    );
  if (role === "sekretaris" && field !== "sekretariat")
    fail(400, "Akun Sekretaris harus ditempatkan pada Sekretariat");
  if (role === "petugas" && !["anak", "perempuan"].includes(field))
    fail(400, "Petugas hanya untuk Bidang Anak atau Perempuan");
  if (
    role === "kabid" &&
    !["rehabsos", "linjamsos", "anak", "perempuan"].includes(field)
  )
    fail(400, "Kepala bidang harus ditempatkan pada salah satu bidang layanan");
}
