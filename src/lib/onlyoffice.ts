import "server-only";
import { SignJWT, jwtVerify } from "jose";

const secretKey = () => new TextEncoder().encode(process.env.ONLYOFFICE_JWT_SECRET || "");

/** Tandatangani seluruh config editor sebagai JWT — wajib karena JWT_ENABLED=true di
 * ONLYOFFICE Document Server (lihat docker-compose.yml). Token ditaruh sebagai field
 * `token` di object config yang sama yang dikirim ke `new DocsAPI.DocEditor(...)`. */
export async function signOnlyofficeConfig(config: Record<string, unknown>): Promise<string> {
  return new SignJWT(config).setProtectedHeader({ alg: "HS256" }).sign(secretKey());
}

/** Verifikasi token JWT yang dikirim ONLYOFFICE Document Server saat callback simpan dokumen —
 * mencegah orang lain memalsukan request "dokumen sudah diedit" ke endpoint callback kita. */
export async function verifyOnlyofficeToken(token: string): Promise<Record<string, unknown>> {
  const { payload } = await jwtVerify(token, secretKey());
  return payload;
}

export function onlyofficeInternalUrl(): string {
  return process.env.ONLYOFFICE_INTERNAL_URL || "http://onlyoffice";
}

export function appInternalUrl(): string {
  return process.env.APP_INTERNAL_URL || "http://localhost:3000";
}
