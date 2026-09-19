import { openDB, initialize } from "./database/index.js";
import { passwordHash } from "./security/access.js";
import { randomUUID } from "node:crypto";
const db = await openDB();
try {
  await initialize(db);
  if (process.argv[2] === "init")
    console.log("Database siap. Semua program masih tertutup.");
  else if (process.argv[2] === "user") {
    const [email, name, role, field = "umum"] = process.argv.slice(3);
    if (
      !email ||
      !name ||
      ![
        "admin",
        "operator",
        "kabid",
        "petugas",
        "pimpinan",
        "sekretaris",
      ].includes(role)
    )
      throw Error(
        'Format: npm run user -- email "Nama" role field. Set INITIAL_PASSWORD melalui environment.',
      );
    if (
      ["kabid", "petugas"].includes(role) &&
      !["rehabsos", "linjamsos", "anak", "perempuan"].includes(field)
    )
      throw Error("Bidang tidak valid");
    if (
      role === "operator" &&
      !["sekretariat", "rehabsos", "linjamsos", "anak", "perempuan"].includes(
        field,
      )
    )
      throw Error("Penempatan operator tidak valid");
    if (role === "sekretaris" && field !== "sekretariat")
      throw Error("Gunakan bidang sekretariat untuk akun Sekretaris");
    if (role === "petugas" && !["anak", "perempuan"].includes(field))
      throw Error("Peran tidak sesuai bidang");
    await db.run(
      "INSERT INTO users (id,email,name,password,role,field) VALUES (?,?,?,?,?,?)",
      [
        randomUUID(),
        email.toLowerCase(),
        name,
        await passwordHash(process.env.INITIAL_PASSWORD),
        role,
        field,
      ],
    );
    console.log("Akun berhasil dibuat. Kata sandi tidak ditampilkan.");
  } else throw Error("Gunakan init atau user");
} finally {
  await db.close();
}
