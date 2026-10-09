import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { templateSurat } from "@/lib/template-surat";
import { bacaIsian, nilaiAwal, terapkan } from "@/lib/template-isian";
import { nomorSuratBerikutnya } from "@/lib/nomor-surat-berikutnya";
import { dataSiswa } from "@/lib/surat-dari-permohonan";

/** SURAT KELUAR UNTUK SATU SISWA DARI PUSTAKA TEMPLAT (9 Okt 2026) — dipakai Mutasi Siswa (MUT_KELUAR / MUT_MASUK) dan Paket
 *  Kelulusan (KET_LULUS). Sama dengan jalur permohonan (`buatSuratDariPermohonan`): baris `Surat` KELUAR biasa di buku agenda
 *  TU, nomor dari `nomorSuratBerikutnya` (satu urutan sekolah), isi dari templat dengan identitas siswa terisi sendiri —
 *  jadi tetap bisa dibuka & dirapikan di Persuratan dan otomatis ber-QR saat dicetak (#49).
 *  Dipanggil BERURUTAN (jangan Promise.all): nomor berikutnya dihitung dari surat yang sudah tersimpan. */
export async function buatSuratSiswa(o: { template: string; studentId: string; tanggal: Date; isi?: Record<string, string>; pihak?: string }) {
  const t = templateSurat(o.template);
  if (!t) throw new Error(`Templat surat "${o.template}" tidak ditemukan.`);
  const [settings, tahun, siswa] = await Promise.all([
    getSettings(["school.structure"]),
    prisma.academicYear.findFirst({ where: { isActive: true }, select: { name: true } }),
    dataSiswa(o.studentId),
  ]);
  if (!siswa) throw new Error("Siswa tidak ditemukan.");
  const isian = bacaIsian(t.html, t.subjek ?? "siswa");
  const nilai = nilaiAwal(isian, siswa, { kepalaSekolah: getPrincipalName(settings["school.structure"]) || "", tahunPelajaran: tahun?.name ?? "" });
  for (const [k, v] of Object.entries(o.isi ?? {})) if (v.trim()) nilai[k] = v.trim();
  const nomor = await nomorSuratBerikutnya(t.klasifikasi, o.tanggal);
  const surat = await prisma.surat.create({
    data: {
      tipe: "KELUAR", nomor, tanggal: o.tanggal, pihak: o.pihak ?? t.pihak, perihal: t.perihal, klasifikasi: t.klasifikasi,
      content: terapkan(t.html, nilai, isian), penandaTangan: "Kepala SMK Al Munawwir IIBS", templateValue: t.value, templateIsi: nilai,
      keterangan: `${siswa.name}${siswa.className ? ` (${siswa.className})` : ""}`,
    },
    select: { id: true, nomor: true },
  });
  return surat;
}
