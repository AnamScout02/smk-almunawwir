import "server-only";
import sharp from "sharp";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

/** TANDA TANGAN GURU & STAF (5 Oktober 2026, permintaan user: "upload TTD di semua guru … bisa diinput superadmin
 *  atau TU, atau diupload mandiri … untuk daftar hadir rapat, rapor, dan lain-lain").
 *
 *  Yang dijaga dan alasannya:
 *  - TTD = data pribadi yang bisa dipalsukan ke dokumen lain → FOLDER RAHASIA (diblokir proxy), tidak pernah lewat
 *    /uploads publik. Dokumen cetak menyisipkannya sebagai data URL dari SERVER (`petaTtd`), jadi tidak ada alamat
 *    gambar yang bisa dibagikan/diunduh ulang; rute `/api/ttd/[userId]` hanya untuk pemilik & petugas TU.
 *  - Gambar diolah SEKALI saat diunggah: latar putih/terang dijadikan TRANSPARAN, tepi kosong dipangkas, diperkecil
 *    ke ≤ 900×300 — supaya tercetak rapi di atas garis/kolom tabel, dan foto HP 4 MB tidak membebani dokumen.
 *  - Satu TTD per akun; mengganti = berkas lama dihapus. Setiap perubahan dicatat logActivity di rutenya. */
export const FOLDER_TTD = join(process.cwd(), "public", "uploads", "rahasia", "ttd");
export const PERAN_TTD = ["ADMIN", "TAS", "TEACHER"] as const;
export const bolehPunyaTtd = (role: string) => (PERAN_TTD as readonly string[]).includes(role);

const aman = (berkas: string) => berkas.replace(/[^A-Za-z0-9.-]/g, "");

/** Latar kertas → transparan, pangkas, perkecil. Mengembalikan PNG, atau null bila bukan gambar yang terbaca.
 *  Latar DITAKSIR PER BAGIAN gambar (bukan ambang tetap): foto HP di dalam ruangan hampir selalu berbayang — atas terang,
 *  bawah abu-abu ±150 — dan tulisan dari balik kertas ikut tembus. Ambang tetap "≥200 = latar" membiarkan semua itu
 *  (temuan user 5 Okt 2026, TTD Wahyu Fitri Yani). Caranya: kecerahan MAKSIMUM tiap blok (≈ warna kertas di situ, goresan
 *  tipis tidak memengaruhinya) → dihaluskan → diinterpolasi per titik; titik yang jauh lebih gelap dari kertas
 *  sekitarnya (< 55%) = tinta, mendekati kertas (≥ 80%) = transparan, di antaranya semi-transparan supaya tepi halus. */
export async function olahGambarTtd(asli: Buffer): Promise<Buffer | null> {
  try {
    const { data, info } = await sharp(asli, { failOn: "none" }).rotate().flatten({ background: "#ffffff" })
      .resize({ width: 1400, height: 700, fit: "inside", withoutEnlargement: true })
      .removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    const g = new Float32Array(w * h);
    for (let i = 0, p = 0; p < g.length; i += 4, p++) g[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

    const B = Math.max(8, Math.round(Math.min(w, h) / 20));
    const gw = Math.ceil(w / B), gh = Math.ceil(h / B);
    let kisi = new Float32Array(gw * gh);
    for (let by = 0; by < gh; by++) for (let bx = 0; bx < gw; bx++) {
      let m = 0;
      for (let y = by * B; y < Math.min(h, by * B + B); y++)
        for (let x = bx * B; x < Math.min(w, bx * B + B); x++) if (g[y * w + x] > m) m = g[y * w + x];
      kisi[by * gw + bx] = m;
    }
    for (let ulang = 0; ulang < 2; ulang++) {
      const halus = new Float32Array(kisi.length);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        let jml = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= gh || xx >= gw) continue;
          jml += kisi[yy * gw + xx]; n++;
        }
        halus[y * gw + x] = jml / n;
      }
      kisi = halus;
    }
    for (let y = 0; y < h; y++) {
      const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / B - 0.5)), y0 = Math.floor(fy), y1 = Math.min(gh - 1, y0 + 1), ty = fy - y0;
      for (let x = 0; x < w; x++) {
        const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / B - 0.5)), x0 = Math.floor(fx), x1 = Math.min(gw - 1, x0 + 1), tx = fx - x0;
        const kertas = (kisi[y0 * gw + x0] * (1 - tx) + kisi[y0 * gw + x1] * tx) * (1 - ty)
          + (kisi[y1 * gw + x0] * (1 - tx) + kisi[y1 * gw + x1] * tx) * ty;
        const r = g[y * w + x] / Math.max(kertas, 40);
        const i = (y * w + x) * 4;
        data[i + 3] = r >= 0.8 ? 0 : r <= 0.55 ? 255 : Math.round(((0.8 - r) / 0.25) * 255);
        // Warna titik yang sudah transparan dikosongkan — sisa warna kertas tak terlihat tetapi membengkakkan PNG.
        if (data[i + 3] === 0) data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
    return await sharp(data, { raw: { width: w, height: h, channels: 4 } })
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
      .resize({ width: 900, height: 300, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 }).toBuffer();
  } catch { return null; }
}

/** Simpan TTD baru untuk satu akun (berkas lama dihapus). */
export async function simpanTtd(userId: string, png: Buffer) {
  const lama = await prisma.user.findUnique({ where: { id: userId }, select: { ttdBerkas: true } });
  const berkas = `${userId.replace(/[^A-Za-z0-9]/g, "")}-${Date.now()}-${randomBytes(6).toString("hex")}.png`;
  await mkdir(FOLDER_TTD, { recursive: true });
  await writeFile(join(FOLDER_TTD, berkas), png);
  await prisma.user.update({ where: { id: userId }, data: { ttdBerkas: berkas, ttdDiperbarui: new Date() } });
  if (lama?.ttdBerkas) await unlink(join(FOLDER_TTD, aman(lama.ttdBerkas))).catch(() => {});
}

export async function hapusTtd(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { ttdBerkas: true } });
  await prisma.user.update({ where: { id: userId }, data: { ttdBerkas: null, ttdDiperbarui: null } });
  if (u?.ttdBerkas) await unlink(join(FOLDER_TTD, aman(u.ttdBerkas))).catch(() => {});
}

export async function bacaBerkasTtd(berkas: string): Promise<Buffer | null> {
  return readFile(join(FOLDER_TTD, aman(berkas))).catch(() => null);
}

/** TTD banyak akun sekaligus sebagai data URL — untuk DISISIPKAN ke dokumen cetak (daftar hadir rapat, rapor, …).
 *  Akun tanpa TTD tidak ada di peta. Satu kueri + baca berkas paralel. */
export async function petaTtd(userIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  const peta = new Map<string, string>();
  if (!ids.length) return peta;
  const users = await prisma.user.findMany({ where: { id: { in: ids }, NOT: { ttdBerkas: null } }, select: { id: true, ttdBerkas: true } })
    .catch(() => []);
  await Promise.all(users.map(async u => {
    const isi = await bacaBerkasTtd(u.ttdBerkas!);
    if (isi) peta.set(u.id, `data:image/png;base64,${isi.toString("base64")}`);
  }));
  return peta;
}

/** Cocokkan nama peserta (teks bebas) ke akun pegawai — huruf besar/kecil, spasi ganda, dan gelar di belakang koma
 *  diabaikan. Nama yang dimiliki lebih dari satu pegawai TIDAK dicocokkan (tidak pernah menebak). */
export async function cocokkanNamaPegawai(nama: string[]): Promise<Map<string, string>> {
  const rapi = (s: string) => s.split(",")[0].toLowerCase().replace(/\s+/g, " ").trim();
  const pegawai = await prisma.user.findMany({ where: { role: { in: [...PERAN_TTD] } }, select: { id: true, name: true } }).catch(() => []);
  const kelompok = new Map<string, string[]>();
  for (const p of pegawai) { const k = rapi(p.name); kelompok.set(k, [...(kelompok.get(k) ?? []), p.id]); }
  const hasil = new Map<string, string>();
  for (const n of nama) { const ids = kelompok.get(rapi(n)); if (ids?.length === 1) hasil.set(n, ids[0]); }
  return hasil;
}

/** Pengawas SATU kelas pada satu ujian — untuk TTD di Berita Acara & Daftar Hadir ujian.
 *  KELAS: pengampu/pengganti dari `susunPengawasKelas` (sumber yang sama dengan halaman Pengawas).
 *  RUANG: siswa kelas itu harus duduk di SATU ruang+sesi, dan ruang itu hanya punya SATU pengawas pada tanggal ujian.
 *  Selain itu null — nama & TTD dibiarkan kosong untuk ditulis tangan, tidak pernah menebak orangnya. */
export async function pengawasKelasUjian(
  exam: { id: string; kegiatanId: string | null; startTime: Date }, classId: string, siswaIds: string[],
): Promise<{ nama: string; userId: string } | null> {
  if (!exam.kegiatanId) return null;
  const keg = await prisma.kegiatanUjian.findUnique({ where: { id: exam.kegiatanId }, select: { mekanisme: true } }).catch(() => null);
  const keTeacher = async (teacherId: string) => {
    const t = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { userId: true, user: { select: { name: true } } } }).catch(() => null);
    return t ? { nama: t.user.name, userId: t.userId } : null;
  };
  if (keg?.mekanisme === "KELAS") {
    const { susunPengawasKelas } = await import("@/lib/pengawas-kelas");
    const b = (await susunPengawasKelas(exam.kegiatanId).catch(() => [])).find(r => r.examId === exam.id && r.classId === classId);
    return b?.pengawas ? keTeacher(b.pengawas.id) : null;
  }
  if (!siswaIds.length) return null;
  const tempat = await prisma.penempatanRuangUjian.findMany({
    where: { kegiatanId: exam.kegiatanId, studentId: { in: siswaIds } }, select: { ruangId: true, sesi: true },
  }).catch(() => []);
  const pasangan = [...new Set(tempat.map(t => `${t.ruangId}|${t.sesi}`))];
  if (pasangan.length !== 1) return null;
  const [ruangId, sesi] = pasangan[0].split("|");
  const tgl = new Date(new Date(exam.startTime.getTime() + 7 * 3600_000).toISOString().slice(0, 10));
  const p = await prisma.pengawasUjian.findMany({
    where: { kegiatanId: exam.kegiatanId, ruangId, sesi: Number(sesi), tanggal: tgl }, select: { teacherId: true },
  }).catch(() => []);
  return p.length === 1 ? keTeacher(p[0].teacherId) : null;
}

/** TTD pribadi untuk SATU nama yang tercetak di blok tanda tangan (mis. nama Kepala Sekolah dari Struktur
 *  Organisasi, atau nama Plt. yang diketik manual). Kosong bila namanya tidak cocok PERSIS satu pegawai atau
 *  orangnya belum mengunggah TTD — blok itu lalu tetap ruang kosong untuk ditandatangani tangan. */
export async function ttdDariNama(nama: string | null | undefined): Promise<string | undefined> {
  if (!nama?.trim()) return undefined;
  const id = (await cocokkanNamaPegawai([nama])).get(nama);
  return id ? (await petaTtd([id])).get(id) : undefined;
}
