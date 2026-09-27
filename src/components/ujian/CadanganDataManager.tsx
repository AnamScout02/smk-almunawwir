"use client";
import { useCallback, useEffect, useState } from "react";
import {
  DatabaseBackup, Download, FileJson, FileSpreadsheet, Loader2, Radio, RotateCcw,
  ShieldAlert, Trash2, Users2, BookMarked, FileQuestion, ClipboardList, AlertTriangle,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface UjianRingkas {
  id: string; judul: string; mapel: string; kelas: string; guru: string;
  soal: number; peserta: number; selesai: number; sedangMengerjakan: number;
  mulai: string; tutup: string; terbit: boolean;
  status: "AKAN_DATANG" | "BERLANGSUNG" | "SELESAI";
  sedangDipakai: boolean;
}
interface Berlangsung { id: string; judul: string; kelas: string; mapel: string; sedangMengerjakan: number; tutup: string }
interface Data {
  lingkup: string; ujian: UjianRingkas[]; bankSoal: number; wacana: number; pengerjaan: number;
  berlangsung: Berlangsung[];
}

const fmt = (d: string) => new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const jam = (d: string) => new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const STATUS: Record<UjianRingkas["status"], { label: string; cls: string }> = {
  AKAN_DATANG: { label: "Akan Datang", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  BERLANGSUNG: { label: "Berlangsung", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  SELESAI: { label: "Selesai", cls: "bg-gray-50 text-gray-600 border-gray-200" },
};

/** CADANGAN & HAPUS DATA UJIAN — padanan "Export/Reset Database" pada CBT Bimasoft.
 *
 * Satu layar untuk dua pekerjaan yang selalu berpasangan: menyimpan dulu, baru menghapus.
 * Bagian paling atas SENGAJA menampilkan NAMA UJIAN YANG SEDANG DILAKUKAN beserta jumlah peserta
 * yang masih di layar — supaya tidak ada yang mereset ujian yang siswanya sedang mengerjakan
 * (permintaan user 13 September 2026). Baris ujian yang sedang dipakai juga dikunci; menghapusnya
 * butuh centang penegasan terpisah. */
export default function CadanganDataManager({ basePath, isAdmin }: { basePath: string; isAdmin: boolean }) {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [sudahCadang, setSudahCadang] = useState(false);
  const [hari, setHari] = useState("365");
  const [paksa, setPaksa] = useState(false);
  const [resetBuka, setResetBuka] = useState(false);
  const [penegas, setPenegas] = useState("");

  const muat = useCallback(() => {
    fetch("/api/teacher/exams/hapus-data")
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    muat();
    // Denyut 15 detik: daftar "sedang berlangsung" harus selalu mencerminkan keadaan sekarang,
    // bukan keadaan saat halaman dibuka.
    const t = setInterval(muat, 15_000);
    return () => clearInterval(t);
  }, [muat]);

  function unduh(url: string) {
    setSudahCadang(true);
    window.location.href = url;
  }

  async function kirim(body: Record<string, unknown>, tanya: string) {
    const awalan = sudahCadang ? "" : "Kamu BELUM mengunduh cadangan pada sesi ini. ";
    if (!(await confirmDialog(`${awalan}${tanya} Tindakan ini TIDAK BISA DIBATALKAN.`))) return;
    setSibuk(true);
    try {
      const r = await fetch("/api/teacher/exams/hapus-data", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error ?? "Gagal menghapus data."); return; }
      toast.success(j.pesan ?? "Data dihapus.");
      setResetBuka(false); setPenegas(""); setPaksa(false);
      muat();
    } catch { toast.error("Gagal menghubungi server."); }
    finally { setSibuk(false); }
  }

  const berlangsung = data?.berlangsung ?? [];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<DatabaseBackup size={22} />} title="Cadangan & Hapus Data Ujian"
        description="Simpan seluruh data ujian sebelum dihapus — soal, kunci, jawaban, dan nilai." />

      {!data ? <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div> : (
        <>
          {/* ——— NAMA UJIAN YANG SEDANG DILAKUKAN ——— */}
          {berlangsung.length > 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="live-dot w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <p className="font-heading font-bold text-emerald-800 text-sm">
                  Sedang berlangsung sekarang — {berlangsung.length} ujian
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {berlangsung.map(b => (
                  <div key={b.id} className="rounded-xl bg-white border border-emerald-200 px-3.5 py-2.5">
                    <p className="font-heading font-bold text-gray-800 text-sm leading-snug">{b.judul}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{b.kelas} · {b.mapel} · tutup {jam(b.tutup)}</p>
                    <p className="text-xs font-semibold text-emerald-700 mt-1 flex items-center gap-1.5">
                      <Radio size={12} /> {b.sedangMengerjakan} peserta sedang mengerjakan
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-emerald-700/80 mt-3 leading-relaxed">
                Jangan menghapus atau mereset ujian di atas selama jam ujian masih jalan — jawaban peserta
                yang sedang berjalan ikut hilang seketika.
              </p>
            </div>
          ) : (
            <div className="panel border-gray-200 px-4 py-3 mb-5 flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0" />
              <p className="text-sm text-gray-400">Tidak ada ujian yang sedang dilakukan saat ini — aman untuk mencadangkan atau membersihkan data.</p>
            </div>
          )}

          <div className="kisi-kartu kisi-kartu-4 mb-5">
            <StatTile value={data.ujian.length} label="Ujian Tersimpan" icon={FileQuestion} color="primary" />
            <StatTile value={data.pengerjaan} label="Pengerjaan Siswa" icon={Users2} color="emerald" />
            <StatTile value={data.bankSoal} label="Butir Bank Soal" icon={BookMarked} color="amber" />
            <StatTile value={data.wacana} label="Wacana / Stimulus" icon={ClipboardList} color="blue" />
          </div>

          {/* ——— CADANGAN ——— */}
          <div className="page-card mb-5">
            <div className="page-card-header">
              <div className="flex items-center gap-2">
                <Download size={16} className="text-primary-700" />
                <h2 className="font-heading font-bold text-gray-800 text-sm">Cadangan Data</h2>
              </div>
            </div>
            <div className="p-5 grid gap-3 md:grid-cols-2">
              <button onClick={() => unduh("/api/teacher/exams/cadangan?format=json")}
                className="text-left rounded-xl border border-primary-100 bg-primary-50/60 hover:bg-primary-50 p-4 transition">
                <div className="flex items-center gap-2 mb-1.5">
                  <FileJson size={18} className="text-primary-700" />
                  <span className="font-heading font-bold text-primary-900 text-sm">Cadangan Lengkap (.json)</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Seluruh isi apa adanya: bank soal, wacana, pengaturan ujian, soal + kunci, dan semua
                  jawaban siswa. Inilah yang disimpan sebelum menghapus atau saat ganti tahun ajaran.
                </p>
              </button>
              <button onClick={() => unduh("/api/teacher/exams/cadangan?format=xlsx")}
                className="text-left rounded-xl border border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50 p-4 transition">
                <div className="flex items-center gap-2 mb-1.5">
                  <FileSpreadsheet size={18} className="text-emerald-700" />
                  <span className="font-heading font-bold text-emerald-800 text-sm">Arsip Terbaca (.xlsx)</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Empat lembar siap dibaca/di-print: Daftar Ujian, Soal &amp; Kunci, Nilai Siswa, Bank Soal.
                  Untuk arsip TU — tidak bisa dimasukkan kembali ke sistem.
                </p>
              </button>
            </div>
          </div>

          {/* ——— DAFTAR UJIAN & HAPUS PER UJIAN ——— */}
          <div className="page-card mb-5">
            <div className="page-card-header">
              <div className="flex items-center gap-2">
                <Trash2 size={16} className="text-red-600" />
                <h2 className="font-heading font-bold text-gray-800 text-sm">Hapus Per Ujian</h2>
              </div>
              <span className="text-xs text-gray-400">{data.ujian.length} ujian</span>
            </div>
            {data.ujian.length === 0 ? (
              <EmptyState icon={FileQuestion} title="Belum ada ujian" description="Belum ada data ujian yang bisa dicadangkan atau dihapus." />
            ) : (
              <div className="overflow-x-auto scrollbar-visible">
                <table className="data-table">
                  <thead><tr>
                    <th>Ujian</th><th>Kelas / Mapel</th><th>Jadwal</th><th className="text-center">Soal</th>
                    <th className="text-center">Peserta</th><th className="text-center">Status</th><th className="text-right">Tindakan</th>
                  </tr></thead>
                  <tbody>
                    {data.ujian.map(u => (
                      <tr key={u.id}>
                        <td>
                          <p className="font-semibold text-gray-800">{u.judul}</p>
                          <p className="text-xs text-gray-400">{u.guru}</p>
                        </td>
                        <td className="text-gray-600">{u.kelas}<span className="text-gray-300"> · </span>{u.mapel}</td>
                        <td className="text-xs text-gray-500">{fmt(u.mulai)}<br />s.d. {fmt(u.tutup)}</td>
                        <td className="text-center">{u.soal}</td>
                        <td className="text-center">
                          {u.selesai}/{u.peserta}
                          {u.sedangMengerjakan > 0 && (
                            <span className="block text-xs font-semibold text-emerald-600">{u.sedangMengerjakan} aktif</span>
                          )}
                        </td>
                        <td className="text-center">
                          <span className={`status-badge ${STATUS[u.status].cls}`}>{STATUS[u.status].label}</span>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <a href={`/api/teacher/exams/cadangan?format=json&examId=${u.id}`} title="Cadangkan ujian ini (.json)"
                              onClick={() => setSudahCadang(true)}
                              className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Download size={14} /></a>
                            <button onClick={() => kirim({ aksi: "hasil-ujian", examId: u.id, paksa: u.sedangDipakai && paksa },
                              `Hapus SEMUA pengerjaan & nilai siswa pada ujian "${u.judul}"? Soal dan pengaturannya tetap ada, jadi ujian bisa diulang dari nol.`)}
                              disabled={sibuk || (u.sedangDipakai && !paksa)} title="Hapus hasil (ujian bisa diulang)"
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><RotateCcw size={14} /></button>
                            <button onClick={() => kirim({ aksi: "ujian", examId: u.id, paksa: u.sedangDipakai && paksa },
                              `Hapus ujian "${u.judul}" beserta ${u.soal} soal dan ${u.peserta} pengerjaan?`)}
                              disabled={sibuk || (u.sedangDipakai && !paksa)} title="Hapus ujian & seluruh isinya"
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.ujian.some(u => u.sedangDipakai) && (
              <div className="px-5 py-3 border-t border-gray-100 bg-amber-50/60">
                <label className="flex items-start gap-2.5 text-xs text-amber-800 cursor-pointer">
                  <input type="checkbox" checked={paksa} onChange={e => setPaksa(e.target.checked)} className="mt-0.5 accent-amber-600" />
                  <span>
                    Buka kunci ujian yang <strong>sedang berlangsung</strong>. Tanpa ini, ujian yang peserta-
                    nya masih mengerjakan tidak bisa dihapus atau direset.
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* ——— PEMBERSIHAN MASSAL ——— */}
          <div className="page-card">
            <div className="page-card-header">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-red-600" />
                <h2 className="font-heading font-bold text-gray-800 text-sm">Pembersihan Massal</h2>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="font-heading font-bold text-gray-800 text-sm mb-1">Hapus Ujian Lama</p>
                <p className="text-xs text-gray-500 mb-3">Membuang ujian yang jam tutupnya sudah lewat lebih dari sekian hari, beserta soal &amp; nilainya.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input value={hari} onChange={e => setHari(e.target.value.replace(/\D/g, ""))} inputMode="numeric"
                    className="input-field w-24 text-center" />
                  <span className="text-sm text-gray-500">hari ke belakang</span>
                  <button onClick={() => kirim({ aksi: "ujian-lama", hari: Number(hari) || 365 },
                    `Hapus semua ujian yang sudah selesai lebih dari ${hari} hari lalu?`)}
                    disabled={sibuk}
                    className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50">
                    <Trash2 size={15} /> Hapus Ujian Lama
                  </button>
                </div>
              </div>

              {isAdmin && (
                <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={15} className="text-red-600" />
                    <p className="font-heading font-bold text-red-800 text-sm">Hapus Seluruh Data Ujian</p>
                  </div>
                  <p className="text-xs text-red-700/90 mb-3 leading-relaxed">
                    Mengosongkan seluruh modul ujian se-sekolah: semua ujian, soal, jawaban, nilai, bank soal,
                    dan wacana milik semua guru. Dipakai saat mulai tahun ajaran baru — <strong>unduh cadangan
                    lengkap dulu</strong>, setelah ini tidak ada jalan kembali.
                  </p>
                  <button onClick={() => setResetBuka(true)} disabled={sibuk}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50">
                    <ShieldAlert size={15} /> Hapus Semua Data Ujian
                  </button>
                </div>
              )}
            </div>
          </div>

          <Modal open={resetBuka} onClose={() => setResetBuka(false)} title="Hapus Seluruh Data Ujian"
            description="Langkah terakhir — penegasan wajib diketik"
            footer={
              <>
                <button type="button" onClick={() => setResetBuka(false)} className="btn-modal-cancel flex-1">Batal</button>
                <button type="button" disabled={sibuk || penegas.trim().toUpperCase() !== "HAPUS SEMUA DATA UJIAN"}
                  onClick={() => kirim({ aksi: "semua", penegas, paksa }, "Hapus SELURUH data ujian se-sekolah?")}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors flex-1 disabled:opacity-40 disabled:cursor-not-allowed">
                  {sibuk ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Hapus Semuanya
                </button>
              </>
            }>
            <div className="space-y-3">
              {berlangsung.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">Masih ada ujian berlangsung:</p>
                  <ul className="text-xs text-amber-700 list-disc pl-4 space-y-0.5">
                    {berlangsung.map(b => <li key={b.id}>{b.judul} — {b.kelas} ({b.sedangMengerjakan} peserta aktif)</li>)}
                  </ul>
                  <label className="flex items-start gap-2 text-xs text-amber-800 mt-2 cursor-pointer">
                    <input type="checkbox" checked={paksa} onChange={e => setPaksa(e.target.checked)} className="mt-0.5 accent-amber-600" />
                    <span>Saya tetap ingin menghapus walaupun ujian di atas sedang berjalan.</span>
                  </label>
                </div>
              )}
              {!sudahCadang && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  Kamu belum mengunduh cadangan pada sesi ini. Tutup dialog ini, unduh <strong>Cadangan Lengkap (.json)</strong> dulu.
                </div>
              )}
              <p className="text-sm text-gray-600">
                Akan dihapus: <strong>{data.ujian.length} ujian</strong>, <strong>{data.pengerjaan} pengerjaan</strong>,{" "}
                <strong>{data.bankSoal} butir bank soal</strong>, <strong>{data.wacana} wacana</strong>.
              </p>
              <div>
                <label className="label-field">Ketik <span className="font-mono text-red-600">HAPUS SEMUA DATA UJIAN</span></label>
                <input value={penegas} onChange={e => setPenegas(e.target.value)} className="input-field" placeholder="HAPUS SEMUA DATA UJIAN" />
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
