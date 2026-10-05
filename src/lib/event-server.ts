import "server-only";
import { prisma } from "@/lib/prisma";
import { slugEvent, JENIS_EVENT, TINGKAT_EVENT } from "@/lib/event-guard";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/session";
import { sesiMasihHidup } from "@/lib/sesi-server";
import { kompresGambar } from "@/lib/kompres-gambar";
import { bolehEvent } from "@/lib/event-guard";

/* Pembantu bersama POST & PUT event. SENGAJA di lib, bukan diekspor dari route.ts — `next build`
   menolak ekspor selain handler HTTP & konfigurasi dari route (CLAUDE.md #26). */

/** Isian bersama POST & PUT. Mengembalikan pesan galat, atau data siap simpan. */
export async function susunEvent(b: Record<string, unknown>, idLama?: string) {
  const judul = String(b.judul ?? "").trim().slice(0, 200);
  const deskripsi = String(b.deskripsi ?? "").trim().slice(0, 5000);
  if (!judul) return { galat: "Nama event wajib diisi." as const };
  if (!deskripsi) return { galat: "Deskripsi wajib diisi — ini yang dibaca calon peserta." as const };

  const tgl = (v: unknown) => {
    const t = String(v ?? "").trim();
    if (!t) return null;
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T00:00:00.000Z` : t);
    return isNaN(d.getTime()) ? null : d;
  };
  const berbayar = b.berbayar === true || b.berbayar === "true";
  const biaya = berbayar ? Math.max(0, Math.round(Number(b.biaya ?? 0) || 0)) : null;

  // Slug unik: judul yang sama (mis. lomba tahunan) tetap bisa dibuat, dibedakan akhiran angka.
  let slug = slugEvent(judul);
  for (let i = 2; i < 50; i++) {
    const ada = await prisma.event.findUnique({ where: { slug }, select: { id: true } });
    if (!ada || ada.id === idLama) break;
    slug = `${slugEvent(judul)}-${i}`;
  }

  return {
    data: {
      judul, slug, deskripsi,
      penyelenggara: String(b.penyelenggara ?? "").trim().slice(0, 150) || "SMK Al Munawwir IIBS",
      milikSekolah: b.milikSekolah === true || b.milikSekolah === "true",
      jenis: JENIS_EVENT.includes(String(b.jenis)) ? String(b.jenis) : "LOMBA",
      tingkat: TINGKAT_EVENT.includes(String(b.tingkat)) ? String(b.tingkat) : "SEKOLAH",
      syarat: String(b.syarat ?? "").trim().slice(0, 3000) || null,
      fasilitas: String(b.fasilitas ?? "").trim().slice(0, 2000) || null,
      berbayar, biaya,
      biayaCatatan: String(b.biayaCatatan ?? "").trim().slice(0, 300) || null,
      rekening: String(b.rekening ?? "").trim().slice(0, 200) || null,
      mulai: tgl(b.mulai), selesai: tgl(b.selesai), tutupDaftar: tgl(b.tutupDaftar),
      posterUrl: String(b.posterUrl ?? "").trim().slice(0, 500) || null,
      panduanUrl: String(b.panduanUrl ?? "").trim().slice(0, 500) || null,
      tautanLuar: String(b.tautanLuar ?? "").trim().slice(0, 500) || null,
      kontak: String(b.kontak ?? "").trim().slice(0, 200) || null,
      jurusanIds: Array.isArray(b.jurusanIds) ? (b.jurusanIds as unknown[]).map(String).filter(Boolean).slice(0, 50) : [],
      aktif: b.aktif !== false && b.aktif !== "false",
      tampilPublik: b.tampilPublik !== false && b.tampilPublik !== "false",
    },
  };
}

// ── Pendaftaran & berkas ──────────────────────────────────────────────────



/** Karya & bukti bayar bisa memuat data pribadi (wajah, nomor rekening) → folder RAHASIA yang diblokir
 *  proxy, dibuka hanya lewat /api/event/berkas/[id]/[jenis] (CLAUDE.md #44 & #50). */
export const FOLDER_EVENT = join(process.cwd(), "public", "uploads", "rahasia", "event");

export const MIME_EVENT: Record<string, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf",
  zip: "application/zip", mp4: "video/mp4",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/** Sesi bila pengunjung sedang masuk, tanpa mengalihkan ke /login — halaman & pendaftaran lomba
 *  terbuka untuk umum. Baris sesi tetap diperiksa masih hidup, sama seperti verifySession. */
export async function sesiOpsional() {
  const s = await getSession().catch(() => null);
  if (!s?.userId || !s.sid) return null;
  return (await sesiMasihHidup(s.sid).catch(() => false)) ? s : null;
}

/** Simpan satu berkas unggahan pendaftaran. Mengembalikan nama berkas, null bila tidak ada berkas,
 *  atau `{ galat }` bila jenis/ukurannya ditolak. Ekstensi DITENTUKAN dari jenis berkas yang
 *  dikenal, bukan dari nama kiriman browser. */
export async function simpanBerkasEvent(file: FormDataEntryValue | null, maksMb: number, label: string) {
  if (!(file instanceof File) || !file.size) return null;
  const dariNama = file.name.split(".").pop()?.toLowerCase() ?? "";
  let ext = Object.entries(MIME_EVENT).find(([, m]) => m === file.type)?.[0]
    ?? (["docx", "pptx", "zip"].includes(dariNama) ? dariNama : "");
  if (ext === "jpeg") ext = "jpg";
  if (!ext) return { galat: `${label}: gunakan JPG/PNG/WEBP, PDF, DOCX, PPTX, ZIP, atau MP4.` };
  if (file.size > maksMb * 1024 * 1024) return { galat: `${label}: ukuran maksimal ${maksMb} MB.` };
  let isi = Buffer.from(await file.arrayBuffer());
  if (["jpg", "png", "webp"].includes(ext)) {
    const kecil = await kompresGambar(isi);
    if (kecil) { isi = Buffer.from(kecil.buffer); ext = kecil.ext; }
  }
  const nama = `${Date.now()}-${randomBytes(12).toString("hex")}.${ext}`;
  await mkdir(FOLDER_EVENT, { recursive: true });
  await writeFile(join(FOLDER_EVENT, nama), isi);
  return nama;
}

/** Berkas pendaftaran boleh dibuka pengelola event, atau siswa pemilik pendaftaran itu. */
export async function bolehLihatBerkasEvent(
  session: { role: string; email: string; userId: string },
  p: { studentId: string | null },
): Promise<boolean> {
  if (await bolehEvent(session)) return true;
  if (session.role !== "STUDENT" || !p.studentId) return false;
  const s = await prisma.student.findUnique({ where: { userId: session.userId }, select: { id: true } }).catch(() => null);
  return s?.id === p.studentId;
}
