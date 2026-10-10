export const dynamic = "force-dynamic";
import Link from "next/link";
import { ListTodo } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { susunMejaKerja, KUNCI_KELENGKAPAN } from "@/lib/meja-kerja-tu";

export const metadata = { title: "Meja Kerja TU" };
const tgl = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

/** MEJA KERJA TU — semua pekerjaan Tata Usaha yang sedang menunggu, dengan butir-butirnya, dalam satu layar. */
export default async function Page({ searchParams }: { searchParams: Promise<{ bagian?: string; lihat?: string }> }) {
  const session = await verifyTasAccess();
  const sp = await searchParams, data = sp.bagian === "data", lihat = sp.lihat ?? "";
  const alamat = (k?: string) => `/dashboard/admin/meja-kerja?${data ? "bagian=data&" : ""}${k ? `lihat=${k}` : ""}`.replace(/[?&]$/, "");
  const seluruh = await susunMejaKerja(session);
  const jumlahDi = (d: boolean) => seluruh.filter(b => KUNCI_KELENGKAPAN.has(b.kunci) === d).reduce((a, b) => a + b.jumlah, 0);
  const semua = seluruh.filter(b => KUNCI_KELENGKAPAN.has(b.kunci) === data);
  const ada = semua.filter(b => b.jumlah > 0);
  const TAB = [{ k: false, label: "Pekerjaan harian", href: "/dashboard/admin/meja-kerja" }, { k: true, label: "Kelengkapan data", href: "/dashboard/admin/meja-kerja?bagian=data" }];
  const total = ada.reduce((a, b) => a + b.jumlah, 0), telat = ada.reduce((a, b) => a + b.butir.filter(x => x.telat).length, 0);
  const hariIni = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ListTodo size={22} />} title="Meja Kerja TU" description={`Yang menunggu dikerjakan — ${hariIni}`} />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={total} label={data ? "Data belum lengkap" : "Pekerjaan menunggu"} ikon="daftar-tugas" color="primary" />
          <StatTile value={telat} label="Sudah terlalu lama / lewat batas" ikon="peringatan" color="red" sorot={telat > 0} />
          <StatTile value={semua.length - ada.length} label={data ? "Jenis data yang sudah lengkap" : "Jenis pekerjaan yang sudah beres"} ikon="hadir" color="emerald" />
        </div>
        <div className="baris-alat">
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {TAB.map(x => (
              <Link key={x.label} href={x.href} scroll={false} className={`sentuh flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${x.k === data ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                {x.label} <span className={`angka rounded-full px-1.5 text-xs ${x.k === data ? "bg-white/15" : "bg-gray-100 text-gray-600"}`}>{jumlahDi(x.k).toLocaleString("id-ID")}</span>
              </Link>
            ))}
          </div>
        </div>
        {ada.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">{data ? "Semua data sudah lengkap." : "Tidak ada pekerjaan yang menunggu. Meja bersih."}</p> : (
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
            {[...ada].sort((x, y) => Number(y.butir.some(z => z.telat)) - Number(x.butir.some(z => z.telat))).map(b => (
              <div key={b.kunci} id={b.kunci} className={`panel min-w-0 scroll-mt-28 overflow-hidden ${lihat === b.kunci ? "xl:col-span-2" : ""}`}>
                <div className="panel-kepala">
                  <p className="panel-judul">{b.judul} <span className="angka ml-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">{b.jumlah}</span></p>
                  <Link href={b.href} className="panel-tautan">{b.aksi}</Link>
                </div>
                <ul className="divide-y divide-gray-100">
                  {b.butir.slice(0, lihat === b.kunci ? 400 : 6).map(x => (
                    <li key={x.id}>
                      <Link href={x.href ?? b.href} className="flex items-start gap-3 px-5 py-2.5 text-sm transition hover:bg-gray-50">
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium text-primary-900">{x.judul}</span><span className="block truncate text-xs text-gray-500">{x.ket}</span></span>
                        {x.waktu && <span className={`angka shrink-0 text-xs ${x.telat ? "font-semibold text-red-600" : "text-gray-400"}`}>{tgl(x.waktu)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
                {b.butir.length > 6 && (
                  <p className="border-t border-gray-100 px-5 py-2.5 text-xs text-gray-500">
                    {lihat === b.kunci
                      ? <>{b.butir.length > 400 ? `400 dari ${b.butir.length} ditampilkan — yang selesai dikerjakan hilang dari daftar. ` : ""}<Link href={`${alamat()}#${b.kunci}`} scroll={false} className="font-semibold text-primary-700 hover:underline">Ringkas kembali</Link></>
                      : <>dan {b.butir.length - 6} lainnya — <Link href={`${alamat(b.kunci)}#${b.kunci}`} scroll={false} className="font-semibold text-primary-700 hover:underline">tampilkan semua</Link></>}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500">Ketuk satu butir untuk langsung membuka data itu. Tanggal merah = menunggu terlalu lama atau sudah melewati batas waktu. Pekerjaan harian = persuratan, layanan, mutasi, dan kepegawaian yang menunggu tindakan; Kelengkapan data = tunggakan isian yang dicicil (buku induk, alumni, tracer, ijazah, arsip).</p>
      </div>
    </div>
  );
}
