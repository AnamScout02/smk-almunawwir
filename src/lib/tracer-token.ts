import "server-only";
import { SignJWT, jwtVerify } from "jose";

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

/** Token verifikasi identitas alumni untuk isi form Tracer Study mandiri — berumur pendek,
 * dipakai supaya endpoint submit tidak menerima studentId mentah dari client (hindari IDOR). */
export async function signTracerToken(studentId: string) {
  return new SignJWT({ studentId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(encodedKey);
}

export async function verifyTracerToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return typeof payload.studentId === "string" ? payload.studentId : null;
  } catch {
    return null;
  }
}
