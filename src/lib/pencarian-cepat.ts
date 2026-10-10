import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/types";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { TAS_JABATAN } from "@/lib/tas-jabatan";

export interface HasilCari { grup: string; judul: string; keterangan: string; href: string }

/** PENCARIAN CEPAT (18 Sep 2026) — satu kotak cari untuk seluruh portal (Ctrl+K).
 * Cakupan data MENGIKUTI PERAN, bukan kata kuncinya: siswa/orang tua tidak pernah melihat data akun lain. */
export async function cariCepat(session: SessionPayload, kata: string): Promise<HasilCari[]> {
  const q = kata.trim();
  if (q.length < 2) return [];
  const cari = { contains: q, mode: "insensitive" as const };
  const hasil: HasilCari[] = [];
  // Staf = Superadmin ATAU pemegang jabatan Tata Usaha (staf TAS maupun guru-TU) — dulu hanya ADMIN, sehingga petugas TU
  // tidak menemukan apa pun selain buku (10 Okt 2026). Syaratnya sama dengan `verifyTasAccess`.
  const admin = session.role === "ADMIN";
  const staf = admin || ((session.role === "TAS" || session.role === "TEACHER") && (await getJabatanNames(session.email).catch(() => [] as string[])).some(n => TAS_JABATAN.includes(n)));
  const u = encodeURIComponent;

  if (staf) {
    const [siswa, guru, kelas, surat, arsip, calon, dudi] = await Promise.all([
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
      prisma.arsip.findMany({ where: { judul: cari }, take: 4, orderBy: { tanggal: "desc" }, select: { id: true, judul: true, kategori: true } }).catch(() => []),
      prisma.admission.findMany({ where: { studentId: null, OR: [{ fullName: cari }, { nomor: cari }] }, take: 4, orderBy: { createdAt: "desc" }, select: { id: true, fullName: true, nomor: true, chosenMajor: true } }).catch(() => []),
      // Pusat PKL punya penjaganya sendiri (Humas/panitia) — hanya Superadmin yang pasti boleh membukanya dari sini.
      admin ? prisma.industryPartner.findMany({ where: { name: cari }, take: 4, select: { id: true, name: true, industryField: true } }).catch(() => []) : Promise.resolve([] as { id: string; name: string; industryField: string | null }[]),
    ]);
    hasil.push(
      ...siswa.map(s => ({ grup: "Siswa", judul: s.user.name, keterangan: `${s.nis}${s.class ? ` · ${s.class.name}` : ""}${s.studentStatus && s.studentStatus !== "AKTIF" ? ` · ${s.studentStatus}` : ""}`, href: `/dashboard/admin/students/${s.id}` })),
      ...guru.map(g => ({ grup: "Guru & Pegawai", judul: g.user.name, keterangan: `${g.nip} · ${g.subject}`, href: `/dashboard/admin/teachers/${g.id}` })),
      ...kelas.map(k => ({ grup: "Kelas", judul: k.name, keterangan: k.major?.name ?? "", href: "/dashboard/admin/classes" })),
      ...surat.map(s => ({ grup: "Persuratan", judul: s.perihal, keterangan: `${s.tipe === "MASUK" ? "Surat masuk" : "Surat keluar"} · ${s.nomor}`, href: `/dashboard/admin/persuratan?cari=${u(s.nomor)}${s.tipe === "KELUAR" ? "&tab=KELUAR" : ""}` })),
      ...arsip.map(a => ({ grup: "E-Arsip", judul: a.judul, keterangan: a.kategori, href: `/dashboard/admin/arsip?cari=${u(a.judul.slice(0, 80))}` })),
      ...calon.map(c => ({ grup: "Pendaftar SPMB", judul: c.fullName, keterangan: [c.nomor, c.chosenMajor].filter(Boolean).join(" · "), href: `/pusat-spmb/tahapan?buka=${c.id}` })),
      ...dudi.map(d => ({ grup: "DUDI / Mitra PKL", judul: d.name, keterangan: d.industryField ?? "", href: `/pusat-pkl/dudi/${d.id}` })),
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
  hasil.push(...buku.map(b => ({ grup: "Perpustakaan", judul: b.title, keterangan: [b.author, b.category].filter(Boolean).join(" · "), href: `/perpustakaan?cari=${u(b.title.slice(0, 80))}` })));
  return hasil;
}
