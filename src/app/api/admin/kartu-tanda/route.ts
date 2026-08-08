import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { generateQrWithLogoDataUrl } from "@/lib/qrcode";

export const dynamic = "force-dynamic";

function fmtTtl(place: string | null, date: Date | null): string | null {
  if (!place && !date) return null;
  const d = date ? date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : null;
  return [place, d].filter(Boolean).join(", ");
}

/** Foto profil (User.avatar) hampir semua masih kosong di sistem ini — kalau ada isian Buku Induk
 * ("Foto Masuk", disimpan lepas di JSON bukuIndukData karena field Buku Induk sangat banyak &
 * dinamis, bukan kolom tabel tersendiri), pakai itu sbg fallback. Bukan foto TERBARU secara
 * teknis (itu foto saat masuk/mulai mengajar), tapi jauh lebih baik drpd cuma inisial kosong. */
function fotoMasukFallback(bukuIndukData: unknown): string | null {
  if (!bukuIndukData || typeof bukuIndukData !== "object") return null;
  const url = (bukuIndukData as Record<string, unknown>).fotoMasukUrl;
  return typeof url === "string" && url ? url : null;
}

/** Kartu Tanda resmi sekolah (siswa/guru/pegawai) — generalisasi dari identifier yang SUDAH
 * dipakai Perpustakaan (NIS/NIP/potongan email, lihat /api/perpustakaan/borrower-qr), TAPI kartu
 * ini bukan cuma kartu anggota perpustakaan: dipakai sbg identitas resmi (ada foto, kelas/
 * jurusan/jabatan, khusus siswa juga TTL+Agama dari data Buku Induk). QR-nya berisi identifier
 * yang SAMA PERSIS dgn yang dibaca scan Perpustakaan/Piket, jadi kartu ini otomatis juga
 * berfungsi lintas modul tanpa barcode terpisah — satu orang, satu barcode. */
export async function GET(req: NextRequest) {
  await verifyTasAccess();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") === "GURU" ? "GURU" : searchParams.get("type") === "PEGAWAI" ? "PEGAWAI" : "SISWA";
  const classId = searchParams.get("classId");

  let people: { identifier: string; name: string; avatar: string | null; sub: string | null; kelas: string | null; jurusan: string | null; ttl: string | null; religion: string | null }[] = [];

  if (type === "SISWA") {
    const students = await prisma.student.findMany({
      where: { studentStatus: "AKTIF", ...(classId ? { classId } : {}) },
      select: {
        nis: true, birthPlace: true, birthDate: true, religion: true, bukuIndukData: true,
        user: { select: { name: true, avatar: true } },
        class: { select: { name: true, major: { select: { name: true } } } },
      },
      orderBy: [{ class: { name: "asc" } }, { user: { name: "asc" } }],
    });
    people = students.map(s => ({
      identifier: s.nis,
      name: s.user.name,
      avatar: s.user.avatar || fotoMasukFallback(s.bukuIndukData),
      sub: s.class ? `${s.class.name}${s.class.major ? ` · ${s.class.major.name}` : ""}` : null,
      // "kelas"/"jurusan" dipisah dari "sub" (yg gabungan 1 baris) — supaya admin bisa taruh
      // masing2 di kotak teks sendiri dgn ukuran/lebar sendiri kalau nama jurusannya panjang dan
      // bikin "sub" wrap 2 baris nabrak elemen lain.
      kelas: s.class?.name ?? null,
      jurusan: s.class?.major?.name ?? null,
      ttl: fmtTtl(s.birthPlace, s.birthDate),
      religion: s.religion,
    }));
  } else if (type === "GURU") {
    const teachers = await prisma.teacher.findMany({
      select: { nip: true, subject: true, bukuIndukData: true, user: { select: { name: true, avatar: true } } },
      orderBy: { user: { name: "asc" } },
    });
    people = teachers.map(t => ({
      identifier: t.nip, name: t.user.name, avatar: t.user.avatar || fotoMasukFallback(t.bukuIndukData),
      sub: t.subject, kelas: null, jurusan: null, ttl: null, religion: null,
    }));
  } else {
    const staff = await prisma.user.findMany({
      where: { role: { in: ["TAS", "ADMIN"] } },
      select: {
        name: true, email: true, avatar: true,
        staffJabatan: { select: { jabatan: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    });
    people = staff.map(u => ({
      identifier: u.email.split("@")[0],
      name: u.name,
      avatar: u.avatar,
      sub: u.staffJabatan[0]?.jabatan.name ?? "Tenaga Kependidikan",
      kelas: null, jurusan: null, ttl: null, religion: null,
    }));
  }

  const withQr = await Promise.all(
    people.map(async p => ({ ...p, qr: await generateQrWithLogoDataUrl(p.identifier) }))
  );

  return NextResponse.json(withQr);
}
