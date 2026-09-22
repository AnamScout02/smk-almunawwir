import { prisma } from "@/lib/prisma";
import { susunRaporKelas } from "@/lib/rapor-cetak";
import { semesterRapor } from "@/lib/rapor-verifikasi";
import CetakRapor, { type JenisRapor } from "@/components/rapor/CetakRapor";
import { jenisQrDari, qrRapor } from "@/lib/rapor-qr";

/** Semester yang rapor format sekolahnya sudah boleh dilihat siswa & orang tua: kelas sudah DISAHKAN Kepala Sekolah dan ada
 * Form Nilai Rapor yang dikirim guru mapel (CLAUDE.md #43, #75). */
export async function semesterRaporSekolah(classId: string | null): Promise<string[]> {
  if (!classId) return [];
  const daftar = semesterRapor();
  const [sah, form] = await Promise.all([
    prisma.raporApproval.findMany({ where: { classId, semester: { in: daftar } }, select: { semester: true } }),
    prisma.formNilaiRapor.findMany({ where: { classId, semester: { in: daftar }, status: "DIKIRIM" }, select: { semester: true }, distinct: ["semester"] }),
  ]);
  const adaForm = new Set(form.map(f => f.semester));
  return daftar.filter(s => adaForm.has(s) && sah.some(a => a.semester === s)).reverse();
}

/** Rapor format sekolah untuk SATU siswa (portal Siswa & Orang Tua). Data dihitung sekelas (peringkat), tetapi yang dikirim ke
 * browser HANYA baris siswa itu — data teman sekelas tidak pernah ikut. */
export default async function RaporSekolahSiswa({ studentId, classId, semester, jenis, href, kembaliHref }: {
  studentId: string; classId: string | null; semester: string; jenis: JenisRapor; href: (j: JenisRapor) => string; kembaliHref: string;
}) {
  const boleh = (await semesterRaporSekolah(classId)).includes(semester);
  const data = boleh && classId ? await susunRaporKelas(classId, semester) : null;
  const milik = data?.siswa.filter(s => s.id === studentId) ?? [];
  if (!data || !milik.length) {
    return <p className="error-msg">Rapor semester ini belum disahkan Kepala Sekolah atau belum tersedia.</p>;
  }
  const jq = jenisQrDari(jenis);
  const qr = data.disahkan && jq ? await qrRapor([studentId], semester, jq, data.kelas.nama).catch(() => ({})) : undefined;
  return (
    <CetakRapor data={{ ...data, siswa: milik }} jenis={jenis} kembaliHref={kembaliHref} mandiri qr={qr}
      hrefJenis={{ akhir: href("akhir"), ts: href("ts"), diniyah: href("diniyah") }} />
  );
}
