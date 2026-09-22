export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ujianDalamCakupan, kelasPeserta } from "@/lib/ujian-server";
import KisiKisiEditor from "@/components/ujian/KisiKisiEditor";

const cuplik = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);

/** KISI-KISI SOAL satu ujian — isian materi, indikator, level kognitif per butir (pembuat/Admin/Kurikulum),
 * pengampu lain hanya melihat & mencetak. */
export default async function KisiKisiPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { id } = await params;
  const exam = await ujianDalamCakupan(session, id);
  if (!exam) notFound();

  const [bolehUbah, soal, kelas] = await Promise.all([
    ujianDalamCakupan(session, id, { ubah: true }).then(Boolean),
    prisma.examQuestion.findMany({
      where: { examId: id }, orderBy: { order: "asc" },
      select: { id: true, tipe: true, skor: true, pertanyaan: true, kd: true, materi: true, indikator: true, levelKognitif: true },
    }),
    prisma.class.findMany({ where: { id: { in: kelasPeserta(exam) } }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <KisiKisiEditor examId={id} judul={exam.title} mapel={exam.subject} kelas={kelas.map(k => k.name)} bolehUbah={bolehUbah}
      butir={soal.map((s, i) => ({
        id: s.id, nomor: i + 1, tipe: s.tipe, skor: s.skor, cuplikan: cuplik(s.pertanyaan),
        kd: s.kd ?? "", materi: s.materi ?? "", indikator: s.indikator ?? "", levelKognitif: s.levelKognitif ?? "",
      }))} />
  );
}
