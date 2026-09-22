import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { guruSaya, kelolaKepegawaian } from "@/lib/arsip-sk";
import { balasanExcel } from "@/lib/ekspor-excel";

export const dynamic = "force-dynamic";

const tgl = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "");

/** Rekap PKB ke Excel — pengelola kepegawaian mengunduh semua/ per guru, guru mengunduh miliknya. */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const kelola = await kelolaKepegawaian(session);
  const saya = await guruSaya(session.userId);
  const pilih = new URL(req.url).searchParams.get("teacherId");
  const teacherId = kelola ? (pilih || undefined) : saya?.id;
  if (!kelola && !teacherId) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const daftar = await prisma.pkbGuru.findMany({
    where: teacherId ? { teacherId } : {}, orderBy: [{ teacher: { user: { name: "asc" } } }, { mulai: "desc" }],
    include: { teacher: { select: { nip: true, user: { select: { name: true } } } } },
  });
  return balasanExcel({
    namaFile: `portofolio-pkb-${new Date().toISOString().slice(0, 10)}`,
    namaSheet: "Portofolio PKB",
    headers: ["Nama Guru", "NIP", "Kegiatan", "Jenis", "Penyelenggara", "Peran", "Mulai", "Selesai", "JP", "No. Sertifikat", "Catatan"],
    rows: daftar.map(d => [
      d.teacher.user.name, d.teacher.nip, d.judul, d.jenis, d.penyelenggara ?? "", d.peran ?? "",
      tgl(d.mulai), tgl(d.selesai), d.jamPelajaran ?? "", d.nomorSertifikat ?? "", d.catatan ?? "",
    ]),
  });
}
