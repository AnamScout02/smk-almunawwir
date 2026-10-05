import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Panel from "@/components/shared/Panel";
import { BarDaftar, DonatBagian } from "@/components/shared/GrafikRingkas";
import { KisiMenuPortal } from "@/components/shared/NavPortal";
import { MENU_PUSAT_SPMB } from "@/lib/menu-portal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { gelombangDibuka } from "@/lib/spmb";
import { cocokJurusan } from "@/lib/spmb-konten";
import { LABEL_STATUS } from "@/lib/spmb-status";
import { LayoutDashboard } from "lucide-react";

export const dynamic = "force-dynamic";

/** Warna status seleksi — dipakai donat & pita bagian, sejalan dengan pasangan warna status
 *  DESIGN_SYSTEM §2 (hijau diterima, kuning menunggu/cadangan, merah belum diterima). */
const WARNA_STATUS: Record<string, string> = {
  PENDING: "#94a3b8", VERIFIKASI: "#3b82f6", DITERIMA: "#10b981",
  CADANGAN: "#f59e0b", DITOLAK: "#ef4444", ACCEPTED: "#10b981", REJECTED: "#ef4444",
};
const URUT_STATUS = ["PENDING", "VERIFIKASI", "DITERIMA", "CADANGAN", "DITOLAK"];

/** Beranda Pusat SPMB — angka ringkas, grafik sebaran, tabel kuota, dan seluruh menu portal.
 *  Ikon diteruskan sebagai NAMA ke komponen klien (CLAUDE.md #35). */
export default async function PusatSpmbPage() {
  const [pendaftar, jurusan, s, gelombangBuka, semuaGelombang, komponen, syarat] = await Promise.all([
    prisma.admission.findMany({
      select: {
        id: true, nomor: true, fullName: true, chosenMajor: true, jalur: true, gender: true,
        status: true, createdAt: true, paymentVerified: true, studentId: true,
        gelombang: { select: { nama: true } },
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => []),
    prisma.major.findMany({ select: { id: true, name: true, code: true, themeColor: true }, orderBy: { name: "asc" } }).catch(() => []),
    getSettings(["spmb.tahun", "spmb.hasilDibuka", "spmb.poster"]).catch(() => ({} as Record<string, string>)),
    gelombangDibuka().catch(() => null),
    prisma.gelombangSpmb.findMany({
      where: { aktif: true }, orderBy: { urutan: "asc" },
      include: { kuota: { include: { major: { select: { id: true, name: true, code: true, themeColor: true } } } } },
    }).catch(() => []),
    prisma.komponenNilaiSpmb.count({ where: { aktif: true } }).catch(() => 0),
    prisma.dokumenSyaratSpmb.count({ where: { aktif: true } }).catch(() => 0),
  ]);

  const total = pendaftar.length;
  const menunggu = pendaftar.filter(p => ["PENDING", "VERIFIKASI"].includes(p.status)).length;
  const diterima = pendaftar.filter(p => ["DITERIMA", "ACCEPTED"].includes(p.status)).length;
  const lunas = pendaftar.filter(p => p.paymentVerified).length;
  const jadiSiswa = pendaftar.filter(p => p.studentId).length;
  const hasilDibuka = s["spmb.hasilDibuka"] === "1";

  // --- Sebaran per jurusan: warna mengikuti Major.themeColor (DESIGN_SYSTEM §2), bukan warna baru.
  const perJurusan = jurusan
    .map(m => ({
      kunci: m.id, label: m.name, sublabel: m.code,
      nilai: pendaftar.filter(p => cocokJurusan(p.chosenMajor, m)).length,
      warna: m.themeColor || "#1B2B6B",
    }))
    .filter(d => d.nilai > 0)
    .sort((a, b) => b.nilai - a.nilai);
  const tanpaJurusan = total - perJurusan.reduce((a, d) => a + d.nilai, 0);

  // --- Sebaran per jalur (kode mentah; nama ramahnya ada di pengaturan, tidak perlu di sini).
  const petaJalur = new Map<string, number>();
  for (const p of pendaftar) petaJalur.set(p.jalur || "—", (petaJalur.get(p.jalur || "—") ?? 0) + 1);
  const perJalur = [...petaJalur.entries()]
    .map(([kode, nilai]) => ({ kunci: kode, label: kode.replace(/_/g, " "), nilai, warna: "#2E3F8F" }))
    .sort((a, b) => b.nilai - a.nilai);

  const perStatus = URUT_STATUS
    .map(st => ({ label: LABEL_STATUS[st] ?? st, nilai: pendaftar.filter(p => p.status === st || (st === "DITERIMA" && p.status === "ACCEPTED") || (st === "DITOLAK" && p.status === "REJECTED")).length, warna: WARNA_STATUS[st] }))
    .filter(x => x.nilai > 0);

  const lk = pendaftar.filter(p => (p.gender ?? "").toUpperCase().startsWith("L")).length;
  const pr = pendaftar.filter(p => (p.gender ?? "").toUpperCase().startsWith("P")).length;

  const terbaru = pendaftar.slice(0, 8);
  const tgl = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

  const perluDisiapkan: { teks: string; href: string }[] = [];
  if (!gelombangBuka) perluDisiapkan.push({ teks: "Belum ada gelombang yang sedang dibuka — pendaftaran di situs tertutup.", href: "/pusat-spmb/pengaturan" });
  if (komponen === 0) perluDisiapkan.push({ teks: "Belum ada komponen penilaian aktif — seleksi belum bisa dinilai.", href: "/pusat-spmb/pengaturan" });
  if (syarat === 0) perluDisiapkan.push({ teks: "Belum ada dokumen syarat — pendaftar belum diminta mengunggah apa pun.", href: "/pusat-spmb/pengaturan" });
  if (!s["spmb.poster"]) perluDisiapkan.push({ teks: "Belum ada poster SPMB di halaman situs.", href: "/pusat-spmb/promosi" });

  return (
    <>
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <PageHeader icon={<LayoutDashboard size={22} />} title="Beranda SPMB"
          description={`Tahun ${s["spmb.tahun"] ?? ""} · ${gelombangBuka ? `${gelombangBuka.nama} sedang dibuka` : "pendaftaran sedang tutup"} · hasil seleksi ${hasilDibuka ? "sudah dibuka" : "masih ditutup"}`} />

        <div className="space-y-6">
          <div className="kisi-kartu kisi-kartu-5">
            <StatTile value={total} label="Total pendaftar" ikon="akun" color="primary" href="/pusat-spmb/pendaftar" />
            <StatTile value={menunggu} label="Menunggu diperiksa" ikon="menunggu" color="amber" href="/pusat-spmb/pendaftar" sorot={menunggu > 0} />
            <StatTile value={diterima} label="Diterima" ikon="hadir" color="emerald" href="/pusat-spmb/pengumuman" />
            <StatTile value={lunas} label="Sudah daftar ulang" ikon="lunas" color="blue" href="/pusat-spmb/daftar-ulang" />
            <StatTile value={jadiSiswa} label="Sudah jadi siswa" ikon="siswa" color="purple" href="/pusat-spmb/konversi" />
          </div>

          {perluDisiapkan.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-heading mb-2 text-sm font-semibold text-amber-800">Yang masih perlu disiapkan</p>
              <ul className="space-y-1.5">
                {perluDisiapkan.map(p => (
                  <li key={p.teks} className="text-sm text-amber-700">
                    • {p.teks} <Link href={p.href} className="font-semibold underline">Buka</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {total === 0 ? (
            <Panel judul="Sebaran pendaftar">
              <p className="py-10 text-center text-sm text-gray-400">
                Belum ada pendaftar. Grafik sebaran jurusan, jalur, dan status muncul setelah formulir pertama masuk.
              </p>
            </Panel>
          ) : (
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
              <div className="space-y-6 xl:col-span-7">
                <Panel judul="Pendaftar per konsentrasi keahlian" keterangan={`${total} pendaftar`}>
                  {perJurusan.length ? (
                    <>
                      <BarDaftar data={perJurusan} satuan="pendaftar" />
                      {tanpaJurusan > 0 && (
                        <p className="mt-4 text-sm text-amber-600">
                          {tanpaJurusan} pendaftar jurusannya tidak cocok dengan daftar jurusan sekolah — periksa di menu Pendaftar.
                        </p>
                      )}
                    </>
                  ) : <p className="py-10 text-center text-sm text-gray-400">Belum ada pendaftar berjurusan.</p>}
                </Panel>

                <Panel judul="Pendaftar per jalur">
                  <BarDaftar data={perJalur} satuan="pendaftar" />
                </Panel>
              </div>

              <div className="space-y-6 xl:col-span-5">
                <Panel judul="Komposisi">
                  <div className="grid grid-cols-2 gap-4">
                    <DonatBagian judul="Status seleksi" bagian={perStatus} satuan="orang" />
                    <DonatBagian judul="Laki-laki & perempuan" satuan="orang"
                      bagian={[
                        { label: "Laki-laki", nilai: lk, warna: "#2E3F8F" },
                        { label: "Perempuan", nilai: pr, warna: "#E8A020" },
                      ]} />
                  </div>
                </Panel>

                <Panel judul="Pendaftar terbaru" tautan={{ label: "Lihat semua", href: "/pusat-spmb/pendaftar" }} isi={false}>
                  <ul className="divide-y divide-gray-100">
                    {terbaru.map(p => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-primary-900">{p.fullName}</span>
                          <span className="angka block text-xs text-gray-400">{p.nomor ?? "—"} · {p.chosenMajor || "tanpa jurusan"}</span>
                        </span>
                        <span className="angka shrink-0 text-xs text-gray-400">{tgl(p.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </div>
          )}

          {/* Kuota vs terisi per gelombang — tabel, bukan grafik: panitia membaca ANGKA sisanya. */}
          {semuaGelombang.some(g => g.kuota.length > 0) && (
            <Panel judul="Kuota per jurusan" keterangan="Dihitung dari pendaftar yang belum ditolak">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr>
                    <th className="w-10">No</th><th>Gelombang</th><th>Jurusan</th>
                    <th className="text-right">Kuota</th><th className="text-right">Terisi</th>
                    <th className="text-right">Sisa</th><th>Keterisian</th>
                  </tr></thead>
                  <tbody>
                    {semuaGelombang.flatMap((g, gi) => g.kuota.map((k, ki) => {
                      const terisi = pendaftar.filter(p =>
                        p.gelombang?.nama === g.nama && !["DITOLAK", "REJECTED"].includes(p.status) && cocokJurusan(p.chosenMajor, k.major)).length;
                      const sisa = Math.max(0, k.kuota - terisi);
                      const persen = k.kuota > 0 ? Math.min(100, Math.round((terisi / k.kuota) * 100)) : 0;
                      return (
                        <tr key={`${g.id}-${k.id}`}>
                          <td className="angka">{gi + ki + 1}</td>
                          <td className="text-gray-500">{g.nama}</td>
                          <td className="font-medium text-primary-900">{k.major.name}</td>
                          <td className="angka text-right">{k.kuota}</td>
                          <td className="angka text-right">{terisi}</td>
                          <td className="angka text-right font-semibold text-primary-900">{sisa}</td>
                          <td className="w-40">
                            <span className="block h-1.5 w-full rounded-full bg-gray-100">
                              <span className={`block h-1.5 rounded-full ${persen >= 100 ? "bg-red-500" : persen >= 80 ? "bg-amber-400" : "bg-emerald-500"}`}
                                style={{ width: `${persen}%` }} />
                            </span>
                            <span className="angka mt-1 block text-xs text-gray-400">{persen}%</span>
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* Seluruh menu portal juga tampil di beranda — tidak ada laci menu di HP (DESIGN_SYSTEM §3.6). */}
      <div className="px-6 pb-8 lg:px-8"><KisiMenuPortal items={MENU_PUSAT_SPMB} judul="Menu Pusat SPMB" /></div>
    </>
  );
}
