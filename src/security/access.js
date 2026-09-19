import {
  scrypt as scryptCb,
  randomBytes,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCb);
export const token = () => randomBytes(32).toString("hex");
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export async function passwordHash(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 200
  )
    throw Error("Kata sandi harus 12–200 karakter");
  const salt = randomBytes(16).toString("hex");
  return (
    salt + ":" + Buffer.from(await scrypt(password, salt, 64)).toString("hex")
  );
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || password.length > 200) return false;
  const [salt, digest] = encoded.split(":");
  return timingSafeEqual(
    Buffer.from(await scrypt(password, salt, 64)),
    Buffer.from(digest, "hex"),
  );
}
export function mayRead(user, app) {
  if (user.role === "masyarakat") return app.owner_id === user.id;
  if (app.status === "draf") return false;
  if (app.field !== user.field) return false;
  return app.kind === "laporan"
    ? ["petugas", "kabid"].includes(user.role)
    : ["operator", "kabid"].includes(user.role);
}
export function nextAllowed(role, kind, current, next) {
  const flow =
    kind === "laporan"
      ? {
          petugas: { diajukan: ["ditangani"], ditangani: ["selesai"] },
          kabid: { diajukan: ["ditangani"], ditangani: ["selesai"] },
        }
      : {
          operator: {
            diajukan: ["diverifikasi"],
            diverifikasi: ["perbaikan", "menunggu_kabid"],
            disetujui: ["direalisasikan"],
          },
          kabid: { menunggu_kabid: ["disetujui", "ditolak"] },
          masyarakat: { perbaikan: ["diajukan"] },
        };
  return flow[role]?.[current]?.includes(next) || false;
}
