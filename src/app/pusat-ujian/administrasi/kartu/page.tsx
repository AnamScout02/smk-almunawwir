export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, IdCard } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { generateQrDataUrl } from "@/lib/qrcode";
import { bolehCetakKelas } from "@/lib/administrasi-ujian";
import { nomorPeserta, ruangUntukSiswa } from "@/lib/denah-ruang";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";

/** KARTU PESERTA UJIAN — satu kartu per siswa aktif satu kelas, ukuran kartu ID CR80 (85,6 × 54 mm,
 * sama dengan Kartu Tanda) supaya mudah digunting & dilaminating. 10 kartu per lembar A4.
 * Satu kartu berlaku untuk seluruh ujian dalam satu kegiatan. QR membuka Portal Peserta di alamat
 * server yang sedang dipakai (bukan env yang masih "localhost"). */
export default async function KartuPesertaPage({ searchParams }: { searchParams: Promise<{ kelas?: string; kegiatan?: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { kelas: classId, kegiatan: kegiatanId } = await searchParams;
  if (!classId || !(await bolehCetakKelas(session, classId))) notFound();

  const [kelas, kegiatan, siswa, settings, h] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { name: true } }),
    kegiatanId ? prisma.kegiatanUjian.findUnique({ where: { id: kegiatanId }, select: { nama: true, singkatan: true, academicYear: { select: { name: true } } } }) : null,
    prisma.student.findMany({
      where: { classId, studentStatus: "AKTIF" },
      select: { id: true, nis: true, user: { select: { name: true, email: true, avatar: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    getSettings(["logo.emblem", "school.name"]),
    headers(),
  ]);
  if (!kelas) notFound();
  const tempatSiswa = kegiatanId ? await ruangUntukSiswa(kegiatanId, siswa.map(s => s.id)) : null;

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const alamatPortal = `${proto}://${host}/ujian-online`;
  const qr = await generateQrDataUrl(alamatPortal);
  const judulKegiatan = kegiatan ? `${kegiatan.nama}${kegiatan.academicYear ? ` ${kegiatan.academicYear.name}` : ""}` : "Ujian Berbasis Komputer";

  const lembar: typeof siswa[] = [];
  for (let i = 0; i < siswa.length; i += 10) lembar.push(siswa.slice(i, i + 10));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{"@page { size: A4 portrait; margin: 7mm 10mm; }"}</style>
      <PageHeader icon={<IdCard size={22} />} title="Kartu Peserta Ujian" description={`${kelas.name} · ${siswa.length} siswa · ${judulKegiatan}`} printHidden />
      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/pusat-ujian/administrasi" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
        <span className="text-xs text-gray-400">Cetak di A4, skala 100% (bukan &ldquo;Sesuaikan dengan halaman&rdquo;), lalu gunting sesuai garis.</span>
      </div>

      {siswa.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada siswa aktif di kelas ini.</p>
      ) : lembar.map((isi, li) => (
        <div key={li} className="print-doc bg-white mx-auto mb-6 print:mb-0 grid grid-cols-2 gap-x-[4mm] gap-y-[3mm] content-start print:break-after-page"
          style={{ width: "175.2mm" }}>
          {isi.map((s, i) => {
            const nomor = nomorPeserta(kegiatan?.singkatan, kelas.name, li * 10 + i + 1);
            const tempat = tempatSiswa?.get(s.id);
            const inisial = s.user.name.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
            return (
              <div key={s.id} className="relative overflow-hidden rounded-[3mm] border border-dashed border-gray-400 text-white break-inside-avoid"
                style={{ width: "85.6mm", height: "54mm", background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 45%, #1B2B6B 100%)", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                <div className="flex items-center gap-[1.5mm] px-[3mm] pt-[2.5mm]">
                  {settings["logo.emblem"] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings["logo.emblem"]} alt="" style={{ width: "6.5mm", height: "6.5mm" }} />
                  )}
                  <div className="leading-tight min-w-0 flex-1">
                    <p className="font-bold uppercase tracking-wide text-[#E8A020]" style={{ fontSize: "2.4mm" }}>Kartu Peserta Ujian</p>
                    <p className="text-white/70 truncate" style={{ fontSize: "1.9mm" }}>{judulKegiatan}</p>
                  </div>
                  <p className="font-mono font-bold bg-white/10 rounded px-[1.2mm] py-[0.4mm] whitespace-nowrap" style={{ fontSize: "2mm" }}>{nomor}</p>
                </div>
                <div className="flex gap-[2.5mm] px-[3mm] pt-[2mm]">
                  <div className="shrink-0 rounded-[1.5mm] border border-white/30 bg-white/10 flex items-center justify-center overflow-hidden" style={{ width: "15mm", height: "20mm" }}>
                    {s.user.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.user.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-center text-white/50 leading-tight" style={{ fontSize: "2mm" }}>{inisial}<br />foto 3×4</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1" style={{ fontSize: "2.2mm" }}>
                    <p className="font-bold leading-tight line-clamp-2" style={{ fontSize: "3mm" }}>{s.user.name}</p>
                    <table className="mt-[1mm] w-full" style={{ fontSize: "2.1mm" }}>
                      <tbody>
                        <tr><td className="text-white/60 pr-[1mm] align-top">NIS</td><td className="font-mono">{s.nis}</td></tr>
                        <tr><td className="text-white/60 pr-[1mm] align-top">Kelas</td><td>{kelas.name}</td></tr>
                        {tempat && <tr><td className="text-white/60 pr-[1mm] align-top">Ruang</td><td>{tempat.label}</td></tr>}
                        <tr><td className="text-white/60 pr-[1mm] align-top">Username</td><td className="font-mono break-all">{s.user.email}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="absolute left-[3mm] right-[3mm] bottom-[2.5mm] bg-white rounded-[1.5mm] px-[2mm] py-[1mm] flex items-center gap-[2mm] text-[#0F1A45]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="QR Portal Ujian" style={{ width: "9mm", height: "9mm" }} />
                  <div className="leading-tight min-w-0" style={{ fontSize: "1.9mm" }}>
                    <p className="font-bold">Pindai untuk membuka Portal Ujian</p>
                    <p className="text-gray-500 truncate">{alamatPortal.replace(/^https?:\/\//, "")} · bawa kartu ini setiap ujian</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
