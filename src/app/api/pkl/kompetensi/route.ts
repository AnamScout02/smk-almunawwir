import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { balasTolak, sesiPkl } from "@/lib/pkl-server";

export const dynamic = "force-dynamic";

/** KECOCOKAN KOMPETENSI (9 Okt 2026). Tiga sumber yang memakai ISTILAH YANG SAMA (Major.skills):
 *  kompetensi jurusan → pekerjaan yang ditandai tersedia di tiap DUDI → kompetensi yang ditandai siswa di jurnal.
 *  Hasilnya menunjukkan kompetensi yang tidak disediakan DUDI mana pun dan yang tidak pernah dilatih. */
export async function GET() {
  try {
    await sesiPkl();
    const [jurusan, dudi, pkl] = await Promise.all([
      prisma.major.findMany({ select: { id: true, code: true, name: true, skills: true }, orderBy: { name: "asc" } }),
      prisma.industryPartner.findMany({ where: { aktif: true }, select: { id: true, name: true, pekerjaan: true, jurusanIds: true } }),
      prisma.internship.findMany({
        where: { status: { in: ["ONGOING", "COMPLETED"] }, mitraId: { not: null } },
        select: { studentId: true, mitraId: true, company: true, student: { select: { majorId: true, user: { select: { name: true } }, class: { select: { name: true } } } }, journal: { select: { kompetensi: true } } },
      }),
    ]);
    const kecil = (s: string) => s.trim().toLowerCase();
    return Response.json({
      jurusan: jurusan.map(j => {
        const peserta = pkl.filter(p => p.student.majorId === j.id);
        const baris = j.skills.map(k => {
          const sedia = dudi.filter(d => (!d.jurusanIds.length || d.jurusanIds.includes(j.id)) && d.pekerjaan.some(x => kecil(x) === kecil(k)));
          let entri = 0; const siswa = new Set<string>();
          for (const p of peserta) for (const e of p.journal) if (e.kompetensi.includes(k)) { entri++; siswa.add(p.studentId); }
          return { kompetensi: k, dudi: sedia.map(d => d.name), entri, siswa: siswa.size };
        });
        // Tiap DUDI yang ditempati siswa jurusan ini: berapa kompetensi jurusan yang benar-benar dilatih di sana.
        const perDudi = [...new Set(peserta.map(p => p.mitraId as string))].map(id => {
          const di = peserta.filter(p => p.mitraId === id);
          const dilatih = new Set(di.flatMap(p => p.journal.flatMap(e => e.kompetensi)));
          return { id, nama: di[0].company, siswa: di.length, jurnal: di.reduce((a, p) => a + p.journal.length, 0), dilatih: j.skills.filter(k => dilatih.has(k)).length };
        }).sort((a, b) => b.dilatih - a.dilatih);
        return {
          id: j.id, kode: j.code, nama: j.name, jumlahKompetensi: j.skills.length, peserta: peserta.length, baris, perDudi,
          jurnalTanpaTanda: peserta.reduce((a, p) => a + p.journal.filter(e => !e.kompetensi.length).length, 0),
          jurnal: peserta.reduce((a, p) => a + p.journal.length, 0),
        };
      }),
    });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
