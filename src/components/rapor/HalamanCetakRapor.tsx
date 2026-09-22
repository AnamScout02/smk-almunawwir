import { FileText } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { aksesRaporKelas } from "@/lib/rapor-form-server";
import { susunRaporKelas } from "@/lib/rapor-cetak";
import { susunHalamanDepan } from "@/lib/rapor-depan";
import { jenisQrDari, qrRapor } from "@/lib/rapor-qr";
import { semesterRapor } from "@/lib/rapor-verifikasi";
import PageHeader from "@/components/admin/PageHeader";
import CetakRapor, { type JenisRapor } from "@/components/rapor/CetakRapor";

/** Halaman cetak rapor satu kelas — dipakai portal guru (wali kelas, Wakakur, Kepala Sekolah) dan portal admin. */
export default async function HalamanCetakRapor({ sp, basePath, kembaliHref }: {
  sp: { classId?: string; semester?: string; jenis?: string; siswa?: string; dari?: string }; basePath: string; kembaliHref: string;
}) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const classId = sp.classId ?? "", semester = sp.semester ?? "";
  const jenis: JenisRapor = sp.jenis === "ts" || sp.jenis === "diniyah" || sp.jenis === "depan" ? sp.jenis : "akhir";
  const boleh = semesterRapor().includes(semester) && classId ? await aksesRaporKelas(session, classId) : null;
  const data = boleh ? await susunRaporKelas(classId, semester) : null;
  const depan = data && jenis === "depan" ? await susunHalamanDepan(classId) : null;
  // QR keaslian hanya untuk rapor yang SUDAH DISAHKAN (pratinjau sebelum sah tidak boleh berlabel "asli").
  const jq = jenisQrDari(jenis);
  const qr = data?.disahkan && jq ? await qrRapor(data.siswa.map(s => s.id), semester, jq, data.kelas.nama).catch(() => ({})) : undefined;
  const href = (j: JenisRapor) => `${basePath}?${new URLSearchParams({ classId, semester, jenis: j, ...(sp.dari ? { dari: sp.dari } : {}) }).toString()}`;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <PageHeader icon={<FileText size={22} />} title="Cetak Rapor" printHidden
        description={data ? `${data.kelas.nama} · Semester ${semester}` : "Rapor kelas"} />
      {!data ? (
        <p className="error-msg">Rapor tidak ditemukan atau Anda tidak berhak membuka rapor kelas ini.</p>
      ) : (
        <CetakRapor data={data} jenis={jenis} kembaliHref={kembaliHref} siswaAwal={sp.siswa} depan={depan} qr={qr}
          hrefJenis={{ depan: href("depan"), akhir: href("akhir"), ts: href("ts"), diniyah: href("diniyah") }} />
      )}
    </div>
  );
}
