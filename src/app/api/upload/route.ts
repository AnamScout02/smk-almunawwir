import { writeFile, mkdir } from "fs/promises";
import { aksesPusatPkl } from "@/lib/pkl-humas";
import { join } from "path";
import { NextRequest } from "next/server";
import { verifySession } from "@/lib/dal";
import { kompresGambar } from "@/lib/kompres-gambar";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { TAS_JABATAN } from "@/lib/tas-jabatan";

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession();
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "misc";

    // Siswa hanya boleh upload foto biodata sendiri, bukti jurnal PKL & jawaban tugas; guru boleh upload materi & tugas;
    // TAS (staf TU) boleh upload audio Bel Sekolah; admin bebas semua folder.
    // "ujian-jawaban": berkas jawaban siswa untuk soal CBT bertipe Unggah.
    // "soal": gambar/audio yang disisipkan guru ke dalam soal CBT (listening, diagram).
    const isStudentAllowedFolder = folder === "buku-induk/masuk" || folder === "pkl-jurnal" || folder === "tugas-jawaban" || folder === "ujian-jawaban";
    // "osis": foto calon Pemilihan OSIS (Pembina OSIS/Kesiswaan — akses halaman dijaga osis-guard).
    const isTeacherAllowedFolder = folder === "materi" || folder === "tugas" || folder === "soal" || folder === "osis" || folder === "pkl-jurnal" || folder === "liputan" || folder === "event";
    // "sarpras": foto laporan kerusakan (semua guru & staf, 17 Sep 2026).
    // "event": poster & panduan Lomba & Event — isinya memang untuk publik (berkas peserta di folder rahasia, rute sendiri).
    const isTasAllowedFolder = folder === "bel-sekolah" || folder === "sarpras" || folder === "bkk" || folder === "event";
    /* FOTO BUKU INDUK (masuk/keluar/kartu) untuk Tata Usaha (4 Okt 2026). Halaman Buku Induk & Kartu Tanda
       dibuka staf TU (peran TAS) dan guru berjabatan TU (verifyTasAccess), tetapi rute ini dulu hanya
       mengizinkan Admin — staf TU tidak bisa mengunggah foto siswa sama sekali. Jabatan diperiksa sama persis. */
    const folderBukuInduk = folder === "buku-induk/masuk" || folder === "buku-induk/keluar" || folder === "buku-induk/kartu";
    const bolehBukuInduk = folderBukuInduk && (session.role === "TAS"
      || (session.role === "TEACHER" && (await getJabatanNames(session.email)).some(n => TAS_JABATAN.includes(n))));
    // Dokumen MoU DUDI — Pusat PKL dibuka Wakil Kepala Humas (guru) & staf TU; dulu hanya Admin yang lolos di sini.
    const bolehMitra = folder === "mitra-industri" && (session.role === "TEACHER" || session.role === "TAS") && (await aksesPusatPkl(session));
    // Sampul buku & e-book — Pusat Perpustakaan dipegang Koordinator/Tim Perpustakaan (guru maupun staf), tetapi rute ini dulu
    // hanya meloloskan Admin, sehingga petugasnya sendiri mendapat "Tidak diizinkan" (laporan user 10 Okt 2026).
    const folderPerpus = folder === "perpustakaan" || folder === "perpustakaan/ebook";
    const bolehPerpus = folderPerpus && (session.role === "TEACHER" || session.role === "TAS")
      && (await getJabatanNames(session.email)).some(n => ["Koordinator Perpustakaan", "Tim Perpustakaan"].includes(n));
    const allowed_ =
      session.role === "ADMIN" || bolehBukuInduk || bolehMitra || bolehPerpus ||
      (session.role === "STUDENT" && isStudentAllowedFolder) ||
      (session.role === "TEACHER" && (isTeacherAllowedFolder || isTasAllowedFolder)) ||
      (session.role === "TAS" && (isTasAllowedFolder || folder === "soal"));
    if (!allowed_) {
      return Response.json({ error: "Tidak diizinkan" }, { status: 403 });
    }

    if (!file) {
      return Response.json({ error: "Tidak ada file" }, { status: 400 });
    }

    const isIdPhotoFolder = folderBukuInduk;
    const isDocFolder = folder === "perpustakaan/ebook" || folder === "mitra-industri" || folder === "materi" || folder === "tugas" || folder === "tugas-jawaban" || folder === "ujian-jawaban" || folder === "event";
    const isAudioFolder = folder === "bel-sekolah";
    const isSoalFolder = folder === "soal";
    const allowed = isIdPhotoFolder
      ? ["image/jpeg", "image/jpg", "image/png"]
      : isDocFolder
        ? ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]
        : isAudioFolder
          ? ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"]
          : isSoalFolder
            ? ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"]
            : ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      return Response.json({
        error: isIdPhotoFolder
          ? "Format file tidak didukung. Foto masuk/keluar hanya menerima JPG atau PNG."
          : isDocFolder
            ? "Format file tidak didukung. Gunakan PDF, JPG, PNG, atau WEBP."
            : isAudioFolder
              ? "Format file tidak didukung. Gunakan MP3, WAV, atau OGG."
              : "Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.",
      }, { status: 400 });
    }

    const batasMb = (isAudioFolder || isSoalFolder) ? 8 : 5;
    if (file.size > batasMb * 1024 * 1024) {
      return Response.json({ error: `Ukuran file maksimal ${batasMb}MB` }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);
    let ext = file.name.split(".").pop()?.toLowerCase() || "jpg";

    // Gambar soal CBT & jawaban unggahan siswa dikompres (WebP, maks 1600 px) — dibuka puluhan
    // siswa sekaligus di jaringan sekolah. GIF & audio tidak disentuh.
    if ((isSoalFolder || folder === "ujian-jawaban" || folder === "sarpras") && ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      const kecil = await kompresGambar(buffer);
      if (kecil) { buffer = Buffer.from(kecil.buffer); ext = kecil.ext; }
    }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads", folder);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), buffer);

    const url = `/api/uploads/${folder}/${filename}`;
    return Response.json({ url });
  } catch (err) {
    lemparBilaPengalihan(err);
    console.error("Upload error:", err);
    return Response.json({ error: "Gagal mengupload file" }, { status: 500 });
  }
}
