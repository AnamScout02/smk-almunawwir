"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck, Loader2, AlertOctagon, AlertTriangle, Lightbulb, ChevronDown,
  RefreshCw, CheckCircle2, ExternalLink, Download, Users2, ArrowLeftRight,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";

type Kategori = "kritis" | "penting" | "saran";
interface PerbaikanPenugasan {
  classId: string; subject: string;
  guruJadwalId: string; guruJadwalNama: string;
  guruPenugasanId: string | null; guruPenugasanNama: string | null;
}
interface Contoh {
  id: string | null; kiri: string; kanan: string; waktu: string; detail: string;
  perbaikanPenugasan?: PerbaikanPenugasan;
}
interface Temuan {
  id: string; kategori: Kategori; judul: string; penjelasan: string; saran: string;
  jumlah: number; contoh: Contoh[]; mapelGabungan?: { nama: string; jumlah: number }[];
}
interface Hasil {
  temuan: Temuan[]; ringkasan: Record<Kategori, number>; totalJadwal: number; diperiksaPada: string;
}

const GAYA: Record<Kategori, { label: string; badge: string; bar: string; icon: typeof AlertOctagon }> = {
  kritis:  { label: "Kritis",  badge: "bg-red-50 text-red-600 border-red-200",       bar: "bg-red-500",   icon: AlertOctagon },
  penting: { label: "Penting", badge: "bg-amber-50 text-amber-700 border-amber-200", bar: "bg-amber-500", icon: AlertTriangle },
  saran:   { label: "Saran",   badge: "bg-blue-50 text-blue-700 border-blue-200",    bar: "bg-blue-500",  icon: Lightbulb },
};

export default function PemeriksaJadwalManager() {
  const toast = useToast();
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [buka, setBuka] = useState<Set<string>>(new Set());
  const [menandai, setMenandai] = useState<string | null>(null);
  const [menyamakan, setMenyamakan] = useState<string | null>(null);

  const muat = () => {
    setLoading(true);
    fetch("/api/admin/pemeriksa-jadwal")
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

  async function tandaiGabungan(nama: string) {
    setMenandai(nama);
    const res = await fetch("/api/admin/pemeriksa-jadwal/kelas-gabungan", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: nama, maksimal: 2 }),
    }).catch(() => null);
    setMenandai(null);
    if (!res?.ok) return toast.error((await res?.json().catch(() => null))?.error ?? "Gagal menandai mata pelajaran.");
    toast.success(`"${nama}" kini boleh diajarkan ke 2 rombel sekaligus.`);
    muat();
  }

  async function samakan(p: PerbaikanPenugasan, aksi: "ikut-jadwal" | "ikut-penugasan") {
    const kunci = `${p.classId}|${p.subject}|${aksi}`;
    setMenyamakan(kunci);
    const res = await fetch("/api/admin/pemeriksa-jadwal/penugasan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi, ...p }),
    }).catch(() => null);
    setMenyamakan(null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) return toast.error(data?.error ?? "Gagal menyamakan jadwal & penugasan.");
    toast.success(data?.pesan ?? "Tersimpan.");
    muat();
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CalendarCheck size={22} />} title="Pemeriksa Jadwal"
        description="Memisahkan bentrok yang benar-benar mustahil dijalankan dari kelas gabungan yang memang disengaja" />

      <div className="alat-aksi justify-end mb-5">
        <a href="/api/admin/pemeriksa-jadwal/ekspor"
          className={`btn-modal-cancel flex items-center gap-2 text-sm ${!hasil || hasil.temuan.length === 0 ? "pointer-events-none opacity-40" : ""}`}>
          <Download size={16} /> Unduh Excel
        </a>
        <button onClick={muat} disabled={loading} className="btn-modal-save btn-teks">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Periksa Ulang
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <Loader2 size={28} className="animate-spin text-primary-500" />
          <p className="text-sm">Memeriksa seluruh jadwal pelajaran...</p>
        </div>
      ) : !hasil ? (
        <EmptyState icon={AlertTriangle} title="Gagal Memeriksa" description="Coba klik Periksa Ulang." />
      ) : (
        <>
          <div className="kisi-kartu kisi-kartu-4 mb-5">
            <StatTile value={hasil.totalJadwal} label="Baris Jadwal Diperiksa" icon={CalendarCheck} color="primary" />
            <StatTile value={hasil.ringkasan.kritis} label="Mustahil Dijalankan" icon={AlertOctagon} color="red" />
            <StatTile value={hasil.ringkasan.penting} label="Perlu Dicek" icon={AlertTriangle} color="amber" />
            <StatTile value={hasil.ringkasan.saran} label="Sengaja / Catatan" icon={Lightbulb} color="blue" />
          </div>

          {hasil.temuan.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Jadwal Bersih"
              description="Tidak ada bentrok maupun kejanggalan pada seluruh jadwal pelajaran." />
          ) : (
            <>
              <div className="page-card p-4 mb-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select value={filter} onChange={setFilter} placeholder="Semua Kategori"
                    options={[
                      { value: "", label: `Semua Kategori (${hasil.temuan.length} jenis temuan)` },
                      { value: "kritis", label: "Kritis — mustahil dijalankan" },
                      { value: "penting", label: "Penting — perlu dicek" },
                      { value: "saran", label: "Saran / memang disengaja" },
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
                    <div key={t.id} className="page-card overflow-hidden">
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

                          {t.mapelGabungan?.length ? (
                            <div className="px-4 py-4 border-b border-gray-100 bg-amber-50/50">
                              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                <Users2 size={14} /> Tandai sebagai kelas gabungan
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {t.mapelGabungan.map(m => (
                                  <button key={m.nama} onClick={() => tandaiGabungan(m.nama)} disabled={menandai !== null}
                                    title={`Izinkan ${m.nama} diajarkan ke 2 rombel sekaligus`}
                                    className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl border border-amber-200 bg-white text-amber-900 hover:bg-amber-100 transition disabled:opacity-40">
                                    {menandai === m.nama ? <Loader2 size={13} className="animate-spin" /> : <Users2 size={13} />}
                                    {m.nama}
                                    <span className="text-xs text-amber-600">{m.jumlah}×</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="overflow-x-auto scrollbar-visible">
                            <table className="data-table">
                              <thead>
                                <tr><th>Pihak 1</th><th>Pihak 2</th><th>Waktu</th><th>Rincian</th><th className="text-center">Aksi</th></tr>
                              </thead>
                              <tbody>
                                {t.contoh.map((c, i) => (
                                  <tr key={`${t.id}-${i}`}>
                                    <td className="font-medium whitespace-nowrap">{c.kiri}</td>
                                    <td className="whitespace-nowrap">{c.kanan || "—"}</td>
                                    <td className="text-gray-500 whitespace-nowrap">{c.waktu}</td>
                                    <td className="text-gray-500">{c.detail}</td>
                                    <td className="text-center whitespace-nowrap">
                                      {c.perbaikanPenugasan ? (
                                        <span className="inline-flex items-center gap-1">
                                          <button onClick={() => samakan(c.perbaikanPenugasan!, "ikut-jadwal")}
                                            disabled={menyamakan !== null}
                                            title={`Jadwal yang benar — pindahkan penugasan ${c.perbaikanPenugasan.subject} ke ${c.perbaikanPenugasan.guruJadwalNama}`}
                                            className="px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition disabled:opacity-40">
                                            {menyamakan === `${c.perbaikanPenugasan.classId}|${c.perbaikanPenugasan.subject}|ikut-jadwal`
                                              ? <Loader2 size={11} className="animate-spin" /> : "Jadwal yang benar"}
                                          </button>
                                          <ArrowLeftRight size={11} className="text-gray-300" />
                                          <button onClick={() => samakan(c.perbaikanPenugasan!, "ikut-penugasan")}
                                            disabled={menyamakan !== null || !c.perbaikanPenugasan.guruPenugasanId}
                                            title={c.perbaikanPenugasan.guruPenugasanNama
                                              ? `Penugasan yang benar — ganti guru pada jadwal jadi ${c.perbaikanPenugasan.guruPenugasanNama}`
                                              : "Belum ada pemegang penugasan untuk mapel ini"}
                                            className="px-2 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition disabled:opacity-40">
                                            {menyamakan === `${c.perbaikanPenugasan.classId}|${c.perbaikanPenugasan.subject}|ikut-penugasan`
                                              ? <Loader2 size={11} className="animate-spin" /> : "Penugasan yang benar"}
                                          </button>
                                        </span>
                                      ) : c.id ? (
                                        <Link href={`/dashboard/admin/schedules?classId=${c.id}`} title="Buka Jadwal Pelajaran kelas ini"
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
    </div>
  );
}
