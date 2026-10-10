"use client";
import { useCariAwal } from "@/lib/cari-awal";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookmarkCheck, BookmarkPlus, BookOpen, FileText, Library, Loader2, MapPin, Search, X, LibraryBig } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";

interface Buku {
  id: string; title: string; author: string | null; publisher: string | null; category: string; location: string | null;
  coverUrl: string | null; fileUrl: string | null; stock: number; tersedia: number;
  sedangDipinjamSaya: string | null; pesananSaya: { id: string; status: string } | null;
}
interface Data { kategori: string[]; maksPesan: number; jumlahPesanan: number; buku: Buku[] }

const WARNA_SAMPUL = ["from-primary-700 to-primary-900", "from-emerald-600 to-emerald-800", "from-amber-500 to-amber-700", "from-purple-600 to-purple-800", "from-blue-600 to-blue-800", "from-rose-500 to-rose-700"];

/** KATALOG ANGGOTA — cari buku, lihat ketersediaan & raknya, pesan untuk diambil di perpustakaan, atau baca e-book. */
export default function KatalogAnggota() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [cari, setCari] = useState("");
  useCariAwal(setCari);
  const [kategori, setKategori] = useState("SEMUA");
  const [hanyaTersedia, setHanyaTersedia] = useState(false);
  const [sibuk, setSibuk] = useState<string | null>(null);

  const muat = useCallback(() => {
    fetch("/api/perpustakaan/katalog").then(r => (r.ok ? r.json() : null)).then(d => d && setData(d)).catch(() => {});
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (data?.buku ?? []).filter(b =>
      (kategori === "SEMUA" || b.category === kategori) &&
      (!hanyaTersedia || b.tersedia > 0) &&
      (!q || `${b.title} ${b.author ?? ""} ${b.publisher ?? ""}`.toLowerCase().includes(q)));
  }, [data, cari, kategori, hanyaTersedia]);
  const hal = usePaginasi(tampil, 24, `${cari}|${kategori}|${hanyaTersedia}`);

  async function pesan(b: Buku) {
    setSibuk(b.id);
    const r = await fetch("/api/perpustakaan/katalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookId: b.id }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(null);
    if (!r?.ok) return toast.error(d?.error ?? "Gagal memesan buku.");
    toast.success(b.tersedia > 0 ? `"${b.title}" dipesan. Ambil di perpustakaan — petugas akan menyiapkannya.` : `"${b.title}" dipesan. Anda diberi tahu begitu bukunya siap.`);
    muat();
  }

  async function batal(b: Buku) {
    if (!b.pesananSaya || !(await confirm(`Batalkan pesanan "${b.title}"?`))) return;
    setSibuk(b.id);
    const r = await fetch("/api/perpustakaan/katalog", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.pesananSaya.id }) }).catch(() => null);
    setSibuk(null);
    if (r?.ok) { toast.success("Pesanan dibatalkan."); muat(); } else toast.error("Gagal membatalkan pesanan.");
  }

  if (!data) return <div className="flex justify-center py-24 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 space-y-5">
      <PageHeader icon={<LibraryBig size={22} />} title="Katalog Buku"
        description={`${data.buku.length} judul · pesanan aktif Anda ${data.jumlahPesanan}/${data.maksPesan}`} />

      <div className="baris-alat">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari judul, penulis, atau penerbit..." className="input-field pl-10" />
          {cari && <button type="button" onClick={() => setCari("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500" title="Hapus pencarian"><X size={15} /></button>}
        </div>
        <div className="alat-saring"><Select value={kategori} onChange={setKategori} options={[{ value: "SEMUA", label: "Semua kategori" }, ...data.kategori.map(k => ({ value: k, label: k }))]} /></div>
        <label className="alat-saring flex items-center gap-2 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 cursor-pointer min-h-[42px]">
          <input type="checkbox" checked={hanyaTersedia} onChange={e => setHanyaTersedia(e.target.checked)} className="w-4 h-4 accent-primary-700" /> Hanya yang tersedia
        </label>
      </div>

      {tampil.length === 0 ? (
        <EmptyState icon={Library} title="Buku tidak ditemukan" description="Coba kata kunci lain atau ubah saringan kategori." />
      ) : (
        <div id="daftar-katalog" className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 scroll-mt-16">
          {hal.potongan.map((b, i) => (
            <article key={b.id} className="panel overflow-hidden flex flex-col">
              <div className="relative h-40">
                {b.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.coverUrl} alt={`Sampul ${b.title}`} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${WARNA_SAMPUL[i % WARNA_SAMPUL.length]} p-4 flex flex-col justify-end`}>
                    <BookOpen size={22} className="text-white/40 mb-2" />
                    <p className="font-heading font-bold text-white leading-snug line-clamp-3">{b.title}</p>
                  </div>
                )}
                <span className={`absolute top-3 right-3 px-2 py-0.5 rounded-full border text-xs font-semibold ${b.tersedia > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                  {b.tersedia > 0 ? `Tersedia ${b.tersedia}/${b.stock}` : "Sedang dipinjam semua"}
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-2">
                <div>
                  <h2 className="font-heading font-semibold text-primary-900 leading-snug line-clamp-2">{b.title}</h2>
                  <p className="text-xs text-gray-500 line-clamp-1">{[b.author, b.publisher].filter(Boolean).join(" · ") || "Penulis tidak dicantumkan"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="badge badge-navy">{b.category}</span>
                  {b.location && <span className="inline-flex items-center gap-1 text-gray-500"><MapPin size={11} /> Rak {b.location}</span>}
                </div>
                {b.sedangDipinjamSaya && (
                  <p className="text-xs rounded-lg bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1">Sedang Anda pinjam · kembalikan {new Date(b.sedangDipinjamSaya).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })}</p>
                )}
                {b.pesananSaya && (
                  <p className={`text-xs rounded-lg border px-2 py-1 ${b.pesananSaya.status === "TERSEDIA" ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                    {b.pesananSaya.status === "TERSEDIA" ? "Pesanan siap diambil di perpustakaan" : "Dipesan · menunggu disiapkan"}
                  </p>
                )}
                <div className="mt-auto pt-2 flex flex-wrap gap-2">
                  {b.fileUrl && (
                    <a href={b.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-modal-cancel text-xs px-3 py-1.5"><FileText size={14} /> Baca e-book</a>
                  )}
                  {b.pesananSaya ? (
                    <button type="button" onClick={() => batal(b)} disabled={sibuk === b.id} className="btn-modal-cancel text-xs px-3 py-1.5">
                      {sibuk === b.id ? <Loader2 size={14} className="animate-spin" /> : <BookmarkCheck size={14} />} Batalkan pesanan
                    </button>
                  ) : !b.sedangDipinjamSaya && (
                    <button type="button" onClick={() => pesan(b)} disabled={sibuk === b.id || data.jumlahPesanan >= data.maksPesan}
                      className="btn-modal-save text-xs px-3 py-1.5" title={data.jumlahPesanan >= data.maksPesan ? `Batas ${data.maksPesan} pesanan aktif` : undefined}>
                      {sibuk === b.id ? <Loader2 size={14} className="animate-spin" /> : <BookmarkPlus size={14} />} Pesan
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <Paginasi hal={hal} satuan="judul" idGulir="daftar-katalog" className="panel" />
    </div>
  );
}
