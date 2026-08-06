import "server-only";
import { RouterOSAPI } from "node-routeros";

export type MikrotikRow = Record<string, string>;

/** Buka koneksi ke Mikrotik, jalankan fn, lalu selalu tutup koneksinya (sukses maupun gagal).
 *
 * PENTING: RouterOSAPI adalah EventEmitter — kegagalan socket/parser (mis. koneksi putus di
 * tengah, balasan tak dikenal) bisa muncul sebagai event 'error' di luar alur promise connect()/
 * write(). Tanpa listener, Node memperlakukan itu sebagai uncaughtException yang menggantung
 * request (frontend loading selamanya) alih-alih mengembalikan response error yang wajar. Karena
 * itu 'error' WAJIB di-listen dan direlai lewat errorPromise yang di-race melawan fn(conn). */
export async function withMikrotik<T>(fn: (conn: RouterOSAPI) => Promise<T>): Promise<T> {
  const host = process.env.MIKROTIK_HOST;
  const user = process.env.MIKROTIK_USER;
  const password = process.env.MIKROTIK_PASSWORD;
  if (!host || !user || !password) {
    throw new Error("Konfigurasi Mikrotik belum diatur (MIKROTIK_HOST/USER/PASSWORD).");
  }

  const conn = new RouterOSAPI({
    host,
    port: Number(process.env.MIKROTIK_PORT) || 8728,
    user,
    password,
    timeout: 10,
  });

  let errorReject: ((e: Error) => void) | null = null;
  const errorPromise = new Promise<never>((_, reject) => { errorReject = reject; });
  const onError = (e: Error) => errorReject?.(e instanceof Error ? e : new Error(String(e)));
  conn.on("error", onError);

  try {
    await Promise.race([conn.connect(), errorPromise]);
    return await Promise.race([fn(conn), errorPromise]);
  } finally {
    conn.off("error", onError);
    if (conn.connected) await conn.close().catch(() => {});
  }
}
