import sharp from "sharp";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

/** KOMPRES GAMBAR SOAL — gambar yang diunggah guru (atau ikut dari berkas Word) diperkecil ke
 * sisi terpanjang maks 1600 px dan diubah ke WebP. Foto HP 4 MB biasanya jadi ±150 KB: halaman
 * ujian terbuka jauh lebih cepat di jaringan sekolah yang dipakai puluhan siswa sekaligus.
 *
 * Mengembalikan null (pakai berkas asli) kalau gambar tidak bisa dibaca, berupa animasi, atau
 * hasil kompresinya malah lebih besar. Tidak pernah menggagalkan unggahan. */
export async function kompresGambar(
  asli: Buffer,
  opsi: { sisiMaks?: number; kualitas?: number } = {},
): Promise<{ buffer: Buffer; ext: "webp"; mime: "image/webp" } | null> {
  try {
    const gambar = sharp(asli, { failOn: "none", animated: true });
    const meta = await gambar.metadata();
    if ((meta.pages ?? 1) > 1) return null; // GIF/WebP bergerak — biarkan apa adanya
    const sisi = opsi.sisiMaks ?? 1600;
    const hasil = await sharp(asli, { failOn: "none" })
      .rotate() // hormati orientasi EXIF foto HP
      .resize({ width: sisi, height: sisi, fit: "inside", withoutEnlargement: true })
      .webp({ quality: opsi.kualitas ?? 80 })
      .toBuffer();
    return hasil.length < asli.length ? { buffer: hasil, ext: "webp", mime: "image/webp" } : null;
  } catch {
    return null;
  }
}

/** Simpan gambar soal (dari berkas Word) sebagai BERKAS terkompres di public/uploads/soal, lalu
 * kembalikan URL-nya. Menggantikan cara lama yang menanam gambar sebagai base64 di dalam teks soal
 * — satu gambar foto bisa membuat satu butir soal berukuran megabita dan terkirim ulang tiap siswa
 * membuka nomor itu. Jenis yang tidak didukung browser (EMF/WMF dari Word) → null. */
export async function simpanGambarSoal(asli: Buffer, contentType: string): Promise<string | null> {
  const bisa = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (!bisa.includes(contentType)) return null;
  const kecil = contentType === "image/gif" ? null : await kompresGambar(asli);
  const ext = kecil ? "webp" : (contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1]);
  const nama = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const folder = join(process.cwd(), "public", "uploads", "soal");
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, nama), kecil ? kecil.buffer : asli);
  return `/api/uploads/soal/${nama}`;
}
