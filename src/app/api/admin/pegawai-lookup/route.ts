import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Daftar guru & pegawai untuk dropdown modul Cuti. Dikembalikan SEKALIGUS (bukan pencarian
 * bertahap spt siswa) karena jumlah pegawai sekolah ini puluhan, bukan ratusan — <Select> sudah
 * otomatis jadi searchable di atas 8 opsi. */
export async function GET() {
  try {
    await verifyTasAccess();
    const rows = await prisma.teacher.findMany({
      where: { teacherStatus: { not: "KELUAR" } },
      select: { id: true, nip: true, position: true, subject: true, startDate: true,
                bukuIndukData: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    });
    return Response.json(rows.map(t => {
      const d = (t.bukuIndukData ?? {}) as Record<string, unknown>;
      const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
      const tgl = (v: unknown) => {
        const x = typeof v === "string" || v instanceof Date ? new Date(v) : null;
        return x && !isNaN(x.getTime())
          ? x.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : null;
      };
      return {
        id: t.id, name: t.user.name, nip: t.nip, position: t.position ?? "",
        // Dipakai formulir template surat kepegawaian (Keterangan Aktif Mengajar, dsb).
        subject: t.subject && !/^[-–—.]*$/.test(t.subject) ? t.subject : null,
        birthPlace: str("birthPlace"),
        birthDate: tgl(str("birthDate")),
        address: str("address"),
        nik: str("nik"),
        startDate: tgl(t.startDate),
      };
    }));
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat data pegawai" }, { status: 500 });
  }
}
