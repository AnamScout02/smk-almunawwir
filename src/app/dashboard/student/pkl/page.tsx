"use client";
import { useEffect, useState } from "react";
import { Briefcase, Loader2, Plus, Calendar, MessageSquare, Building2, FileCheck2, Upload, CheckCircle2, XCircle, Clock, MapPin } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import FileUpload from "@/components/shared/FileUpload";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import DatePicker from "@/components/shared/DatePicker";

interface JournalEntry {
  id: string; date: string; activity: string; photoUrl: string | null; teacherNote: string | null;
}
interface Internship {
  id: string; company: string; position: string; supervisor: string;
  startDate: string; endDate: string; status: string; journal: JournalEntry[];
}
interface Requirement { id: string; name: string; active: boolean }
interface RegDoc { requirementId: string; fileUrl: string }
interface Registration { id: string; status: string; reviewNote: string | null; submittedAt: string; documents: RegDoc[] }

const STATUS_LABEL: Record<string, { label: string; badge: string }> = {
  ONGOING: { label: "Sedang PKL", badge: "bg-blue-50 text-blue-700 border border-blue-200" },
  COMPLETED: { label: "Selesai", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  CANCELLED: { label: "Dibatalkan", badge: "bg-red-50 text-red-600 border border-red-200" },
};
const REG_STATUS: Record<string, { label: string; badge: string; icon: typeof Clock }> = {
  PENDING: { label: "Menunggu Persetujuan", badge: "bg-amber-50 text-amber-700 border border-amber-200", icon: Clock },
  APPROVED: { label: "Disetujui", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: CheckCircle2 },
  REJECTED: { label: "Ditolak", badge: "bg-red-50 text-red-600 border border-red-200", icon: XCircle },
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StudentPklPage() {
  const toast = useToast();
  const [internship, setInternship] = useState<Internship | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [activity, setActivity] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [lokasi, setLokasi] = useState<{ lat: number; lng: number; akurasi: number } | null>(null);
  const [statusLokasi, setStatusLokasi] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Pendaftaran PKL (siswa kelas XI) ──
  const [isGradeXi, setIsGradeXi] = useState(false);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [docUploads, setDocUploads] = useState<Record<string, string>>({});
  const [regLoading, setRegLoading] = useState(true);
  const [submittingReg, setSubmittingReg] = useState(false);

  function load() {
    fetch("/api/student/pkl").then(r => r.json()).then(d => { setInternship(d.internship); setLoading(false); }).catch(() => setLoading(false));
  }
  function loadRegistration() {
    setRegLoading(true);
    fetch("/api/student/pkl/registration").then(r => r.json()).then(d => {
      setIsGradeXi(!!d.isGradeXi);
      setRequirements(Array.isArray(d.requirements) ? d.requirements : []);
      setRegistration(d.registration ?? null);
      if (d.registration?.documents) {
        const map: Record<string, string> = {};
        for (const doc of d.registration.documents) map[doc.requirementId] = doc.fileUrl;
        setDocUploads(map);
      }
    }).catch(() => {}).finally(() => setRegLoading(false));
  }
  useEffect(() => { load(); loadRegistration(); }, []);

  async function handleSubmitRegistration() {
    const documents = requirements.map(r => ({ requirementId: r.id, fileUrl: docUploads[r.id] || "" }));
    if (documents.some(d => !d.fileUrl)) {
      toast.error("Lengkapi semua dokumen syarat terlebih dahulu.");
      return;
    }
    setSubmittingReg(true);
    const res = await fetch("/api/student/pkl/registration", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents }),
    });
    setSubmittingReg(false);
    if (res.ok) { toast.success("Pendaftaran PKL diajukan, menunggu persetujuan."); loadRegistration(); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Gagal mengajukan pendaftaran"); }
  }

  async function handleSubmit() {
    setError("");
    if (!activity.trim()) { setError("Kegiatan wajib diisi."); return; }
    setSaving(true);
    const res = await fetch("/api/student/pkl/journal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, activity, photoUrl, ...(lokasi ?? {}) }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    setActivity(""); setPhotoUrl(""); setDate(todayStr()); setShowForm(false); setLokasi(null); setStatusLokasi("");
    load();
  }

  /** Lokasi opsional sebagai bukti berada di tempat PKL — hanya berjalan di HTTPS dan atas izin siswa. */
  function ambilLokasi() {
    if (!window.isSecureContext || !navigator.geolocation) { setStatusLokasi("Lokasi hanya bisa diambil lewat alamat HTTPS aplikasi."); return; }
    setStatusLokasi("Mengambil lokasi…");
    navigator.geolocation.getCurrentPosition(
      p => { setLokasi({ lat: p.coords.latitude, lng: p.coords.longitude, akurasi: p.coords.accuracy }); setStatusLokasi(`Lokasi tercatat (±${Math.round(p.coords.accuracy)} m).`); },
      () => setStatusLokasi("Izin lokasi ditolak atau lokasi tidak ditemukan."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  if (loading) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Briefcase size={22} />} title="PKL Saya" description="Praktik Kerja Lapangan & jurnal harian" />

      {!internship ? (
        isGradeXi ? (
          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-1">
              <FileCheck2 size={16} className="text-purple-600" />
              <h3 className="font-heading font-semibold text-navy">Pendaftaran PKL</h3>
              {registration && (() => {
                const s = REG_STATUS[registration.status];
                const Icon = s.icon;
                return (
                  <span className={`ml-auto inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${s.badge}`}>
                    <Icon size={12} /> {s.label}
                  </span>
                );
              })()}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Siswa kelas XI wajib mendaftar PKL sebelum naik ke kelas XII. Lengkapi dokumen syarat berikut.
            </p>

            {regLoading ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
            ) : requirements.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Belum ada dokumen syarat yang ditetapkan. Hubungi Wakasek Humas/TU.</p>
            ) : (
              <>
                {registration?.status === "REJECTED" && registration.reviewNote && (
                  <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                    <span className="font-semibold">Alasan ditolak:</span> {registration.reviewNote} — silakan perbaiki dokumen lalu ajukan ulang.
                  </div>
                )}
                <div className="space-y-3">
                  {requirements.map(r => (
                    <FileUpload key={r.id} value={docUploads[r.id] || ""} folder="pkl-registration"
                      label={r.name}
                      onChange={url => setDocUploads(prev => ({ ...prev, [r.id]: url }))} />
                  ))}
                </div>
                {registration?.status !== "APPROVED" && (
                  <div className="flex justify-end mt-4">
                    <button onClick={handleSubmitRegistration} disabled={submittingReg} className="btn-modal-save">
                      {submittingReg ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {registration ? "Ajukan Ulang" : "Ajukan Pendaftaran"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <EmptyState icon={Briefcase} title="Belum Ada Data PKL" description="Informasi PKL akan muncul setelah diinput oleh admin/wali kelas." />
        )
      ) : (
        <>
          <div className="panel p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={16} className="text-purple-600" />
              <h3 className="font-heading font-semibold text-navy">Informasi PKL</h3>
              <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_LABEL[internship.status]?.badge ?? ""}`}>
                {STATUS_LABEL[internship.status]?.label ?? internship.status}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400 text-xs">Perusahaan</span><p className="font-semibold text-navy">{internship.company}</p></div>
              <div><span className="text-gray-400 text-xs">Posisi</span><p className="font-semibold text-navy">{internship.position}</p></div>
              <div><span className="text-gray-400 text-xs">Pembimbing</span><p className="font-semibold text-navy">{internship.supervisor}</p></div>
              <div><span className="text-gray-400 text-xs">Periode</span><p className="font-semibold text-navy">{fmt(internship.startDate)} — {fmt(internship.endDate)}</p></div>
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-navy">Jurnal Harian</h3>
              {!showForm && (
                <button onClick={() => setShowForm(true)} className="btn-modal-save text-xs">
                  <Plus size={14} /> Tambah Jurnal Hari Ini
                </button>
              )}
            </div>

            {showForm && (
              <div className="border border-gray-100 rounded-xl p-4 mb-5 space-y-3 bg-gray-50/50">
                {error && <p className="error-msg">{error}</p>}
                <div>
                  <label className="label-field">Tanggal</label>
                  <DatePicker value={date} onChange={setDate} />
                </div>
                <div>
                  <label className="label-field">Kegiatan Hari Ini</label>
                  <textarea value={activity} onChange={e => setActivity(e.target.value)} rows={3}
                    placeholder="Ceritakan kegiatan yang dikerjakan hari ini..." className="input-field" />
                </div>
                <ImageUpload value={photoUrl} onChange={setPhotoUrl} folder="pkl-jurnal" label="Foto Bukti Kegiatan (opsional)" />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={ambilLokasi} className="btn-modal-cancel px-3 text-xs"><MapPin size={14} /> {lokasi ? "Perbarui Lokasi" : "Sertakan Lokasi Saat Ini"}</button>
                  {statusLokasi && <span className={`text-xs ${lokasi ? "text-emerald-700" : "text-gray-500"}`}>{statusLokasi}</span>}
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowForm(false)} className="btn-modal-cancel">Batal</button>
                  <button onClick={handleSubmit} disabled={saving} className="btn-modal-save">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Simpan Jurnal
                  </button>
                </div>
              </div>
            )}

            {internship.journal.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Belum ada jurnal harian. Mulai catat kegiatan PKL-mu hari ini!</p>
            ) : (
              <div className="space-y-3">
                {internship.journal.map(entry => (
                  <div key={entry.id} className="border border-gray-100 rounded-xl p-4 flex gap-4">
                    {entry.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.photoUrl} alt="Bukti kegiatan" className="w-20 h-20 rounded-lg object-cover shrink-0 border border-gray-100" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                        <Calendar size={12} /> {fmt(entry.date)}
                      </div>
                      <p className="text-sm text-gray-700">{entry.activity}</p>
                      {entry.teacherNote && (
                        <div className="mt-2 flex items-start gap-1.5 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 text-xs text-primary-700">
                          <MessageSquare size={12} className="shrink-0 mt-0.5" />
                          <span><span className="font-semibold">Catatan Pembimbing:</span> {entry.teacherNote}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
