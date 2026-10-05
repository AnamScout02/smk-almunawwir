import "server-only";
import { createHash } from "crypto";
import { getSettings } from "@/lib/site-settings";
import { susunKonfigSeb } from "@/lib/seb-konfig";

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

const cocok = (urls: string[], kunci: string, kiriman: string | null) =>
  !!kiriman && urls.some(url => createHash("sha256").update(url + kunci).digest("hex").toLowerCase() === kiriman.trim().toLowerCase());

/** URL yang DILIHAT SEB. Di belakang Caddy, `req.url` di Next standalone berbentuk
 *  `http://<hostname>:3000/…` — bukan `https://smkalmunawwiriibs.sch.id/…` yang di-hash SEB, sehingga
 *  kunci yang benar pun selalu ditolak (bug 4 Okt 2026). Disusun ulang dari X-Forwarded-Proto + Host;
 *  `req.url` tetap dicoba sebagai cadangan (akses langsung :3000 di jaringan sekolah). */
export function urlDilihatSeb(req: Request): string[] {
  const u = new URL(req.url);
  const proto = (req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "")).split(",")[0].trim();
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host).split(",")[0].trim();
  const jalur = `${u.pathname}${u.search}`;
  const daftar = [`${proto}://${host}${jalur}`, req.url];
  // Host tanpa port bawaan & dengan port bawaan sama-sama mungkin muncul di header.
  if (/:(443|80)$/.test(host)) daftar.push(`${proto}://${host.replace(/:(443|80)$/, "")}${jalur}`);
  return [...new Set(daftar)];
}

/** Config Key dari berkas .seb yang DIBANGKITKAN situs (src/lib/seb-konfig.ts) — hanya dipakai
 *  mengunci bila nilainya pernah terbukti cocok dengan SEB sungguhan (`ujian.sebCkTerverifikasi`). */
async function kunciOtomatis() {
  const s = await getSettings(["ujian.pinAplikasi", "ujian.sebCkTerverifikasi"]).catch(() => ({} as Record<string, string>));
  const { configKey } = susunKonfigSeb(s["ujian.pinAplikasi"] ?? "");
  return { configKey, terverifikasi: !!s["ujian.sebCkTerverifikasi"] && s["ujian.sebCkTerverifikasi"] === configKey };
}

/** Diagnosa untuk halaman /seb-uji: apakah permintaan ini datang dari SEB, dan kunci mana yang cocok.
 *  Bila Config Key otomatis cocok, itu sekaligus BUKTI algoritmanya benar → dicatat terverifikasi. */
export async function ujiSeb(req: Request) {
  const urls = urlDilihatSeb(req);
  const rh = req.headers.get("x-safeexambrowser-requesthash");
  const ch = req.headers.get("x-safeexambrowser-configkeyhash");
  const s = await getSettings(["ujian.sebKunci", "ujian.sebConfigKey"]).catch(() => ({} as Record<string, string>));
  const oto = await kunciOtomatis();
  const cocokOto = cocok(urls, oto.configKey, ch);
  return {
    adaSeb: !!(rh || ch) || /SEB\//.test(req.headers.get("user-agent") ?? ""),
    adaHeader: !!(rh || ch),
    cocokOtomatis: cocokOto,
    cocokBek: !!s["ujian.sebKunci"]?.trim() && cocok(urls, s["ujian.sebKunci"].trim(), rh),
    cocokCkManual: !!s["ujian.sebConfigKey"]?.trim() && cocok(urls, s["ujian.sebConfigKey"].trim(), ch),
    sudahTerverifikasi: oto.terverifikasi,
    configKey: oto.configKey,
  };
}

/** Periksa header SEB pada satu permintaan. */
export async function periksaSeb(req: Request): Promise<HasilSeb> {
  const s = await getSettings(["ujian.sebKunci", "ujian.sebConfigKey"]).catch(() => ({} as Record<string, string>));
  const bek = (s["ujian.sebKunci"] ?? "").trim();
  const ck = (s["ujian.sebConfigKey"] ?? "").trim();
  const oto = await kunciOtomatis();
  const ckOto = oto.terverifikasi ? oto.configKey : "";
  if (!bek && !ck && !ckOto) {
    return { ok: true, belumDiatur: true, alasan: "Safe Exam Browser belum diuji di komputer lab — pemeriksaan dilewati." };
  }
  const urls = urlDilihatSeb(req);
  const rh = req.headers.get("x-safeexambrowser-requesthash");
  const ch = req.headers.get("x-safeexambrowser-configkeyhash");
  if (!rh && !ch) {
    return { ok: false, belumDiatur: false, alasan: "Ujian ini hanya bisa dibuka lewat Safe Exam Browser." };
  }
  if ((bek && cocok(urls, bek, rh)) || (ck && cocok(urls, ck, ch)) || (ckOto && cocok(urls, ckOto, ch))) {
    return { ok: true, belumDiatur: false, alasan: "Safe Exam Browser terverifikasi." };
  }
  return { ok: false, belumDiatur: false, alasan: "Safe Exam Browser terdeteksi tetapi konfigurasinya berbeda — unduh ulang berkas .seb terbaru dari Pengaturan Ujian." };
}
