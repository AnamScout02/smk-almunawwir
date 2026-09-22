import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/types";

export interface HasilCari { grup: string; judul: string; keterangan: string; href: string }

/** PENCARIAN CEPAT (18 Sep 2026) — satu kotak cari untuk seluruh portal (Ctrl+K).
 * Cakupan data MENGIKUTI PERAN, bukan kata kuncinya: siswa/orang tua tidak pernah melihat data akun lain. */
export async function cariCepat(session: SessionPayload, kata: string): Promise<HasilCari[]> {
  const q = kata.trim();
  if (q.length < 2) return [];
  const cari = { contains: q, mode: "insensitive" as const };
  const hasil: HasilCari[] = [];
  const staf = session.role === "ADMIN";

  if (staf) {
    const [siswa, guru, kelas, surat] = await Promise.all([
      prisma.student.findMany({
        where: { OR: [{ user: { name: cari } }, { nis: cari }, { nisn: cari }] }, take: 6,
        select: { id: true, nis: true, studentStatus: true, user: { select: { name: true } }, class: { select: { name: true } } },
      }),
      prisma.teacher.findMany({
        where: { OR: [{ user: { name: cari } }, { nip: cari }, { subject: cari }] }, take: 5,
        select: { id: true, nip: true, subject: true, user: { select: { name: true } } },
      }),
      prisma.class.findMany({ where: { name: cari }, take: 4, select: { id: true, name: true, major: { select: { name: true } } } }),
      prisma.surat.findMany({
        where: { OR: [{ nomor: cari }, { perihal: cari }, { pihak: cari }] }, take: 5, orderBy: { tanggal: "desc" },
        select: { id: true, nomor: true, perihal: true, tipe: true },
      }),
    ]);
    hasil.push(
      ...siswa.map(s => ({ grup: "Siswa", judul: s.user.name, keterangan: `${s.nis}${s.class ? ` · ${s.class.name}` : ""}${s.studentStatus && s.studentStatus !== "AKTIF" ? ` · ${s.studentStatus}` : ""}`, href: `/dashboard/admin/students/${s.id}` })),
      ...guru.map(g => ({ grup: "Guru & Pegawai", judul: g.user.name, keterangan: `${g.nip} · ${g.subject}`, href: `/dashboard/admin/teachers` })),
      ...kelas.map(k => ({ grup: "Kelas", judul: k.name, keterangan: k.major?.name ?? "", href: "/dashboard/admin/classes" })),
      ...surat.map(s => ({ grup: "Persuratan", judul: s.perihal, keterangan: `${s.tipe === "MASUK" ? "Surat masuk" : "Surat keluar"} · ${s.nomor}`, href: `/dashboard/admin/persuratan` })),
    );
  } else if (session.role === "TEACHER") {
    const guru = await prisma.teacher.findFirst({
      where: { userId: session.userId },
      select: { homeroomOf: { select: { id: true } }, teachingLoad: { select: { classId: true } } },
    });
    const kelasBoleh = [...new Set([...(guru?.homeroomOf.map(k => k.id) ?? []), ...(guru?.teachingLoad.map(t => t.classId) ?? [])])];
    if (kelasBoleh.length) {
      const [siswa, kelas] = await Promise.all([
        prisma.student.findMany({
          where: { classId: { in: kelasBoleh }, OR: [{ user: { name: cari } }, { nis: cari }, { nisn: cari }] }, take: 8,
          select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } },
        }),
        prisma.class.findMany({ where: { id: { in: kelasBoleh }, name: cari }, take: 4, select: { id: true, name: true, major: { select: { name: true } } } }),
      ]);
      hasil.push(
        ...siswa.map(s => ({ grup: "Siswa saya", judul: s.user.name, keterangan: `${s.nis}${s.class ? ` · ${s.class.name}` : ""}`, href: "/dashboard/teacher/students" })),
        ...kelas.map(k => ({ grup: "Kelas saya", judul: k.name, keterangan: k.major?.name ?? "", href: "/dashboard/teacher/students" })),
      );
    }
  }

  // Katalog perpustakaan & pengumuman: terbuka untuk semua peran yang sudah masuk.
  const buku = await prisma.book.findMany({
    where: { OR: [{ title: cari }, { author: cari }, { category: cari }, { barcode: cari }] }, take: 5,
    select: { id: true, title: true, author: true, category: true },
  });
  hasil.push(...buku.map(b => ({ grup: "Perpustakaan", judul: b.title, keterangan: [b.author, b.category].filter(Boolean).join(" · "), href: "/perpustakaan" })));
  return hasil;
}
