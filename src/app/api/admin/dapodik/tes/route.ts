import { verifyDapodikAccess } from "@/lib/dapodik-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { panggilDapodik } from "@/lib/dapodik";

export const dynamic = "force-dynamic";

const teksPertama = (o: Record<string, unknown>, ...kunci: string[]) => {
  for (const k of kunci) { const v = o[k]; if (typeof v === "string" && v.trim()) return v.trim(); }
  return null;
};

/** TES KONEKSI Dapodik — memanggil getSekolah SEKALI. Dibatasi 3 kali per menit untuk seluruh sekolah supaya tidak
 * membanjiri Web Service (dan tidak dipakai untuk mencoba-coba kunci). Hasilnya dicatat di Log Aktivitas. */
export async function POST() {
  // Penjaga SAMA dengan halamannya — Administrator, Operator Sekolah, dan staf Tata Usaha.
  const { session } = await verifyDapodikAccess();
  if (!checkRateLimit("dapodik-tes", 3, 60_000)) {
    return Response.json({ error: "Tes koneksi dibatasi 3 kali per menit — tunggu sebentar lalu coba lagi." }, { status: 429 });
  }

  const h = await panggilDapodik<Record<string, unknown>>("getSekolah");
  // getSekolah mengirim `rows` sebagai OBJEK (satu sekolah), endpoint daftar mengirim array — terima keduanya.
  const rows = h.data?.rows;
  const baris = (Array.isArray(rows) ? rows[0] : rows && typeof rows === "object" ? rows : h.data) as Record<string, unknown> | null | undefined;
  const sekolah = baris && typeof baris === "object" ? {
    nama: teksPertama(baris, "nama", "nama_sekolah"),
    npsn: teksPertama(baris, "npsn"),
    alamat: teksPertama(baris, "alamat_jalan", "alamat"),
    kecamatan: teksPertama(baris, "kecamatan"),
    kabupaten: teksPertama(baris, "kabupaten_kota", "kabupaten"),
    status: teksPertama(baris, "status_sekolah"),
  } : null;

  await logActivity(session, {
    action: "TES_DAPODIK", entity: "Dapodik", entityId: "getSekolah",
    description: `Tes koneksi Web Service Dapodik: ${h.ok ? "berhasil" : `gagal (${h.http || "tanpa jawaban"}) — ${h.pesan}`}`,
  }).catch(() => {});

  return Response.json({ ok: h.ok, http: h.http, pesan: h.pesan, sekolah, diperiksa: new Date().toISOString() });
}
