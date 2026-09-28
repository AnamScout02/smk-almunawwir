"use client";
import React, { useState, useEffect, useCallback } from "react";
import DatePicker from "@/components/shared/DatePicker";
import {
  Calendar, Plus, Trash2, CheckCircle, AlertTriangle,
  ChevronDown, Save, BarChart2, Users, TrendingUp, CalendarDays,
  GraduationCap, MinusCircle, XCircle, Repeat, Loader2,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Alert from "@/components/admin/Alert";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  _count: { studentHistory: number };
}

interface Statistik {
  total: number;
  aktif: number;
  lulus: number;
  keluar: number;
  pindah: number;
  perGrade: { grade: number; count: number }[];
  perMajor: { name: string; count: number }[];
}

interface NaikKelasResult {
  promoted: number;
  graduated: number;
  skipped: number;
  errors: string[];
  pklWarnings?: string[];
}

interface NaikKelasPreviewEntry {
  studentId: string;
  name: string;
  fromClass: string | null;
  toClassName?: string;
  pklWarning?: boolean;
}
interface NaikKelasPreview {
  promoted: NaikKelasPreviewEntry[];
  graduated: NaikKelasPreviewEntry[];
  skipped: NaikKelasPreviewEntry[];
  errors: string[];
  pklWarnings: string[];
  error?: string;
}

const CLS = "input-field";

function fmtDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function TahunAjaranPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<AcademicYear | null>(null);
  const [confirmNaik, setConfirmNaik] = useState(false);
  const [naikLoading, setNaikLoading] = useState(false);
  const [naikResult, setNaikResult] = useState<NaikKelasResult | null>(null);
  const [naikPreview, setNaikPreview] = useState<NaikKelasPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [statistik, setStatistik] = useState<Statistik | null>(null);
  const [statLoading, setStatLoading] = useState(false);
  const [selectedYearId, setSelectedYearId] = useState<string>("");

  const fetchYears = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/tahun-ajaran");
    const data = await res.json();
    setYears(data);
    setLoading(false);
  }, []);

  const fetchStat = useCallback(async (yearId?: string) => {
    setStatLoading(true);
    const url = yearId
      ? `/api/admin/tahun-ajaran/statistik?yearId=${yearId}`
      : "/api/admin/tahun-ajaran/statistik";
    const res = await fetch(url);
    const data = await res.json();
    setStatistik(data);
    setStatLoading(false);
  }, []);

  useEffect(() => {
    fetchYears();
    fetchStat();
  }, [fetchYears, fetchStat]);

  async function handleCreate() {
    setFormError("");
    if (!form.name.trim()) { setFormError("Nama tahun ajaran wajib diisi"); return; }
    setSaving(true);
    const res = await fetch("/api/admin/tahun-ajaran", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setFormError(data.error ?? "Terjadi kesalahan"); return; }
    setShowModal(false);
    setForm({ name: "", startDate: "", endDate: "", notes: "" });
    fetchYears();
  }

  async function handleActivate(id: string) {
    await fetch(`/api/admin/tahun-ajaran/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    fetchYears();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/tahun-ajaran/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    fetchYears();
  }

  async function openNaikKelasModal() {
    setConfirmNaik(true);
    setNaikPreview(null);
    setPreviewLoading(true);
    const res = await fetch("/api/admin/tahun-ajaran/naik-kelas").catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setPreviewLoading(false);
    if (res?.ok && data) setNaikPreview(data);
    else setNaikPreview({ promoted: [], graduated: [], skipped: [], errors: [], pklWarnings: [], error: data?.error ?? "Gagal memuat pratinjau." });
  }

  async function handleNaikKelas() {
    setNaikLoading(true);
    setNaikResult(null);
    const res = await fetch("/api/admin/tahun-ajaran/naik-kelas", { method: "POST" });
    const data = await res.json();
    setNaikLoading(false);
    setConfirmNaik(false);
    setNaikPreview(null);
    if (res.ok) {
      setNaikResult(data);
      fetchYears();
      fetchStat(selectedYearId || undefined);
    } else {
      setNaikResult({ promoted: 0, graduated: 0, skipped: 0, errors: [data.error ?? "Terjadi kesalahan"] });
    }
  }

  function handleStatYear(yearId: string) {
    setSelectedYearId(yearId);
    fetchStat(yearId || undefined);
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<CalendarDays size={22} />}
        title="Tahun Ajaran"
        description="Kelola tahun ajaran dan proses kenaikan kelas"
      />
      {/* Daftar Tahun Ajaran */}
      <div className="space-y-3 mb-8">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><Loader2 size={18} className="animate-spin" /> Memuat data...</div>
        ) : years.length === 0 ? (
          <EmptyState icon={Calendar} description="Belum ada tahun ajaran" />
        ) : years.map((year) => (
          <div key={year.id}
            className={`bg-white rounded-2xl border-2 p-5 flex items-start justify-between gap-4 shadow-sm hover:shadow-md transition-shadow ${
              year.isActive ? "border-primary-500" : "border-gray-100"
            }`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-lg font-bold text-primary-900">{year.name}</h3>
                {year.isActive && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full">
                    <CheckCircle size={11} /> Aktif
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-1">
                {fmtDate(year.startDate)} — {fmtDate(year.endDate)}
              </p>
              {year.notes && <p className="text-xs text-gray-400 italic">{year.notes}</p>}
              <p className="text-xs text-gray-400 mt-1">
                {year._count.studentHistory} data riwayat siswa tersimpan
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!year.isActive && (
                <>
                  <button
                    onClick={() => handleActivate(year.id)}
                    className="px-3 py-1.5 text-xs bg-primary-50 text-primary-700 rounded-xl hover:bg-primary-100 border border-primary-100 font-semibold transition-colors"
                  >
                    Aktifkan
                  </button>
                  <button
                    onClick={() => setConfirmDelete(year)}
                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                    title="Hapus"
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Section Naik Kelas */}
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-8">
        <div className="flex items-start gap-3 mb-4">
          <TrendingUp className="text-amber-600 mt-0.5 shrink-0" size={22} />
          <div>
            <h2 className="text-lg font-bold text-gray-800">Naik Kelas</h2>
            <p className="text-sm text-gray-600 mt-1">
              Fitur ini akan memindahkan semua siswa aktif ke kelas berikutnya. Grade 12 akan diluluskan.
              Pastikan data sudah benar sebelum melanjutkan.
            </p>
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-lg p-4 mb-4 flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            <strong>Perhatian:</strong> Proses ini tidak dapat dibatalkan. Semua siswa AKTIF akan di-snapshot
            ke riwayat tahun ajaran aktif, lalu dipindahkan ke kelas berikutnya. Siswa grade 12 akan
            ditetapkan status LULUS. Harap lakukan backup data sebelum proses.
          </p>
        </div>

        <button
          onClick={openNaikKelasModal}
          disabled={naikLoading}
          className="btn-awas"
        >
          <TrendingUp size={16} />
          {naikLoading ? "Memproses..." : "Proses Naik Kelas"}
        </button>

        {naikResult && (
          <Alert variant={naikResult.errors.length > 0 ? "warning" : "success"} className="mt-4" title="Hasil Proses Naik Kelas:">
            <div className="kisi-kartu kisi-kartu-3 mb-5">
              <StatTile size="md" color="blue" icon={TrendingUp} value={naikResult.promoted} label="Naik Kelas" />
              <StatTile size="md" color="emerald" icon={GraduationCap} value={naikResult.graduated} label="Lulus" />
              <StatTile size="md" color="gray" icon={MinusCircle} value={naikResult.skipped} label="Dilewati" />
            </div>
            {naikResult.errors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 mb-1">Error ({naikResult.errors.length}):</p>
                <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
                  {naikResult.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                  {naikResult.errors.length > 5 && <li>...dan {naikResult.errors.length - 5} error lainnya</li>}
                </ul>
              </div>
            )}
            {naikResult.pklWarnings && naikResult.pklWarnings.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-amber-700 mb-1">
                  ⚠ {naikResult.pklWarnings.length} siswa naik ke XII TANPA pendaftaran PKL disetujui (tetap dinaikkan, mohon ditindaklanjuti):
                </p>
                <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                  {naikResult.pklWarnings.slice(0, 8).map((name, i) => <li key={i}>{name}</li>)}
                  {naikResult.pklWarnings.length > 8 && <li>...dan {naikResult.pklWarnings.length - 8} siswa lainnya</li>}
                </ul>
              </div>
            )}
          </Alert>
        )}
      </div>

      <div className="alat-aksi justify-end mb-5">
        <button
          onClick={() => { setShowModal(true); setFormError(""); }}
          className="btn-modal-save"
        >
          <Plus size={16} /> Buat Tahun Ajaran
        </button>
      </div>

      {/* Section Statistik */}
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4"
          style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.04) 0%, rgba(27,43,107,0.02) 100%)", borderBottom: "1px solid rgba(15,26,69,0.06)" }}>
          <div className="flex items-center gap-2">
            <BarChart2 className="text-primary-700" size={18} />
            <h2 className="font-heading font-semibold text-primary-900">Statistik Siswa</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Tahun:</span>
            <Select
              className="w-auto text-xs"
              value={selectedYearId}
              onChange={v => handleStatYear(v)}
              options={[{ value: "", label: "Tahun Berjalan (Live)" }, ...years.map(y => ({ value: y.id, label: y.name }))]}
            />
          </div>
        </div>
        <div className="p-6">

        {statLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><Loader2 size={18} className="animate-spin" /> Memuat statistik...</div>
        ) : statistik ? (
          <div>
            {/* Ringkasan */}
            <div className="grid grid-cols-5 gap-3 mb-6">
              {[
                { label: "Total", value: statistik.total, color: "primary" as const, icon: Users },
                { label: "Aktif", value: statistik.aktif, color: "emerald" as const, icon: CheckCircle },
                { label: "Lulus", value: statistik.lulus, color: "blue" as const, icon: GraduationCap },
                { label: "Keluar", value: statistik.keluar, color: "red" as const, icon: XCircle },
                { label: "Pindah", value: statistik.pindah, color: "amber" as const, icon: Repeat },
              ].map(item => (
                <StatTile key={item.label} size="md" color={item.color} icon={item.icon} value={item.value} label={item.label} />
              ))}
            </div>

            {/* Per Grade & Per Jurusan */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Users size={14} /> Per Tingkat
                </h3>
                <div className="space-y-2">
                  {statistik.perGrade.length === 0 ? (
                    <p className="text-sm text-gray-400">Tidak ada data</p>
                  ) : statistik.perGrade.map(item => (
                    <div key={item.grade} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 w-20">Grade {item.grade}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-primary-500 h-2 rounded-full"
                          style={{ width: statistik.total > 0 ? `${(item.count / statistik.total) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <ChevronDown size={14} /> Per Jurusan
                </h3>
                <div className="space-y-2">
                  {statistik.perMajor.length === 0 ? (
                    <p className="text-sm text-gray-400">Tidak ada data</p>
                  ) : statistik.perMajor.map(item => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 w-28 truncate">{item.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full"
                          style={{ width: statistik.total > 0 ? `${(item.count / statistik.total) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </div>

      {/* Modal Buat Tahun Ajaran */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Buat Tahun Ajaran"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button onClick={handleCreate} disabled={saving} className="btn-modal-save flex-1">
              <Save size={15} />
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <p className="error-msg">{formError}</p>}
          <div>
            <label className="label-field">Nama Tahun Ajaran <span className="text-red-500">*</span></label>
            <input className={CLS} placeholder="Contoh: 2024/2025" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="label-field">Tanggal Mulai</label>
            <DatePicker value={form.startDate} onChange={v => setForm(p => ({ ...p, startDate: v }))} />
          </div>
          <div>
            <label className="label-field">Tanggal Selesai</label>
            <DatePicker value={form.endDate} onChange={v => setForm(p => ({ ...p, endDate: v }))} />
          </div>
          <div>
            <label className="label-field">Catatan</label>
            <textarea className={`${CLS} resize-none`} rows={3} placeholder="Opsional"
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Konfirmasi Hapus */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        size="sm"
        title={<span className="flex items-center gap-3"><span className="w-9 h-9 bg-red-500/20 rounded-full flex items-center justify-center shrink-0"><Trash2 size={16} className="text-red-300" /></span>Hapus Tahun Ajaran</span>}
        description={confirmDelete?.name ?? ""}
        footer={
          <>
            <button onClick={() => setConfirmDelete(null)} className="btn-modal-cancel flex-1">Batal</button>
            <button onClick={() => confirmDelete && handleDelete(confirmDelete.id)}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold transition-colors">
              Ya, Hapus
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Apakah Anda yakin ingin menghapus tahun ajaran ini? Semua data riwayat siswa
          yang terkait juga akan terhapus.
        </p>
      </Modal>

      {/* Konfirmasi Naik Kelas — dengan PRATINJAU (dry-run) nyata dari server, bukan cuma daftar
          statis "yang akan terjadi", supaya admin benar2 lihat SIAPA naik/lulus/error sebelum
          menekan tombol yang tidak bisa dibatalkan. */}
      <Modal
        open={confirmNaik}
        onClose={() => setConfirmNaik(false)}
        title={<span className="flex items-center gap-3"><span className="w-9 h-9 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0"><TrendingUp size={16} className="text-amber-300" /></span>Konfirmasi Proses Naik Kelas</span>}
        description="Tindakan ini tidak dapat dibatalkan"
        size="lg"
        scrollBody
        footer={
          <>
            <button onClick={() => setConfirmNaik(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button onClick={handleNaikKelas} disabled={naikLoading || previewLoading || !!naikPreview?.error}
              className="btn-awas flex-1">
              <TrendingUp size={15} />
              {naikLoading ? "Memproses..." : "Ya, Proses Sekarang"}
            </button>
          </>
        }
      >
        {previewLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
            <Loader2 size={20} className="animate-spin" /> Menghitung pratinjau...
          </div>
        ) : naikPreview?.error ? (
          <Alert variant="error" title="Tidak bisa memproses">{naikPreview.error}</Alert>
        ) : naikPreview ? (
          <div className="space-y-4">
            <div className="kisi-kartu kisi-kartu-3">
              <StatTile size="md" color="blue" icon={TrendingUp} value={naikPreview.promoted.length} label="Akan Naik" />
              <StatTile size="md" color="emerald" icon={GraduationCap} value={naikPreview.graduated.length} label="Akan Lulus" />
              <StatTile size="md" color="gray" icon={MinusCircle} value={naikPreview.skipped.length} label="Dilewati" />
            </div>

            {naikPreview.errors.length > 0 && (
              <Alert variant="error" title={`${naikPreview.errors.length} Error — kelas tujuan tidak ditemukan`}>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  {naikPreview.errors.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}
                  {naikPreview.errors.length > 6 && <li>...dan {naikPreview.errors.length - 6} lainnya</li>}
                </ul>
              </Alert>
            )}

            {naikPreview.pklWarnings.length > 0 && (
              <Alert variant="warning" title={`${naikPreview.pklWarnings.length} siswa naik ke XII tanpa PKL disetujui (tetap akan naik)`}>
                <p className="text-xs">{naikPreview.pklWarnings.slice(0, 5).join(", ")}{naikPreview.pklWarnings.length > 5 ? `, dan ${naikPreview.pklWarnings.length - 5} lainnya` : ""}</p>
              </Alert>
            )}

            {naikPreview.promoted.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Contoh siswa yang akan naik kelas:</p>
                <div className="max-h-40 overflow-y-auto scrollbar-visible rounded-xl border border-gray-100 divide-y divide-gray-50">
                  {naikPreview.promoted.slice(0, 15).map(p => (
                    <div key={p.studentId} className="flex items-center justify-between px-3 py-1.5 text-xs">
                      <span className="text-gray-700">{p.name}</span>
                      <span className="text-gray-400">{p.fromClass} → <strong className="text-primary-700">{p.toClassName}</strong></span>
                    </div>
                  ))}
                  {naikPreview.promoted.length > 15 && (
                    <p className="px-3 py-1.5 text-xs text-gray-400">...dan {naikPreview.promoted.length - 15} siswa lainnya</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
