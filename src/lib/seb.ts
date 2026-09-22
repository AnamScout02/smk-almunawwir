import "server-only";
import { createHash } from "crypto";
import { getSettings } from "@/lib/site-settings";

/** SAFE EXAM BROWSER (20 September 2026).
 *
 * Halaman web TIDAK BISA mengunci perangkat: Alt-Tab, tombol Home, dan menutup aplikasi berada di
 * luar jangkauan JavaScript mana pun — itu batas keamanan browser, bukan kekurangan kode. SEB
 * mengunci di level sistem operasi, dan inilah satu-satunya cara "terkunci" yang sungguhan tanpa
 * menulis aplikasi sendiri.
 *
 * Cara SEB membuktikan dirinya: tiap permintaan diberi header
 *   X-SafeExamBrowser-RequestHash   = SHA256(URL lengkap + Browser Exam Key)
 *   X-SafeExamBrowser-ConfigKeyHash = SHA256(URL lengkap + Config Key)
 * Server menghitung ulang dan membandingkan. Karena kunci tidak pernah dikirim, header ini tidak
 * bisa dipalsukan hanya dengan menyalin URL.
 *
 * PENTING — Browser Exam Key TIDAK DIBANGKITKAN SERVER INI. Ia keluar dari SEB Configuration Tool
 * di komputer sekolah saat berkas konfigurasi `.seb` dibuat, lalu ditempelkan Administrator ke
 * SiteSetting `ujian.sebKunci`. Config Key (`ujian.sebConfigKey`) opsional; bila diisi, salah satu
 * dari keduanya sudah cukup — SEB versi lama hanya mengirim RequestHash.
 *
 * Kalau kuncinya BELUM diisi, ujian ber-`wajibSeb` TIDAK dikunci mati — permintaan tetap diterima
 * dan alasannya dilaporkan. Mengunci pintu sebelum kuncinya ada hanya membuat sekolah tidak bisa
 * ujian sama sekali. */

export interface HasilSeb {
  ok: boolean;
  /** Kenapa ditolak/diterima — dipakai untuk pesan ke siswa & catatan pengawas. */
  alasan: string;
  /** true bila kunci belum diisi Administrator (jadi pemeriksaan dilewati). */
  belumDiatur: boolean;
}

const cocok = (url: string, kunci: string, kiriman: string | null) =>
  !!kiriman && createHash("sha256").update(url + kunci).digest("hex").toLowerCase() === kiriman.trim().toLowerCase();

/** Periksa header SEB pada satu permintaan. `url` HARUS URL lengkap seperti yang dilihat SEB. */
export async function periksaSeb(req: Request): Promise<HasilSeb> {
  const s = await getSettings(["ujian.sebKunci", "ujian.sebConfigKey"]).catch(() => ({} as Record<string, string>));
  const bek = (s["ujian.sebKunci"] ?? "").trim();
  const ck = (s["ujian.sebConfigKey"] ?? "").trim();
  if (!bek && !ck) {
    return { ok: true, belumDiatur: true, alasan: "Kunci Safe Exam Browser belum diisi Administrator — pemeriksaan dilewati." };
  }
  // SEB menghitung hash dari URL LENGKAP yang diminta, termasuk skema, host, path, dan query.
  const url = req.url;
  const rh = req.headers.get("x-safeexambrowser-requesthash");
  const ch = req.headers.get("x-safeexambrowser-configkeyhash");
  if (!rh && !ch) {
    return { ok: false, belumDiatur: false, alasan: "Ujian ini hanya bisa dibuka lewat Safe Exam Browser." };
  }
  if ((bek && cocok(url, bek, rh)) || (ck && cocok(url, ck, ch))) {
    return { ok: true, belumDiatur: false, alasan: "Safe Exam Browser terverifikasi." };
  }
  return { ok: false, belumDiatur: false, alasan: "Safe Exam Browser terdeteksi tetapi kuncinya tidak cocok — konfigurasi di komputer ini berbeda dengan yang didaftarkan sekolah." };
}
