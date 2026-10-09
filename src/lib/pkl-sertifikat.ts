import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getPrincipalName, getSettings } from "@/lib/site-settings";
import { nomorSertifikatBerikutnya } from "@/lib/pkl-humas";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

export type DataSertifikat = {
  id: string; nomor: string | null; nama: string; nis: string; kelas: string; jurusan: string; tempat: string; posisi: string;
  mulai: Date; selesai: Date; nilai: number | null; pembimbing: string; qr: string | null;
};
export type KopSertifikat = { sekolah: string; alamat: string; logo: string; kepala: string };

/** Data lembar sertifikat PKL untuk SATU atau BANYAK siswa (cetak massal, 9 Okt 2026). Nomor & token QR diterbitkan
 *  SEKALI saat sertifikat pertama dicetak (pola CLAUDE.md #49) — berurutan satu per satu supaya nomornya tidak kembar.
 *  Penjagaan akses dilakukan PEMANGGIL. */
export async function siapkanSertifikat(ids: string[]): Promise<{ kop: KopSertifikat; lembar: DataSertifikat[] }> {
  const ambil = () => prisma.internship.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, company: true, position: true, supervisor: true, startDate: true, endDate: true, nilaiIndustriRata: true, penilaiIndustri: true,
      sertifikatNomor: true, sertifikatToken: true,
      student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { name: true } } } },
    },
  });
  let pkl = await ambil();
  for (const p of pkl.filter(x => !x.sertifikatNomor)) {
    const tahun = new Date(p.endDate.getTime() + 7 * 3600_000).getUTCFullYear();
    for (let coba = 0; coba < 3; coba++) {
      try {
        await prisma.internship.update({ where: { id: p.id }, data: { sertifikatNomor: await nomorSertifikatBerikutnya(tahun), sertifikatToken: randomBytes(18).toString("base64url"), sertifikatPada: new Date() } });
        break;
      } catch (e) { if ((e as { code?: string }).code !== "P2002") throw e; }
    }
  }
  if (pkl.some(x => !x.sertifikatNomor)) pkl = await ambil();
  const [s, nilaiSekolah] = await Promise.all([
    getSettings(["school.name", "school.structure", "logo.emblem", "contact.address"]),
    prisma.grade.findMany({ where: { studentId: { in: pkl.map(p => p.student.id) }, subject: "PKL", type: "Nilai PKL" }, orderBy: { createdAt: "desc" }, select: { studentId: true, score: true } }),
  ]);
  const lembar = await Promise.all(pkl.map(async p => {
    const nilai = [nilaiSekolah.find(n => n.studentId === p.student.id)?.score, p.nilaiIndustriRata].filter((x): x is number => typeof x === "number");
    return {
      id: p.id, nomor: p.sertifikatNomor, nama: p.student.user.name, nis: p.student.nis, kelas: p.student.class?.name ?? "", jurusan: p.student.major?.name ?? "",
      tempat: p.company, posisi: p.position, mulai: p.startDate, selesai: p.endDate,
      nilai: nilai.length ? Math.round((nilai.reduce((a, b) => a + b, 0) / nilai.length) * 10) / 10 : null,
      pembimbing: p.penilaiIndustri || p.supervisor,
      qr: p.sertifikatToken ? await generateQrDataUrl(`${ALAMAT_APLIKASI}/verify/pkl/${p.sertifikatToken}`) : null,
    };
  }));
  lembar.sort((a, b) => a.kelas.localeCompare(b.kelas, "id", { numeric: true }) || a.nama.localeCompare(b.nama, "id"));
  return {
    kop: { sekolah: s["school.name"] || "SMK Al-Munawwir IIBS", alamat: s["contact.address"] ?? "", logo: s["logo.emblem"] ?? "", kepala: getPrincipalName(s["school.structure"]) || "........................" },
    lembar,
  };
}
