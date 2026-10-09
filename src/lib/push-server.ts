import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/** NOTIFIKASI PUSH (Web Push) — gratis, tanpa layanan pihak ketiga berbayar. Pasangan: public/sw.js (event
 * `push` & `notificationclick`), src/lib/push-client.ts (berlangganan di browser), /api/push (simpan
 * langganan), src/lib/pengingat-terjadwal.ts (pengingat berkala).
 *
 * Aturan pakai:
 *   - Selalu beri `kunci` yang stabil untuk satu kejadian (mis. `tugas:<id>`). Kunci yang sama TIDAK PERNAH
 *     terkirim dua kali — aman dipanggil ulang dari penjadwal maupun route yang bisa disimpan berulang.
 *   - Dari route API panggil dengan `void kirimNotifikasi(...)` SETELAH data tersimpan: kegagalan push
 *     tidak boleh menggagalkan simpan, dan pengguna tidak boleh menunggu pengiriman.
 *   - Browser hanya menerima push dari alamat HTTPS (situs dibuka lewat alamat aman), dan di iPhone hanya
 *     kalau aplikasi sudah dipasang ke layar utama. */

export type JenisNotifikasi =
  | "ABSENSI_BELUM" | "PIKET_BELUM" | "JURNAL_BELUM" | "UJIAN_MULAI" | "TUGAS_BARU"
  | "ANAK_ALPHA" | "POIN_PELANGGARAN" | "POIN_PRESTASI" | "ALPHA_BERUNTUN" | "PERINGATAN_DINI" | "PERPUS_JATUH_TEMPO" | "PERPUS_TERLAMBAT" | "PERPUS_RESERVASI" | "IZIN_SISWA" | "REKAP_HARIAN_KELAS" | "PENGUMUMAN" | "KONSELING" | "SARPRAS" | "UKS" | "TUGAS_INTERNAL" | "KEGIATAN" | "MASUKAN_REKAN" | "IZIN_KELUAR" | "SPMB" | "PKL" | "UJI";

export interface IsiNotifikasi {
  userIds: string[];
  jenis: JenisNotifikasi;
  judul: string;
  isi: string;
  url?: string;
  /** Penjaga idempotensi. Tanpa kunci notifikasi selalu dikirim (hanya untuk uji manual). */
  kunci?: string;
  /** Notifikasi dengan tag sama menggantikan yang lama di layar perangkat (bukan menumpuk). */
  tag?: string;
  /** Pengingat yang dikirim beberapa kali sehari (absensi/piket/jurnal): entri KOTAK NOTIFIKASI dengan jenis & judul sama
   * dari hari ini (WIB) diganti yang terbaru, bukan menumpuk. Push ke perangkat tetap dikirim tiap jadwal. */
  gantiHariIni?: boolean;
}

let siap: boolean | null = null;
function konfigurasi() {
  if (siap !== null) return siap;
  const publik = process.env.VAPID_PUBLIC_KEY;
  const privat = process.env.VAPID_PRIVATE_KEY;
  if (!publik || !privat) return (siap = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:smkalmunawwir@gmail.com", publik, privat);
  return (siap = true);
}

export const kunciPublikVapid = () => process.env.VAPID_PUBLIC_KEY ?? null;
export const pushTersedia = () => konfigurasi();

export async function kirimNotifikasi(n: IsiNotifikasi): Promise<{ terkirim: boolean; perangkat: number; alasan?: string }> {
  const userIds = [...new Set(n.userIds.filter(Boolean))];
  if (!userIds.length) return { terkirim: false, perangkat: 0, alasan: "tanpa penerima" };
  let logId: string | null = null;
  try {
    const log = await prisma.notifikasiTerkirim.create({
      data: {
        kunci: n.kunci ?? `tanpa-kunci:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        jenis: n.jenis, judul: n.judul, isi: n.isi, url: n.url ?? null, jumlahPenerima: userIds.length,
      },
      select: { id: true },
    });
    logId = log.id;
  } catch (e) {
    // P2002 = kunci sudah pernah terkirim → berhenti dengan tenang.
    if ((e as { code?: string }).code === "P2002") return { terkirim: false, perangkat: 0, alasan: "sudah pernah dikirim" };
    throw e;
  }

  // Kotak notifikasi di aplikasi — sampai ke SEMUA penerima, termasuk yang belum mengaktifkan push di perangkat.
  if (logId) {
    const id = logId;
    if (n.gantiHariIni) {
      const awalHariWib = new Date(Math.floor((Date.now() + 7 * 3600_000) / 86400_000) * 86400_000 - 7 * 3600_000);
      await prisma.notifikasiPengguna.deleteMany({
        where: { userId: { in: userIds }, notifikasiId: { not: id }, notifikasi: { jenis: n.jenis, judul: n.judul, createdAt: { gte: awalHariWib } } },
      }).catch(() => null);
    }
    await prisma.notifikasiPengguna.createMany({ data: userIds.map(userId => ({ userId, notifikasiId: id })), skipDuplicates: true }).catch(() => null);
  }
  if (!konfigurasi()) return { terkirim: false, perangkat: 0, alasan: "VAPID belum dikonfigurasi" };

  const langganan = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  const muatan = JSON.stringify({ judul: n.judul, isi: n.isi, url: n.url ?? "/login", tag: n.tag ?? n.jenis });
  let berhasil = 0;
  const kedaluwarsa: string[] = [];

  await Promise.all(langganan.map(async l => {
    try {
      await webpush.sendNotification(
        { endpoint: l.endpoint, keys: { p256dh: l.p256dh, auth: l.auth } },
        muatan,
        { TTL: 12 * 60 * 60, urgency: "normal", timeout: 10_000 },
      );
      berhasil++;
    } catch (e) {
      const kode = (e as { statusCode?: number }).statusCode;
      if (kode === 404 || kode === 410) kedaluwarsa.push(l.id); // langganan dicabut / aplikasi dihapus
    }
  }));

  await Promise.all([
    kedaluwarsa.length ? prisma.pushSubscription.deleteMany({ where: { id: { in: kedaluwarsa } } }) : null,
    berhasil ? prisma.pushSubscription.updateMany({
      where: { id: { in: langganan.filter(l => !kedaluwarsa.includes(l.id)).map(l => l.id) } },
      data: { lastUsedAt: new Date() },
    }) : null,
    logId ? prisma.notifikasiTerkirim.update({ where: { id: logId }, data: { jumlahPerangkat: berhasil } }) : null,
  ]);
  return { terkirim: berhasil > 0, perangkat: berhasil };
}

/** userId orang tua dari daftar siswa (lewat ParentStudent), dikelompokkan per siswa. */
export async function orangTuaDari(studentIds: string[]) {
  const baris = await prisma.parentStudent.findMany({
    where: { studentId: { in: [...new Set(studentIds)] } },
    select: { studentId: true, parent: { select: { userId: true } } },
  });
  const peta = new Map<string, string[]>();
  for (const b of baris) peta.set(b.studentId, [...(peta.get(b.studentId) ?? []), b.parent.userId]);
  return peta;
}

/** Jalankan tanpa menunggu & tanpa melempar galat — untuk kait di route API setelah data tersimpan. */
export function kirimLatar(tugas: () => Promise<unknown>) {
  void tugas().catch(() => {});
}
