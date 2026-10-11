import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { TAS_JABATAN } from "@/lib/tas-jabatan";

/** PUSAT EKSTRAKURIKULER (10 Oktober 2026, keputusan user: "buat pusat ekstra juga") — portal `/pusat-ekstra` + tautan
 *  pembina tanpa akun `/portal-ekstra/<token>`.
 *   - KOORDINATOR umum (jabatan Koordinator Ekstrakurikuler), Admin, dan staf TU penuh mengelola SEMUA ekskul, termasuk
 *     membuat tautan pembina. Pemegang jabatan "Pembina <nama ekskul>" hanya ekskulnya sendiri.
 *   - Pembina dari LUAR sekolah tidak diberi akun (mereka akan ikut terhitung pegawai di presensi/rekap kepegawaian):
 *     mereka mengabsen & mengunggah foto lewat tautan — HARI ITU saja, ekskulnya saja, tanpa NIS/kontak siswa.
 *   - OSIS = organisasi INTRA (`Extracurricular.jenis`): tetap di tabel yang sama supaya rapor tidak berubah.
 *   - Foto kegiatan bukan data pribadi (pola foto liputan/sarpras) → `public/uploads/ekstra`, maks 6 per pertemuan. */
export const MAKS_FOTO = 6;
export const KOORDINATOR = "Koordinator Ekstrakurikuler";

export async function aksesEkstra(session: { role: string; email: string }): Promise<{ masuk: boolean; kelola: boolean; milik: string[] }> {
  if (session.role === "ADMIN") return { masuk: true, kelola: true, milik: [] };
  if (session.role !== "TEACHER" && session.role !== "TAS") return { masuk: false, kelola: false, milik: [] };
  const j = await getJabatanNames(session.email).catch(() => [] as string[]);
  const kelola = j.includes(KOORDINATOR) || (session.role === "TAS" && j.some(n => TAS_JABATAN.includes(n)));
  const milik = j.filter(n => n.startsWith("Pembina ")).map(n => n.slice(8));
  return { masuk: kelola || milik.length > 0, kelola, milik };
}

/** Ekskul yang boleh dilihat sesi ini. */
export async function ekskulBoleh(session: { role: string; email: string }) {
  const a = await aksesEkstra(session);
  if (!a.masuk) return { akses: a, daftar: [] };
  const daftar = await prisma.extracurricular.findMany({
    where: a.kelola ? {} : { name: { in: a.milik } },
    orderBy: [{ jenis: "asc" }, { name: "asc" }],
    select: { id: true, name: true, jenis: true, pembinaNama: true, pembinaKontak: true, jadwalRutin: true, hariRutin: true, bukaDaftar: true, kuota: true, deskripsi: true, tokenPortalHash: true, _count: { select: { members: true } } },
  });
  return { akses: a, daftar };
}
export async function bolehEkskul(session: { role: string; email: string }, extracurricularId: string) {
  const { akses, daftar } = await ekskulBoleh(session);
  const e = daftar.find(d => d.id === extracurricularId) ?? null;
  return { akses, ekskul: e };
}

export const hariWibIso = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
export const rentangHari = (iso: string) => { const a = new Date(`${iso}T00:00:00Z`); return { awal: a, akhir: new Date(a.getTime() + 86400000) }; };

/** Simpan satu foto kegiatan. Jenis dari peramban tidak dipercaya — tanda tangan berkasnya diperiksa. */
export async function simpanFotoEkstra(file: unknown): Promise<{ url: string } | { galat: string }> {
  if (!(file instanceof File) || !file.size) return { galat: "Tidak ada foto." };
  if (file.size > 5 * 1024 * 1024) return { galat: "Foto lebih dari 5 MB." };
  const buf = Buffer.from(await file.arrayBuffer());
  const jpg = buf[0] === 0xff && buf[1] === 0xd8, png = buf[0] === 0x89 && buf[1] === 0x50, webp = buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
  if (!jpg && !png && !webp) return { galat: "Berkas bukan foto (JPG, PNG, atau WEBP)." };
  const nama = `${Date.now()}-${randomBytes(6).toString("hex")}.${png ? "png" : webp ? "webp" : "jpg"}`;
  const dir = join(process.cwd(), "public", "uploads", "ekstra");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, nama), buf);
  return { url: `/api/uploads/ekstra/${nama}` };
}
export async function hapusBerkasFoto(url: string) {
  const m = /^\/api\/uploads\/ekstra\/([A-Za-z0-9.-]+)$/.exec(url);
  if (m) await unlink(join(process.cwd(), "public", "uploads", "ekstra", m[1])).catch(() => null);
}

/** Tambahkan foto ke pertemuan tanggal itu; pertemuannya dibuatkan (tanpa absensi) bila belum ada. */
export async function tambahFotoKegiatan(o: { extracurricularId: string; tanggal: string; file: unknown; olehNama: string; olehPeran: string; sumber?: string }) {
  const { awal, akhir } = rentangHari(o.tanggal);
  const ada = await prisma.extracurricularJournal.findFirst({ where: { extracurricularId: o.extracurricularId, date: { gte: awal, lt: akhir } }, select: { id: true, foto: true } });
  if ((ada?.foto.length ?? 0) >= MAKS_FOTO) return { galat: `Paling banyak ${MAKS_FOTO} foto per pertemuan.` } as const;
  const f = await simpanFotoEkstra(o.file);
  if ("galat" in f) return f;
  if (ada) await prisma.extracurricularJournal.update({ where: { id: ada.id }, data: { foto: { push: f.url } } });
  else await prisma.extracurricularJournal.create({ data: { extracurricularId: o.extracurricularId, date: awal, foto: [f.url], recordedByName: o.olehNama, recordedByRole: o.olehPeran, sumber: o.sumber ?? null } });
  return { url: f.url } as const;
}

/** Simpan absensi satu pertemuan TANPA menghilangkan fotonya (rute lama menghapus-lalu-membuat barisnya). */
export async function simpanAbsenEkstra(o: { extracurricularId: string; tanggal: string; materi: string | null; rows: { studentId: string; status: string }[]; olehNama: string; olehPeran: string; teacherId?: string | null; sumber?: string | null }) {
  const { awal, akhir } = rentangHari(o.tanggal);
  const anggota = new Set((await prisma.extracurricularMember.findMany({ where: { extracurricularId: o.extracurricularId }, select: { studentId: true } })).map(m => m.studentId));
  const rows = o.rows.filter(r => anggota.has(r.studentId) && ["HADIR", "IZIN", "SAKIT", "ALPHA"].includes(r.status));
  await prisma.$transaction(async tx => {
    const lama = await tx.extracurricularJournal.findMany({ where: { extracurricularId: o.extracurricularId, date: { gte: awal, lt: akhir } }, select: { id: true, foto: true } });
    const foto = [...new Set(lama.flatMap(l => l.foto))];
    await tx.extracurricularJournal.deleteMany({ where: { id: { in: lama.map(l => l.id) } } });
    await tx.extracurricularJournal.create({
      data: {
        extracurricularId: o.extracurricularId, teacherId: o.teacherId ?? null, date: awal, materi: o.materi, foto, sumber: o.sumber ?? null,
        recordedByName: o.olehNama, recordedByRole: o.olehPeran, entries: { create: rows.map(r => ({ studentId: r.studentId, status: r.status })) },
      },
    });
  });
  return rows.length;
}
