import "server-only";
import { SignJWT, jwtVerify } from "jose";

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

/** Token verifikasi identitas pendaftar untuk daftar ulang mandiri — berumur pendek, dipakai
 * supaya endpoint submit tidak menerima admissionId mentah dari client (hindari IDOR). */
export async function signAdmissionToken(admissionId: string) {
  return new SignJWT({ admissionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(encodedKey);
}

export async function verifyAdmissionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return typeof payload.admissionId === "string" ? payload.admissionId : null;
  } catch {
    return null;
  }
}
