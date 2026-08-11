import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { NextRequest } from "next/server";
import { verifySession } from "@/lib/dal";

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession();
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "misc";

    // Siswa hanya boleh upload foto biodata sendiri, bukti jurnal PKL & jawaban tugas; guru boleh upload materi & tugas;
    // TAS (staf TU) boleh upload audio Bel Sekolah; admin bebas semua folder.
    const isStudentAllowedFolder = folder === "buku-induk/masuk" || folder === "pkl-jurnal" || folder === "tugas-jawaban";
    const isTeacherAllowedFolder = folder === "materi" || folder === "tugas";
    const isTasAllowedFolder = folder === "bel-sekolah";
    const allowed_ =
      session.role === "ADMIN" ||
      (session.role === "STUDENT" && isStudentAllowedFolder) ||
      (session.role === "TEACHER" && (isTeacherAllowedFolder || isTasAllowedFolder)) ||
      (session.role === "TAS" && isTasAllowedFolder);
    if (!allowed_) {
      return Response.json({ error: "Tidak diizinkan" }, { status: 403 });
    }

    if (!file) {
      return Response.json({ error: "Tidak ada file" }, { status: 400 });
    }

    const isIdPhotoFolder = folder === "buku-induk/masuk" || folder === "buku-induk/keluar";
    const isDocFolder = folder === "materi" || folder === "tugas" || folder === "tugas-jawaban";
    const isAudioFolder = folder === "bel-sekolah";
    const allowed = isIdPhotoFolder
      ? ["image/jpeg", "image/jpg", "image/png"]
      : isDocFolder
        ? ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]
        : isAudioFolder
          ? ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"]
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

    if (file.size > (isAudioFolder ? 8 : 5) * 1024 * 1024) {
      return Response.json({ error: `Ukuran file maksimal ${isAudioFolder ? 8 : 5}MB` }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads", folder);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), buffer);

    const url = `/api/uploads/${folder}/${filename}`;
    return Response.json({ url });
  } catch (err) {
    console.error("Upload error:", err);
    return Response.json({ error: "Gagal mengupload file" }, { status: 500 });
  }
}
