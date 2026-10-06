export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import LembarSurat from "@/components/shared/LembarSurat";
import PrintButton from "@/components/shared/PrintButton";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { buildPrintFilename } from "@/lib/print-filename";
import TombolKembali from "@/components/shared/TombolKembali";
import { cocokkanNamaPegawai, petaTtd } from "@/lib/ttd";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meeting = await prisma.meetingMinutes.findUnique({ where: { id }, select: { topic: true, date: true } });
  return { title: { absolute: buildPrintFilename("NOTULEN_RAPAT", meeting?.topic, meeting ? fmtLong(meeting.date) : null) } };
}

interface StructureRow { role: string; name: string; highlight?: boolean }

function fmtLong(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function getPrincipalName(structureJson: string): string {
  try {
    const parsed = JSON.parse(structureJson || "[]") as StructureRow[];
    return parsed.find(r => r.highlight)?.name ?? parsed[0]?.name ?? "";
  } catch {
    return "";
  }
}

// indent: 0 = level utama, 1 = "a./b.", dst — hanya menggeser teks label DI DALAM kolom label yang
// lebarnya tetap, supaya posisi titik dua selalu sejajar di semua baris berapapun tingkat indentasinya.
function FieldRow({ label, value, indent = 0 }: { label: string; value: string | null; indent?: number }) {
  return (
    <div className="flex items-baseline gap-3 py-1">
      <span className="w-44 shrink-0" style={{ paddingLeft: indent * 20 }}>{label}</span>
      <span>:</span>
      <span className="flex-1 border-b border-gray-300 pb-0.5">{value || " "}</span>
    </div>
  );
}

export default async function CetakNotulenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [meeting, s] = await Promise.all([
    prisma.meetingMinutes.findUnique({ where: { id }, include: { attendees: { orderBy: { name: "asc" } } } }),
    getSettings(["letterhead.bukuInduk", "letterhead.kopBawah", "school.structure"]),
  ]);
  if (!meeting) notFound();
  const principalName = getPrincipalName(s["school.structure"]);
  const kopAtas = s["letterhead.bukuInduk"];
  const kopBawah = s["letterhead.kopBawah"];

  const greetings = meeting.greetings.length > 0 ? meeting.greetings : [""];
  // Kolom KIRI diisi penuh dulu (1–15), baru kolom kanan (16–30) — nomor berurutan tanpa celah. Dulu peserta dibagi
  // separuh-separuh sehingga 20 peserta tercetak 1–10 lalu langsung 16–25 (temuan user 5 Okt 2026). Lebih dari 30 peserta:
  // baris bertambah dan tetap dibagi rata.
  const rowCount = Math.max(15, Math.ceil(meeting.attendees.length / 2));
  const attendeesLeft = meeting.attendees.slice(0, rowCount);
  const attendeesRight = meeting.attendees.slice(rowCount);
  // TTD peserta & notulis (src/lib/ttd.ts): akun dari MeetingAttendee.userId, cadangan nama yang cocok PERSIS satu
  // pegawai. Peserta tanpa TTD/akun (tamu luar) tetap bertanda ✓ seperti dulu.
  const cocok = await cocokkanNamaPegawai([...meeting.attendees.map(a => a.name), meeting.notulis ?? "", principalName].filter(Boolean));
  const akunDari = (nama: string, userId?: string | null) => userId ?? cocok.get(nama) ?? null;
  // Kepala Sekolah ikut ditandatangani dengan TTD PRIBADI-nya (permintaan user 5 Okt 2026) — nama dari Struktur Organisasi
  // dicocokkan ke akun seperti peserta; bukan TTD jabatan berstempel (itu untuk surat atas nama sekolah).
  const ttd = await petaTtd([...meeting.attendees.map(a => akunDari(a.name, a.userId)), meeting.notulis ? akunDari(meeting.notulis) : null,
    principalName ? akunDari(principalName) : null]);
  const ttdNotulis = meeting.notulis ? ttd.get(akunDari(meeting.notulis) ?? "") : undefined;
  const ttdKepala = principalName ? ttd.get(akunDari(principalName) ?? "") : undefined;
  const selHadir = (a?: { name: string; userId: string | null }) => {
    if (!a) return "";
    const src = ttd.get(akunDari(a.name, a.userId) ?? "");
    // eslint-disable-next-line @next/next/no-img-element -- data URL TTD
    return src ? <img src={src} alt="TTD" className="mx-auto h-[7mm] max-w-full object-contain" /> : "✓";
  };

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:pt-0 bg-gray-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border border-gray-200 rounded-2xl px-6 py-3 flex items-center justify-between shadow-sm mb-6 max-w-[210mm] mx-auto">
        <TombolKembali href={"/dashboard/admin/notulen-rapat"} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-700 font-semibold" />
        <PrintButton />
      </div>

      <div className="flex flex-col gap-6 print:gap-0 print:block overflow-x-auto print:overflow-visible">
        {/* Halaman 1 — Notulen */}
        <LembarSurat kopAtas={kopAtas} kopBawah={kopBawah}>
            <h1 className="text-center font-bold text-lg uppercase underline mb-6">Notulen Rapat</h1>

            <div className="text-sm mb-8">
              <FieldRow label="Hari/Tanggal" value={fmtLong(meeting.date)} />
              <FieldRow label="Waktu" value={meeting.time} />
              <FieldRow label="Tempat" value={meeting.place} />
              <FieldRow label="Pemimpin Rapat" value={meeting.leader} />
              <FieldRow label="Materi Rapat" value={meeting.topic} />

              <div className="pt-2">
                <FieldRow label="Kegiatan Pembukaan" value="" />
                <FieldRow label="a. Dibuka oleh" value={meeting.openedBy} indent={1} />
                <FieldRow label="b. Sambutan dari" value="" indent={1} />
                <div className="space-y-1">
                  {greetings.map((g, i) => (
                    <div key={i} className="flex items-baseline gap-2" style={{ paddingLeft: 40 }}>
                      <span className="w-5 shrink-0">{i + 1}.</span>
                      <span className="flex-1 border-b border-gray-300 pb-0.5">{g || " "}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-start mt-6">
              <div className="text-sm text-center min-w-[180px]">
                <p className="mb-1">&nbsp;</p>
                <p className={ttdNotulis ? "" : "mb-16"}>Notulis</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL TTD */}
                {ttdNotulis && <img src={ttdNotulis} alt="TTD notulis" className="mx-auto h-16 object-contain" />}
                <p className="font-bold underline">{meeting.notulis || "__________________"}</p>
              </div>
              <div className="text-sm text-center min-w-[220px]">
                <p className="mb-1">Singojuruh, {fmtLong(meeting.date)}</p>
                <p className={ttdKepala ? "" : "mb-16"}>Kepala SMK Al Munawwir IIBS</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL TTD */}
                {ttdKepala && <img src={ttdKepala} alt="TTD Kepala Sekolah" className="mx-auto h-16 object-contain" />}
                <p className="font-bold underline">( {principalName || "__________________"} )</p>
              </div>
            </div>
        </LembarSurat>

        {/* Halaman 2 — Dokumentasi & Daftar Hadir */}
        <LembarSurat kopAtas={kopAtas} kopBawah={kopBawah}>
            {meeting.photos.length > 0 ? (
              meeting.photos.length === 1 ? (
                <div className="flex justify-center mb-8">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={meeting.photos[0]} alt="Dokumentasi rapat" className="max-w-full max-h-[70mm] object-contain rounded-lg border border-gray-200" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 mb-8 justify-items-center">
                  {meeting.photos.map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={p} alt={`Dokumentasi rapat ${i + 1}`} className="w-full h-40 object-contain rounded-lg border border-gray-200 bg-gray-50" />
                  ))}
                </div>
              )
            ) : (
              <div className="border border-gray-300 rounded-lg h-40 flex items-center justify-center text-gray-300 text-sm mb-8">
                Dokumentasi Rapat
              </div>
            )}

            <h2 className="text-center font-bold text-sm uppercase mb-3">Daftar Hadir Peserta Rapat</h2>
            <table className="w-full text-sm border border-gray-800 table-fixed">
              <colgroup>
                <col style={{ width: "6%" }} /><col style={{ width: "30%" }} /><col style={{ width: "14%" }} />
                <col style={{ width: "6%" }} /><col style={{ width: "30%" }} /><col style={{ width: "14%" }} />
              </colgroup>
              <thead>
                <tr style={{ background: "#0F1A45" }}>
                  <th className="border border-gray-800 text-white py-1.5">No</th>
                  <th className="border border-gray-800 text-white py-1.5">Nama</th>
                  <th className="border border-gray-800 text-white py-1.5">Paraf</th>
                  <th className="border border-gray-800 text-white py-1.5">No</th>
                  <th className="border border-gray-800 text-white py-1.5">Nama</th>
                  <th className="border border-gray-800 text-white py-1.5">Paraf</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rowCount }).map((_, i) => (
                  <tr key={i}>
                    <td className="border border-gray-800 text-center py-1.5">{i + 1}</td>
                    <td className="border border-gray-800 py-1.5 px-2 truncate">{attendeesLeft[i]?.name ?? ""}</td>
                    <td className="border border-gray-800 text-center py-0.5 font-bold">{selHadir(attendeesLeft[i])}</td>
                    <td className="border border-gray-800 text-center py-1.5">{rowCount + i + 1}</td>
                    <td className="border border-gray-800 py-1.5 px-2 truncate">{attendeesRight[i]?.name ?? ""}</td>
                    <td className="border border-gray-800 text-center py-0.5 font-bold">{selHadir(attendeesRight[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-gray-500 mt-1">Kolom paraf berisi tanda tangan digital peserta yang terdaftar di sistem; ✓ = hadir, tanda tangan belum diunggah.</p>
        </LembarSurat>

        {/* Halaman 3 — Hasil Keputusan */}
        <LembarSurat kopAtas={kopAtas} kopBawah={kopBawah} terakhir>
            <h2 className="text-center font-bold text-sm uppercase mb-6">Hasil Keputusan Rapat</h2>
            <div className="text-sm leading-8" style={{ backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, #d1d5db 32px)" }}>
              {(meeting.decisions || "").split("\n").map((line, i) => (
                <p key={i}>{line || " "}</p>
              ))}
            </div>
        </LembarSurat>
      </div>
    </div>
  );
}
