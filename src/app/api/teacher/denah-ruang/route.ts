import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { bolehAturUjian } from "@/lib/kegiatan-ujian-server";
import { logActivity } from "@/lib/activity-log";
import { bacaAturRuang, bagiPeserta, muatDenah, pesertaKegiatan, MAKS_SESI } from "@/lib/denah-ruang";

export const dynamic = "force-dynamic";

const TOLAK = "Hanya Administrator atau Wakil Kepala Kurikulum yang boleh mengatur pembagian ruang.";
const bulat = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : NaN; };

/** Denah satu kegiatan: ruang × sesi × kursi, peserta yang belum ditempatkan, ringkasan. */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const kegiatanId = new URL(req.url).searchParams.get("kegiatan");
    if (!kegiatanId) return Response.json({ error: "Kegiatan wajib dipilih." }, { status: 400 });
    const [data, bolehAtur] = await Promise.all([muatDenah(kegiatanId), bolehAturUjian(session)]);
    if (!data) return Response.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });
    return Response.json({ ...data, bolehAtur });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** Bagikan otomatis — MENGGANTI seluruh pembagian ruang kegiatan itu. */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    if (!(await bolehAturUjian(session))) return Response.json({ error: TOLAK }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    const kegiatanId = String(b.kegiatanId ?? "");
    const ruangIds = Array.isArray(b.ruangIds) ? b.ruangIds.map(String) : [];
    // Pola + peruntukan ruang (jurusan & kelas disimpan keduanya supaya berpindah pola tidak menghapus isian yang lain).
    const atur = bacaAturRuang({ pola: b.pola, jurusan: b.peruntukan?.jurusan, kelas: b.peruntukan?.kelas });
    const pola = atur.pola;
    const kegiatan = await prisma.kegiatanUjian.findUnique({ where: { id: kegiatanId }, select: { id: true, nama: true, singkatan: true, tingkat: true } });
    if (!kegiatan) return Response.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });
    const ruang = await prisma.ruangUjian.findMany({ where: { id: { in: ruangIds }, aktif: true }, orderBy: [{ urutan: "asc" }, { nama: "asc" }], select: { id: true, kapasitas: true } });
    if (!ruang.length) return Response.json({ error: "Pilih minimal satu ruang aktif." }, { status: 400 });
    const peserta = await pesertaKegiatan(kegiatan);
    if (!peserta.length) return Response.json({ error: "Tidak ada siswa aktif pada tingkat kegiatan ini." }, { status: 400 });

    const { hasil, sesi, galat } = bagiPeserta(peserta, ruang, pola, pola === "PER_KELAS" ? atur.kelas : pola === "SELANG_SELING_JURUSAN" ? atur.jurusan : {});
    if (galat) return Response.json({ error: galat }, { status: 400 });
    if (sesi > MAKS_SESI) {
      const kapasitas = ruang.reduce((n, r) => n + r.kapasitas, 0);
      return Response.json({ error: `Kapasitas ruang terpilih (${kapasitas} kursi) terlalu kecil untuk ${peserta.length} peserta — butuh ${sesi} sesi. Tambah ruang atau kapasitasnya${pola !== "SELANG_SELING" ? ", atau periksa ruang khusus yang terlalu kecil untuk kelompoknya" : ""}.` }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.penempatanRuangUjian.deleteMany({ where: { kegiatanId } }),
      prisma.penempatanRuangUjian.createMany({ data: hasil.map(h => ({ ...h, kegiatanId })) }),
      prisma.kegiatanUjian.update({ where: { id: kegiatanId }, data: { aturRuang: { ...atur } } }),
    ]);
    await logActivity(session, {
      action: "BAGI_RUANG_UJIAN", entity: "KegiatanUjian", entityId: kegiatanId,
      description: `Membagi ${hasil.length} peserta ${kegiatan.singkatan} ke ${ruang.length} ruang (${sesi} sesi, ${pola === "PER_KELAS" ? "per kelas" : pola === "SELANG_SELING_JURUSAN" ? "selang-seling, satu ruang satu jurusan" : "selang-seling tingkat"})`,
    }).catch(() => {});
    return Response.json({ ditempatkan: hasil.length, sesi, ruang: ruang.length });
  } catch {
    return Response.json({ error: "Gagal membagi ruang." }, { status: 500 });
  }
}

/** Pindahkan satu peserta ke kursi tertentu. Kursi tujuan terisi → kedua peserta bertukar tempat. */
export async function PATCH(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    if (!(await bolehAturUjian(session))) return Response.json({ error: TOLAK }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    const kegiatanId = String(b.kegiatanId ?? ""), studentId = String(b.studentId ?? ""), ruangId = String(b.ruangId ?? "");
    const sesi = bulat(b.sesi), kursi = bulat(b.kursi);
    const [kegiatan, ruang] = await Promise.all([
      prisma.kegiatanUjian.findUnique({ where: { id: kegiatanId }, select: { singkatan: true, tingkat: true } }),
      prisma.ruangUjian.findUnique({ where: { id: ruangId }, select: { nama: true, kapasitas: true } }),
    ]);
    if (!kegiatan) return Response.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });
    if (!ruang) return Response.json({ error: "Ruang tidak ditemukan." }, { status: 404 });
    if (!(sesi >= 1 && sesi <= MAKS_SESI)) return Response.json({ error: `Sesi harus 1–${MAKS_SESI}.` }, { status: 400 });
    if (!(kursi >= 1 && kursi <= ruang.kapasitas)) return Response.json({ error: `Kursi ${ruang.nama} hanya 1–${ruang.kapasitas}.` }, { status: 400 });
    const peserta = await pesertaKegiatan(kegiatan);
    if (!peserta.some(p => p.id === studentId)) return Response.json({ error: "Siswa ini bukan peserta kegiatan tersebut." }, { status: 400 });

    const pesan = await prisma.$transaction(async tx => {
      const lama = await tx.penempatanRuangUjian.findUnique({ where: { kegiatanId_studentId: { kegiatanId, studentId } } });
      const penghuni = await tx.penempatanRuangUjian.findUnique({ where: { kegiatanId_ruangId_sesi_kursi: { kegiatanId, ruangId, sesi, kursi } } });
      if (penghuni?.studentId === studentId) return "Peserta sudah di kursi itu.";
      if (penghuni) await tx.penempatanRuangUjian.delete({ where: { id: penghuni.id } });
      if (lama) await tx.penempatanRuangUjian.delete({ where: { id: lama.id } });
      await tx.penempatanRuangUjian.create({ data: { kegiatanId, studentId, ruangId, sesi, kursi } });
      if (penghuni && lama) {
        await tx.penempatanRuangUjian.create({ data: { kegiatanId, studentId: penghuni.studentId, ruangId: lama.ruangId, sesi: lama.sesi, kursi: lama.kursi } });
        return "Kedua peserta bertukar tempat duduk.";
      }
      return penghuni ? "Peserta dipindahkan; penghuni kursi sebelumnya kini belum ditempatkan." : "Peserta dipindahkan.";
    });
    return Response.json({ ok: true, pesan });
  } catch {
    return Response.json({ error: "Gagal memindahkan peserta." }, { status: 500 });
  }
}

/** Kosongkan seluruh pembagian ruang satu kegiatan. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    if (!(await bolehAturUjian(session))) return Response.json({ error: TOLAK }, { status: 403 });
    const kegiatanId = new URL(req.url).searchParams.get("kegiatan");
    if (!kegiatanId) return Response.json({ error: "Kegiatan wajib dipilih." }, { status: 400 });
    const r = await prisma.penempatanRuangUjian.deleteMany({ where: { kegiatanId } });
    return Response.json({ ok: true, dihapus: r.count });
  } catch {
    return Response.json({ error: "Gagal mengosongkan pembagian ruang." }, { status: 500 });
  }
}
