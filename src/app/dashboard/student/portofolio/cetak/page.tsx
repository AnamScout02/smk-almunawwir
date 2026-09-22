export const dynamic = "force-dynamic";

import { FileUser } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { portofolioSiswa } from "@/lib/portofolio-siswa";
import { getSettings } from "@/lib/site-settings";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import { TautanIkon } from "@/components/shared/IkonNama";

export const metadata = { title: "Cetak Portofolio" };

const tgl = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** CETAK PORTOFOLIO / CV SISWA (A4) — data dari sistem, dengan QR verifikasi data siswa. */
export default async function Page() {
  const session = await verifyRole(["STUDENT"]);
  const siswa = await prisma.student.findFirst({ where: { userId: session.userId }, select: { id: true } });
  const [p, s] = await Promise.all([
    siswa ? portofolioSiswa(siswa.id) : Promise.resolve(null),
    getSettings(["school.name", "logo.emblem", "contact.address"]),
  ]);
  const qr = p?.siswa.verificationToken ? await generateQrDataUrl(`${ALAMAT_APLIKASI}/verify/${p.siswa.verificationToken}`) : null;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{`@page { size: A4; margin: 1.2cm; }`}</style>
      <PageHeader icon={<FileUser size={22} />} title="Cetak Portofolio" description="Rangkuman resmi dari data sekolah" printHidden />
      <div className="alat-aksi justify-end mb-5 print:hidden">
        <TautanIkon href="/dashboard/student/portofolio" ikon="kembali" className="btn-modal-cancel">Kembali</TautanIkon>
        <PrintButton />
      </div>
      {!p ? <p className="text-center text-sm text-gray-500">Data tidak ditemukan.</p> : (
        <div className="print-doc bg-white mx-auto w-full max-w-[210mm] p-8 print:p-0">
          <PrintKop title="PORTOFOLIO PESERTA DIDIK" subtitle={s["school.name"] || "SMK Al-Munawwir IIBS"} logoUrl={s["logo.emblem"]} />
          <div className="mt-4 flex items-start justify-between gap-4">
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-gray-600">Nama</dt><dd className="font-semibold">{p.siswa.nama}</dd>
              <dt className="text-gray-600">NIS / NISN</dt><dd>{p.siswa.nis}{p.siswa.nisn ? ` / ${p.siswa.nisn}` : ""}</dd>
              <dt className="text-gray-600">Kelas</dt><dd>{p.siswa.kelas} — {p.siswa.jurusan}</dd>
              {p.siswa.tanggalLahir && <><dt className="text-gray-600">Tempat, tgl lahir</dt><dd>{[p.siswa.tempatLahir, tgl(p.siswa.tanggalLahir)].filter(Boolean).join(", ")}</dd></>}
              {p.siswa.alamat && <><dt className="text-gray-600">Alamat</dt><dd>{p.siswa.alamat}</dd></>}
              {p.siswa.hp && <><dt className="text-gray-600">Kontak</dt><dd>{p.siswa.hp}</dd></>}
            </dl>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <div className="text-center"><img src={qr} alt="QR data siswa" className="h-[22mm] w-[22mm]" /><p className="mt-1 max-w-[30mm] text-[9px] leading-tight text-gray-600">Pindai untuk memeriksa data</p></div>}
          </div>

          <h2 className="mt-6 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide">Capaian Akademik</h2>
          {p.rapor.length === 0 ? <p className="mt-1 text-sm text-gray-500">Belum ada rapor yang disahkan.</p> : (
            <table className="data-table mt-2"><thead><tr><th>Semester</th><th className="text-center">Jumlah mapel</th><th className="text-center">Rata-rata</th></tr></thead>
              <tbody>{p.rapor.map(r => <tr key={r.semester}><td>{r.semester}</td><td className="angka text-center">{r.jumlahMapel}</td><td className="angka text-center">{r.rata != null ? Math.round(r.rata * 10) / 10 : "—"}</td></tr>)}</tbody>
            </table>
          )}

          <h2 className="mt-6 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide">Prestasi</h2>
          {p.prestasi.length === 0 ? <p className="mt-1 text-sm text-gray-500">—</p> : (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {p.prestasi.map(x => <li key={x.id}>{x.jenis}{x.catatan ? ` — ${x.catatan}` : ""} <span className="text-gray-600">({tgl(x.tanggal)})</span></li>)}
            </ol>
          )}

          <h2 className="mt-6 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide">Ekstrakurikuler</h2>
          {p.ekstra.length === 0 ? <p className="mt-1 text-sm text-gray-500">—</p> : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {p.ekstra.map(e => <li key={e.nama}>{e.nama}{e.peran ? ` · ${e.peran}` : ""}{e.predikat ? ` — predikat ${e.predikat}` : ""}</li>)}
            </ul>
          )}

          <h2 className="mt-6 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide">Praktik Kerja Lapangan</h2>
          {!p.pkl ? <p className="mt-1 text-sm text-gray-500">—</p> : (
            <p className="mt-2 text-sm">{p.pkl.company} — {p.pkl.position}; {tgl(p.pkl.startDate)} s.d. {tgl(p.pkl.endDate)}{p.pkl.nilaiIndustriRata != null ? `; nilai pembimbing industri ${p.pkl.nilaiIndustriRata}` : ""}.</p>
          )}

          <p className="mt-8 text-xs text-gray-600">Dokumen ini dicetak dari sistem informasi {s["school.name"] || "SMK Al-Munawwir IIBS"} pada {tgl(new Date())} dan dapat diperiksa keasliannya lewat QR di atas.</p>
        </div>
      )}
    </div>
  );
}
