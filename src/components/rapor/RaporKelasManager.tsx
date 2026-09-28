"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Clock, FileCheck2, Loader2, Lock, LockOpen, MessageSquareText, NotebookPen, Printer, Save, Sheet, Wand2 } from "lucide-react";
import Modal from "@/components/admin/Modal";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import StatusForm from "@/components/rapor/StatusForm";

interface Mapel { mapel: string; guru: string; dinilai: number; form: { status: string; katrol: boolean; dikirimAt: string | null } | null }
interface StatusSemester {
  semester: string;
  dikunci: { oleh: string; pada: string } | null;
  disahkan: { oleh: string; pada: string } | null;
  mapel: Mapel[];
}
interface Kelas { id: string; nama: string; jumlahSiswa: number; semester: StatusSemester[] }
interface BarisCatatan {
  studentId: string; nis: string; nama: string; persenHadir: number | null; alpha: number; rata: number | null;
  belumTuntas: number; poinBersih: number; level: string; catatan: string; saran: string;
}

const tgl = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

/** NILAI & RAPOR KELAS — wali kelas memantau kelengkapan nilai tiap mapel, lalu MENGUNCI nilai kelasnya per semester supaya
 * Kepala Sekolah bisa mengesahkan (verifikasi bertingkat, permintaan user 17 Sep 2026). Selama terkunci, guru mapel tidak bisa
 * mengubah nilai jurnal semester itu. Dipakai portal guru (kelas walinya) & portal admin (semua kelas, CLAUDE.md #55). */
const RUTE = {
  guru: { isian: "/dashboard/teacher/rapor-kelas/isian", cetak: "/dashboard/teacher/rapor-kelas/cetak", form: "/dashboard/teacher/form-nilai-rapor", leger: "/dashboard/teacher/rapor-kelas/leger" },
  admin: { isian: "/dashboard/admin/rapor-kelas/isian", cetak: "/dashboard/admin/rapor-cetak", form: "/dashboard/admin/form-nilai-rapor", leger: "/dashboard/admin/rapor-kelas/leger" },
};

export default function RaporKelasManager({ portal = "guru" }: { portal?: "guru" | "admin" }) {
  const rute = RUTE[portal];
  // Buka-tutup per kelas (22 Sep 2026): satu kelas terbuka; wali dengan satu kelas langsung terbuka.
  const [kelasBuka, setKelasBuka] = useState<string | null>(null);
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [data, setData] = useState<{ kelas: Kelas[]; semesters: string[] } | null>(null);
  const [semester, setSemester] = useState("");
  const [sibuk, setSibuk] = useState("");
  // Catatan wali kelas untuk rapor (17 Sep 2026).
  const [catatanKelas, setCatatanKelas] = useState<Kelas | null>(null);
  const [baris, setBaris] = useState<BarisCatatan[] | null>(null);
  const [terkunciSah, setTerkunciSah] = useState(false);
  const [simpanCatatan, setSimpanCatatan] = useState(false);

  function bukaCatatan(k: Kelas) {
    setCatatanKelas(k);
    setBaris(null);
    fetch(`/api/teacher/catatan-wali?classId=${k.id}&semester=${encodeURIComponent(semester)}`, { cache: "no-store" })
      .then(r => r.json()).then(d => { setBaris(Array.isArray(d.siswa) ? d.siswa : []); setTerkunciSah(!!d.disahkan); })
      .catch(() => setBaris([]));
  }

  async function simpanSemuaCatatan() {
    if (!catatanKelas || !baris) return;
    setSimpanCatatan(true);
    const r = await fetch("/api/teacher/catatan-wali", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: catatanKelas.id, semester, catatan: baris.map(b => ({ studentId: b.studentId, teks: b.catatan })) }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSimpanCatatan(false);
    if (!r?.ok) { toast.error(d?.error ?? "Catatan gagal disimpan."); return; }
    toast.success("Catatan wali kelas tersimpan.");
    setCatatanKelas(null);
  }

  const muat = useCallback(() => {
    fetch("/api/teacher/rapor-kunci", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        setData(d);
        setSemester(s => s || d.semesters?.[2] || d.semesters?.[0] || "");
      })
      .catch(() => setData({ kelas: [], semesters: [] }));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function ubahKunci(k: Kelas, kunci: boolean) {
    const s = k.semester.find(x => x.semester === semester);
    const kurang = s ? s.mapel.filter(m => m.form?.status !== "DIKIRIM").length : 0;
    const pesan = kunci
      ? `Kunci nilai ${k.nama} semester ${semester}?${kurang ? ` Masih ada ${kurang} mapel yang Form Nilai Rapornya belum dikirim.` : ""} Setelah dikunci, guru mapel tidak bisa mengubah nilai & form semester ini.`
      : `Buka kunci nilai ${k.nama} semester ${semester}? Guru mapel bisa mengubah nilai lagi.`;
    if (!(await confirmDialog(pesan))) return;
    setSibuk(k.id);
    const r = await fetch("/api/teacher/rapor-kunci", {
      method: kunci ? "POST" : "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: k.id, semester }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk("");
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return; }
    toast.success(kunci ? "Nilai dikunci — menunggu pengesahan Kepala Sekolah." : "Kunci nilai dibuka.");
    muat();
  }

  if (!data) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FileCheck2 size={22} />} title="Nilai & Rapor Kelas"
        description="Pantau kelengkapan nilai tiap mapel, kunci nilai kelas, lalu tunggu pengesahan Kepala Sekolah" />

      {data.kelas.length === 0 ? (
        <EmptyState icon={FileCheck2} title={portal === "admin" ? "Belum ada kelas" : "Bukan wali kelas"}
          description={portal === "admin" ? "Belum ada kelas yang terdaftar." : "Halaman ini untuk wali kelas. Anda belum tercatat sebagai wali kelas mana pun."} />
      ) : (
        <>
          <div className="baris-alat mb-5">
            <div className="alat-saring">
              <Select value={semester} onChange={setSemester} options={data.semesters.map(s => ({ value: s, label: s }))} />
            </div>
          </div>
          <div className="space-y-5">
            {data.kelas.map(k => {
              const s = k.semester.find(x => x.semester === semester);
              if (!s) return null;
              const lengkap = s.mapel.filter(m => m.form?.status === "DIKIRIM").length;
              const q = new URLSearchParams({ classId: k.id, semester }).toString();
              const terbuka = data.kelas.length === 1 || kelasBuka === k.id;
              const tahap = s.disahkan ? 3 : s.dikunci ? 2 : 1;
              return (
                <div key={k.id} className="panel overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-4">
                    <button type="button" aria-expanded={terbuka} disabled={data.kelas.length === 1}
                      onClick={() => setKelasBuka(b => (b === k.id ? null : k.id))}
                      className="min-w-0 flex items-center gap-2 text-left disabled:cursor-default">
                      {data.kelas.length > 1 && <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${terbuka ? "rotate-180" : ""}`} />}
                      <span className="min-w-0">
                        <span className="block font-heading font-bold text-primary-900">{k.nama}</span>
                        <span className="block text-xs text-gray-500">{k.jumlahSiswa} siswa aktif · {lengkap}/{s.mapel.length} form nilai rapor terkirim</span>
                      </span>
                    </button>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      <Link href={`${rute.leger}?${q}`} className="btn-modal-cancel"><Sheet size={15} /> Leger Nilai</Link>
                      <Link href={`${rute.isian}?${q}`} className="btn-modal-cancel"><NotebookPen size={15} /> Isian Rapor</Link>
                      <button type="button" onClick={() => bukaCatatan(k)} className="btn-modal-cancel">
                        <MessageSquareText size={15} /> Catatan Wali Kelas
                      </button>
                      <Link href={`${rute.cetak}?${q}${portal === "admin" ? "&dari=rapor-kelas" : ""}`} className="btn-modal-cancel"><Printer size={15} /> Cetak Rapor</Link>
                      {s.disahkan ? (
                        <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 size={13} /> Disahkan {tgl(s.disahkan.pada)}</span>
                      ) : s.dikunci ? (
                        <span className="status-badge bg-blue-50 text-blue-700 border-blue-200"><Lock size={13} /> Dikunci — menunggu pengesahan</span>
                      ) : (
                        <span className="status-badge bg-amber-50 text-amber-700 border-amber-200"><Clock size={13} /> Nilai masih terbuka</span>
                      )}
                      {!s.disahkan && (s.dikunci ? (
                        <button type="button" onClick={() => ubahKunci(k, false)} disabled={sibuk === k.id} className="btn-modal-cancel">
                          {sibuk === k.id ? <Loader2 size={15} className="animate-spin" /> : <LockOpen size={15} />} Buka Kunci
                        </button>
                      ) : (
                        <button type="button" onClick={() => ubahKunci(k, true)} disabled={sibuk === k.id} className="btn-modal-save">
                          {sibuk === k.id ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />} Kunci Nilai
                        </button>
                      ))}
                    </div>
                  </div>
                  {terbuka && (<>
                  <ol className="flex flex-wrap gap-x-6 gap-y-1 border-b border-gray-100 bg-[#f5f6fa] px-5 py-2.5 text-xs">
                    {["Guru mapel mengirim Form Nilai Rapor", "Wali kelas mengisi sikap & catatan, lalu mengunci", "Kepala Sekolah mengesahkan → rapor tampil & bertanda tangan"].map((t, i) => (
                      <li key={t} className={`flex items-center gap-1.5 ${tahap > i + 1 ? "text-emerald-700" : tahap === i + 1 ? "font-semibold text-primary-900" : "text-gray-400"}`}>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${tahap > i + 1 ? "bg-emerald-600 text-white" : tahap === i + 1 ? "bg-primary-900 text-white" : "bg-gray-200 text-gray-500"}`}>{i + 1}</span>
                        {t}
                      </li>
                    ))}
                  </ol>
                  {s.mapel.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-gray-400">Belum ada penugasan mengajar untuk kelas ini.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead><tr><th>Mata Pelajaran</th><th>Guru</th><th>Form Nilai Rapor</th><th className="text-right">Nilai jurnal</th><th>Kelengkapan jurnal</th></tr></thead>
                        <tbody>
                          {s.mapel.map(m => {
                            const persen = k.jumlahSiswa ? Math.round((m.dinilai / k.jumlahSiswa) * 100) : 0;
                            return (
                              <tr key={m.mapel}>
                                <td className="font-medium text-primary-900">{m.mapel}</td>
                                <td className="text-xs text-gray-600">{m.guru}</td>
                                <td>
                                  <Link href={`${rute.form}?${new URLSearchParams({ classId: k.id, subject: m.mapel, semester }).toString()}`}
                                    className="inline-flex items-center gap-1.5 hover:opacity-80" title="Buka form">
                                    <StatusForm status={m.form?.status ?? "BELUM"} />{m.form?.katrol && <span className="text-xs text-gray-500">katrol</span>}
                                  </Link>
                                </td>
                                <td className="text-right tabular-nums">{m.dinilai}/{k.jumlahSiswa}</td>
                                <td className="min-w-[9rem]">
                                  <div className="flex items-center gap-2">
                                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                                      <span className={`block h-full rounded-full ${persen >= 100 ? "bg-emerald-500" : persen > 0 ? "bg-amber-400" : "bg-gray-200"}`} style={{ width: `${Math.min(100, persen)}%` }} />
                                    </span>
                                    <span className="w-10 text-right text-xs tabular-nums text-gray-500">{Math.min(100, persen)}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  </>)}
                </div>
              );
            })}
          </div>
        </>
      )}

      <Modal open={!!catatanKelas} onClose={() => !simpanCatatan && setCatatanKelas(null)} size="xl" scrollBody
        title={`Catatan Wali Kelas — ${catatanKelas?.nama ?? ""}`} description={`Semester ${semester} · tampil di rapor siswa`}
        headerActions={baris && !terkunciSah ? (
          <button type="button" onClick={() => setBaris(bs => bs?.map(b => (b.catatan.trim() ? b : { ...b, catatan: b.saran })) ?? null)}
            className="btn-modal-cancel px-3 text-xs"><Wand2 size={14} /> Isi yang kosong dengan saran</button>
        ) : undefined}
        footer={<>
          <button type="button" onClick={() => setCatatanKelas(null)} disabled={simpanCatatan} className="btn-modal-cancel">Tutup</button>
          {!terkunciSah && (
            <button type="button" onClick={simpanSemuaCatatan} disabled={simpanCatatan || !baris} className="btn-modal-save">
              {simpanCatatan ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Catatan
            </button>
          )}
        </>}>
        {!baris ? (
          <div className="flex justify-center py-10 text-gray-400"><Loader2 size={22} className="animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            {terkunciSah && <p className="error-msg">Rapor semester ini sudah disahkan — catatan hanya bisa dibaca.</p>}
            {baris.map((b, i) => (
              <div key={b.studentId} className="rounded-xl border border-gray-100 p-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="font-semibold text-primary-900">{b.nama}</p>
                  <p className="text-xs text-gray-500">
                    Hadir {b.persenHadir === null ? "—" : `${b.persenHadir}%`} · rata-rata {b.rata ?? "—"} · {b.belumTuntas} mapel belum tuntas · {b.level}
                  </p>
                </div>
                <textarea value={b.catatan} disabled={terkunciSah} rows={2} maxLength={1000} className="input-field mt-2"
                  placeholder={b.saran}
                  onChange={e => setBaris(bs => bs?.map((x, j) => (j === i ? { ...x, catatan: e.target.value } : x)) ?? null)} />
                {!terkunciSah && b.catatan.trim() !== b.saran && (
                  <button type="button" onClick={() => setBaris(bs => bs?.map((x, j) => (j === i ? { ...x, catatan: x.saran } : x)) ?? null)}
                    className="mt-1 text-xs font-semibold text-primary-700 hover:underline">Pakai saran otomatis</button>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
