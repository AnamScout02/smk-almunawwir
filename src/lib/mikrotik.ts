import "server-only";
import { RouterOSAPI } from "node-routeros";
import { setelanRouter } from "@/lib/router-setelan";

export type MikrotikRow = Record<string, string>;

/** Buka koneksi ke Mikrotik, jalankan fn, lalu selalu tutup koneksinya (sukses maupun gagal).
 *
 * PENTING: RouterOSAPI adalah EventEmitter — kegagalan socket/parser (mis. koneksi putus di
 * tengah, balasan tak dikenal) bisa muncul sebagai event 'error' di luar alur promise connect()/
 * write(). Tanpa listener, Node memperlakukan itu sebagai uncaughtException yang menggantung
 * request (frontend loading selamanya) alih-alih mengembalikan response error yang wajar. Karena
 * itu 'error' WAJIB di-listen dan direlai lewat errorPromise yang di-race melawan fn(conn). */
export async function withMikrotik<T>(fn: (conn: RouterOSAPI) => Promise<T>): Promise<T> {
  /* Alamat/port/pengguna/sandi boleh diisi petugas dari halaman Jaringan & Layar → Setelan Router;
   * `.env` tinggal menjadi cadangan (src/lib/router-setelan.ts, 27 September 2026). */
  const { host, port, user, sandi } = await setelanRouter();
  if (!host || !user || !sandi) {
    throw new Error("Sambungan router belum diatur — isi di halaman Jaringan & Layar → Setelan Router.");
  }

  const conn = new RouterOSAPI({ host, port, user, password: sandi, timeout: 10 });

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
