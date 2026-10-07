export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import PageHeader from "@/components/admin/PageHeader";
import { BarisKembali } from "@/components/shared/TombolKembali";
import { bacaIsiTahap, hitungImt, type JawabanTahap } from "@/lib/spmb-tahapan";

/** CATATAN SPMB SISWA (6 Oktober 2026) — hasil asesmen awal & cek fisik/kesehatan saat SPMB, untuk
 *  wali kelas siswa itu, Guru BK, Wakasek Kesiswaan, dan admin (keputusan user: data sensitif). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await verifyRole(["TEACHER", "ADMIN"]);

  const siswa = await prisma.student.findUnique({
    where: { id },
    select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true, homeroom: { select: { user: { select: { email: true } } } } } } },
  });
  if (!siswa) notFound();

  if (session.role !== "ADMIN") {
    const wali = siswa.class?.homeroom?.user.email === session.email;
    const bk = (await getJabatanNames(session.email).catch(() => [])).some(j => KESISWAAN_BK_JABATAN.includes(j));
    if (!wali && !bk) redirect("/dashboard/teacher/students");
  }

  const a = await prisma.admission.findUnique({
    where: { studentId: id },
    select: { nomor: true, asesmen: true, asesmenAt: true, asesmenOleh: true, pemeriksaan: true, pemeriksaanAt: true, pemeriksaanOleh: true, seragam: true },
  });
  const asesmen = bacaIsiTahap(a?.asesmen);
  const periksa = bacaIsiTahap(a?.pemeriksaan);
  const cari = (k: string) => Number(periksa.jawaban.find(j => j.bukuInduk === k)?.nilai);
  const imt = hitungImt(cari("height"), cari("weight"));
  const tgl = (d: Date | null | undefined) => d ? d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : "";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardList size={22} />} title="Catatan SPMB Siswa"
        description={`${siswa.user.name} · ${siswa.nis}${siswa.class ? ` · ${siswa.class.name}` : ""}`} />
      <BarisKembali href="/dashboard/teacher/students" />
      <div className="space-y-6">
        {!a ? (
          <div className="panel p-5"><p className="py-10 text-center text-sm text-gray-400">Siswa ini tidak masuk lewat SPMB online, jadi belum ada catatan asesmen & kesehatan.</p></div>
        ) : (
          <>
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Data rahasia — untuk pembinaan siswa. Jangan dibagikan di luar wali kelas, BK, dan pimpinan.
            </p>
            <Kartu judul="Asesmen Awal" ket={a.asesmenAt ? `Dilakukan ${tgl(a.asesmenAt)}${a.asesmenOleh ? ` oleh ${a.asesmenOleh}` : ""}` : "Belum dilakukan"} jawaban={asesmen.jawaban} catatan={asesmen.catatan} />
            <Kartu judul="Cek Fisik & Kesehatan" ket={a.pemeriksaanAt ? `Dilakukan ${tgl(a.pemeriksaanAt)}${a.pemeriksaanOleh ? ` oleh ${a.pemeriksaanOleh}` : ""}` : "Belum dilakukan"}
              jawaban={periksa.jawaban} catatan={periksa.catatan} tambahan={imt ? `IMT ${imt.nilai} — ${imt.kategori}` : undefined} />
          </>
        )}
      </div>
    </div>
  );
}

function Kartu({ judul, ket, jawaban, catatan, tambahan }: { judul: string; ket: string; jawaban: JawabanTahap[]; catatan?: string; tambahan?: string }) {
  const kelompok = Array.from(new Set(jawaban.map(j => j.kelompok || "Umum")));
  const terisi = jawaban.filter(j => j.nilai);
  return (
    <div className="panel p-5">
      <p className="panel-judul">{judul}</p>
      <p className="mb-4 text-sm text-gray-500">{ket}</p>
      {terisi.length === 0 ? <p className="text-sm text-gray-400">Belum ada isian.</p> : (
        <div className="space-y-4">
          {kelompok.map(k => {
            const isi = terisi.filter(j => (j.kelompok || "Umum") === k);
            if (!isi.length) return null;
            return (
              <div key={k}>
                <p className="label-kecil mb-2 text-primary-700">{k}</p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {isi.map(j => (
                    <div key={j.id} className="min-w-0">
                      <dt className="text-xs text-gray-400">{j.label}</dt>
                      <dd className="whitespace-pre-line break-words text-gray-700">{j.nilai}{j.satuan ? ` ${j.satuan}` : ""}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      )}
      {tambahan && <p className="mt-4 text-sm text-gray-600">{tambahan}</p>}
      {catatan && <p className="mt-4 whitespace-pre-line rounded-xl bg-gray-50 p-3 text-sm text-gray-600">{catatan}</p>}
    </div>
  );
}
