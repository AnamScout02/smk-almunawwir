import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, pakaiSecure } from "@/lib/session";
import { sesiMasihHidup } from "@/lib/sesi-server";
import { isoWib, jendelaSekarang, tokenSah } from "@/lib/kegiatan-qr";
import { hadirkanAbsensiHarian } from "@/lib/absensi-otomatis";

export const dynamic = "force-dynamic";

const alihkan = (ke: string) => new NextResponse(null, { status: 307, headers: { Location: ke } });
const hasil = (status: string, pesan: string, judul = "") => alihkan(`/hadir/hasil?s=${status}&p=${encodeURIComponent(pesan)}${judul ? `&k=${encodeURIComponent(judul)}` : ""}`);

/** Tujuan QR presensi kegiatan. Belum masuk → titip tautan lalu ke /login (lihat ambilLanjut di actions/auth.ts). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const idAman = /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : "";
  const tAman = /^\d{1,12}\.[A-Za-z0-9_-]{1,32}$/.test(t) ? t : "";
  if (!idAman || !tAman) return hasil("gagal", "Tautan presensi tidak lengkap. Pindai ulang QR di layar.");
  const s = await getSession().catch(() => null);
  const hidup = s?.sid ? await sesiMasihHidup(s.sid).catch(() => false) : false;
  if (!s?.userId || !hidup) {
    const res = alihkan("/login");
    res.cookies.set("lanjut_masuk", `/hadir/${idAman}?t=${tAman}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: pakaiSecure(req.headers) });
    return res;
  }
  const k = await prisma.kegiatan.findUnique({ where: { id: idAman }, select: { id: true, judul: true, mulai: true, selesai: true, sampaiTanggal: true } });
  if (!k) return hasil("gagal", "Kegiatan tidak ditemukan.");
  if (!tokenSah(k.id, tAman)) return hasil("gagal", "QR sudah kedaluwarsa. Pindai QR terbaru yang tampil di layar.", k.judul);
  // Kegiatan berhari-hari: jendela dihitung PER HARI, dan kehadirannya dicatat per hari.
  const jendela = jendelaSekarang(k);
  if (!jendela) return hasil("gagal", "Presensi kegiatan ini belum dibuka atau sudah ditutup.", k.judul);
  const ada = await prisma.presensiKegiatan.findUnique({
    where: { kegiatanId_userId_tanggal: { kegiatanId: k.id, userId: s.userId, tanggal: jendela.tanggal } },
    select: { waktu: true },
  });
  if (ada) return hasil("ok", `Anda sudah tercatat hadir pukul ${ada.waktu.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}.`, k.judul);
  await prisma.presensiKegiatan.create({ data: { kegiatanId: k.id, userId: s.userId, nama: s.name, peran: s.role, metode: "QR", tanggal: jendela.tanggal } });
  // Hadir di kegiatan sekolah = ada di sekolah hari itu → absensi harian ikut terisi. TIDAK PERNAH
  // menimpa catatan wali kelas/TU, dan gagal di sini tidak boleh menggagalkan presensinya.
  await hadirkanAbsensiHarian([s.userId], isoWib(jendela.mulai)).catch(() => null);
  return hasil("ok", `Kehadiran ${s.name} tercatat.`, k.judul);
}
