import RekapNilaiUjian from "@/components/ujian/RekapNilaiUjian";

export const metadata = { title: "Rekap Nilai Ujian" };

/** Rekap nilai per kegiatan — leger per kelas, per mapel, ringkasan + unduh Excel (21 September 2026). */
export default function RekapNilaiPage() {
  return <RekapNilaiUjian />;
}
