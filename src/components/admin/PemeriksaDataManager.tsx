"use client";
import { tautanTemuan } from "@/lib/induk-pokok";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ScanSearch, Loader2, AlertOctagon, AlertTriangle, Lightbulb, ChevronDown,
  RefreshCw, CheckCircle2, ExternalLink, Download,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";

type Kategori = "kritis" | "penting" | "saran";
interface Contoh { id: string | null; nis: string; nama: string; detail: string }
interface Temuan {
  id: string; kategori: Kategori; judul: string; penjelasan: string; saran: string;
  jumlah: number; contoh: Contoh[];
}
interface Hasil {
  temuan: Temuan[]; ringkasan: Record<Kategori, number>; totalSiswa: number; diperiksaPada: string;
}

const GAYA: Record<Kategori, { label: string; badge: string; bar: string; icon: typeof AlertOctagon }> = {
  kritis:  { label: "Kritis",  badge: "bg-red-50 text-red-600 border-red-200",           bar: "bg-red-500",     icon: AlertOctagon },
  penting: { label: "Penting", badge: "bg-amber-50 text-amber-700 border-amber-200",     bar: "bg-amber-500",   icon: AlertTriangle },
  saran:   { label: "Saran",   badge: "bg-blue-50 text-blue-700 border-blue-200",        bar: "bg-blue-500",    icon: Lightbulb },
};

export default function PemeriksaDataManager() {
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [buka, setBuka] = useState<Set<string>>(new Set());
  // Tautan langsung dari Meja Kerja TU: #temuan-<kode> membuka temuan itu dan menggulir ke sana.
  useEffect(() => {
    const kode = window.location.hash.replace(/^#temuan-/, "");
    if (!kode || kode === window.location.hash) return;
    setBuka(new Set([kode]));
    const w = setTimeout(() => document.getElementById(`temuan-${kode}`)?.scrollIntoView({ block: "start", behavior: "smooth" }), 900);
    return () => clearTimeout(w);
  }, []);

  const muat = () => {
    setLoading(true);
    fetch("/api/admin/pemeriksa-data")
      .then(r => r.json())
      .then(d => setHasil(d && Array.isArray(d.temuan) ? d : null))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(muat, []);

  const tampil = useMemo(
    () => (hasil?.temuan ?? []).filter(t => !filter || t.kategori === filter),
    [hasil, filter],
  );

  const toggle = (id: string) =>
    setBuka(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ScanSearch size={22} />} title="Pemeriksa Data"
        description="Menemukan data siswa yang janggal, kosong, atau saling bertentangan — sebelum ketahuan saat dokumen sudah dicetak" />
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <p className="text-sm">Memeriksa seluruh data siswa...</p>
        </div>
      ) : !hasil ? (
        <EmptyState icon={AlertTriangle} title="Gagal Memeriksa" description="Coba klik Periksa Ulang." />
      ) : (
        <>
          <div className="kisi-kartu kisi-kartu-4 mb-5">
            <StatTile value={hasil.totalSiswa} label="Siswa Diperiksa" icon={ScanSearch} color="primary" />
            <StatTile value={hasil.ringkasan.kritis} label="Perlu Segera Dibenahi" icon={AlertOctagon} color="red" />
            <StatTile value={hasil.ringkasan.penting} label="Perlu Dicek" icon={AlertTriangle} color="amber" />
            <StatTile value={hasil.ringkasan.saran} label="Saran Perbaikan" icon={Lightbulb} color="blue" />
          </div>

          {hasil.temuan.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Semua Data Bersih"
              description="Tidak ada kejanggalan yang terdeteksi pada seluruh data siswa." />
          ) : (
            <>
              <div className="page-card p-4 mb-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select value={filter} onChange={setFilter} placeholder="Semua Kategori"
                    options={[
                      { value: "", label: `Semua Kategori (${hasil.temuan.length} jenis temuan)` },
                      { value: "kritis", label: "Kritis — harus dibenahi" },
                      { value: "penting", label: "Penting — perlu dicek" },
                      { value: "saran", label: "Saran — bisa menyusul" },
                    ]} />
                  <p className="text-xs text-gray-400 self-center">
                    Diperiksa {new Date(hasil.diperiksaPada).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {tampil.map(t => {
                  const g = GAYA[t.kategori];
                  const Icon = g.icon;
                  const terbuka = buka.has(t.id);
                  return (
                    <div key={t.id} id={`temuan-${t.id}`} className="page-card overflow-hidden scroll-mt-24">
                      <button onClick={() => toggle(t.id)}
                        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition">
                        <span className={`w-1 self-stretch rounded-full ${g.bar} shrink-0`} />
                        <Icon size={18} className={`mt-0.5 shrink-0 ${t.kategori === "kritis" ? "text-red-500" : t.kategori === "penting" ? "text-amber-500" : "text-blue-500"}`} />
                        <span className="flex-1 min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-heading font-semibold text-primary-900">{t.judul}</span>
                            <span className={`badge border ${g.badge}`}>{g.label}</span>
                            <span className="text-xs text-gray-400">{t.jumlah} data</span>
                          </span>
                          <span className="block text-sm text-gray-500 mt-1">{t.penjelasan}</span>
                        </span>
                        <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${terbuka ? "rotate-180" : ""}`} />
                      </button>

                      {terbuka && (
                        <div className="border-t border-gray-100">
                          <p className="px-4 py-3 text-sm bg-primary-50 text-primary-900">
                            <span className="font-semibold">Yang perlu dilakukan: </span>{t.saran}
                          </p>
                          <div className="overflow-x-auto scrollbar-visible">
                            <table className="data-table">
                              <thead>
                                <tr><th>Nomor Induk</th><th>Nama</th><th>Rincian</th><th className="text-center">Buka</th></tr>
                              </thead>
                              <tbody>
                                {t.contoh.map((c, i) => (
                                  <tr key={`${t.id}-${c.id ?? i}`}>
                                    <td className="whitespace-nowrap">{c.nis}</td>
                                    <td className="font-medium">{c.nama}</td>
                                    <td className="text-gray-500">{c.detail}</td>
                                    <td className="text-center">
                                      {c.id ? (
                                        <Link href={tautanTemuan(t.id, c.id)} title="Betulkan di Buku Induk — langsung ke isiannya"
                                          className="inline-flex p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                                          <ExternalLink size={14} />
                                        </Link>
                                      ) : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {t.jumlah > t.contoh.length && (
                            <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
                              Menampilkan {t.contoh.length} contoh pertama dari {t.jumlah} data. Unduh Excel untuk daftar lengkapnya.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      <div className="alat-aksi justify-end mb-5">
        {/* Unduhan lewat endpoint, bukan dirakit di browser: berkas Excel butuh pustaka xlsx yang
            terlalu berat untuk dibawa ke sisi klien, dan daftar di server tidak dipotong 50. */}
        <a href="/api/admin/pemeriksa-data/ekspor"
          className={`btn-modal-cancel ${!hasil || hasil.temuan.length === 0 ? "pointer-events-none opacity-40" : ""}`}>
          <Download size={16} /> Unduh Excel
        </a>
        <button onClick={muat} disabled={loading} className="btn-modal-save btn-teks">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Periksa Ulang
        </button>
      </div>
    </div>
  );
}
