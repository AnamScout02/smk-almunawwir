"use client";
import { useEffect, useState } from "react";
import { Briefcase, Loader2, Plus, Calendar, MessageSquare, Building2, FileCheck2, Upload, CheckCircle2, XCircle, Clock, MapPin, Camera, TriangleAlert, Send, X } from "lucide-react";
import Select from "@/components/admin/Select";
import KameraBerkas, { kameraTersedia } from "@/components/spmb/KameraBerkas";
import LencanaFotoJurnal from "@/components/pkl/LencanaFotoJurnal";
import PanelHarianPkl from "@/components/pkl/PanelHarianPkl";
import { kecilkanFoto } from "@/lib/olah-foto";
import { capFoto, waktuCap } from "@/lib/cap-foto";
import { kanvasKeFile } from "@/lib/pindai-dokumen";
import { JENIS_LAPORAN, STATUS_LAPORAN } from "@/lib/pkl-label";
import { antreJurnal, daftarAntrean, kirimAntrean } from "@/lib/antrean-jurnal";
import ImageUpload from "@/components/admin/ImageUpload";
import FileUpload from "@/components/shared/FileUpload";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import DatePicker from "@/components/shared/DatePicker";
import { penempatanBelumPasti } from "@/lib/pkl-tempat";

interface JournalEntry {
  id: string; date: string; activity: string; photoUrl: string | null; teacherNote: string | null;
  fotoTerverifikasi: boolean; fotoWaktu: string | null; kompetensi: string[]; lat: number | null;
  parafIndustriAt: string | null; parafIndustriNama: string | null;
}
interface LaporanSaya { id: string; jenis: string; isi: string; status: string; tindakLanjut: string | null; createdAt: string }
interface Internship {
  id: string; company: string; position: string; supervisor: string;
  startDate: string; endDate: string; status: string; journal: JournalEntry[];
  teacher: { user: { name: string } } | null;
  mitra: { address: string | null; kecamatan: string | null; jamKerja: string | null; contactPhone: string | null } | null;
  laporanMasalah: LaporanSaya[];
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
  // Foto jurnal dari KAMERA di halaman (terverifikasi) — lihat src/lib/pkl-foto.ts. Galeri tetap bisa, tanpa tanda.
  const [adaKamera, setAdaKamera] = useState(false);
  const [kamera, setKamera] = useState(false);
  const [fotoKamera, setFotoKamera] = useState<{ url: string; waktu: number; tanda: string } | null>(null);
  const [memrosesFoto, setMemrosesFoto] = useState(false);
  const [pakaiGaleri, setPakaiGaleri] = useState(false);
  // Sinyal putus: foto & jurnal ditahan di HP (IndexedDB) dan dikirim sendiri saat sinyal kembali — lihat antrean-jurnal.ts.
  const [fotoTunda, setFotoTunda] = useState<{ blob: Blob; url: string } | null>(null);
  const [menunggu, setMenunggu] = useState(0);
  const [daftarKompetensi, setDaftarKompetensi] = useState<string[]>([]);
  const [kompetensi, setKompetensi] = useState<string[]>([]);
  // Laporan masalah ke Humas & guru pembimbing.
  const [lapor, setLapor] = useState(false);
  const [laporan, setLaporan] = useState({ jenis: "", isi: "" });
  const [mengirimLaporan, setMengirimLaporan] = useState(false);
  useEffect(() => { setAdaKamera(kameraTersedia()); }, []);
  useEffect(() => {
    let batal = false;
    const coba = async () => {
      const n = await kirimAntrean().catch(() => 0);
      const sisa = (await daftarAntrean()).length;
      if (batal) return;
      setMenunggu(sisa);
      if (n > 0) { toast.success(`${n} jurnal yang tertahan sudah terkirim.`); load(); }
    };
    coba();
    window.addEventListener("online", coba);
    return () => { batal = true; window.removeEventListener("online", coba); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pendaftaran PKL (tingkat kelasnya diatur sekolah, lihat SiteSetting pkl.tingkatPendaftar) ──
  const [bolehDaftar, setBolehDaftar] = useState(false);
  const [alasanTutup, setAlasanTutup] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [docUploads, setDocUploads] = useState<Record<string, string>>({});
  const [regLoading, setRegLoading] = useState(true);
  const [submittingReg, setSubmittingReg] = useState(false);

  function load() {
    fetch("/api/student/pkl").then(r => r.json()).then(d => { setInternship(d.internship); setDaftarKompetensi(Array.isArray(d.kompetensi) ? d.kompetensi : []); setLoading(false); }).catch(() => setLoading(false));
  }
  function loadRegistration() {
    setRegLoading(true);
    fetch("/api/student/pkl/registration").then(r => r.json()).then(d => {
      setBolehDaftar(!!d.bolehDaftar);
      setAlasanTutup(d.alasanTutup ?? null);
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
    const bersih = () => {
      setActivity(""); setPhotoUrl(""); setDate(todayStr()); setShowForm(false); setLokasi(null); setStatusLokasi("");
      setFotoKamera(null); setKompetensi([]); setPakaiGaleri(false); setFotoTunda(null);
    };
    // Sinyal putus (atau foto masih tertahan di HP): simpan ke antrean, jangan suruh siswa mengetik ulang.
    const tahan = async () => {
      await antreJurnal({ id: `${Date.now()}-${Math.round(performance.now())}`, date, activity: activity.trim(), kompetensi, lokasi, foto: fotoTunda?.blob ?? null, dibuat: Date.now() });
      setMenunggu((await daftarAntrean()).length);
      bersih();
      // Sinyal sudah kembali (hanya fotonya yang tadi tertahan) → langsung kirim, tidak perlu menunggu peristiwa "online".
      const n = navigator.onLine ? await kirimAntrean().catch(() => 0) : 0;
      setMenunggu((await daftarAntrean()).length);
      if (n > 0) { toast.success("Jurnal terkirim."); load(); }
      else toast.success("Sinyal putus — jurnal disimpan di HP dan dikirim sendiri saat sinyal kembali.");
    };
    try {
      if (fotoTunda || !navigator.onLine) { await tahan(); return; }
      const res = await fetch("/api/student/pkl/journal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, activity, photoUrl, kompetensi, ...(lokasi ?? {}), ...(fotoKamera && fotoKamera.url === photoUrl ? { tanda: fotoKamera.tanda, waktuFoto: fotoKamera.waktu } : {}) }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Gagal menyimpan"); return; }
      bersih();
      load();
    } catch {
      await tahan().catch(() => setError("Gagal menyimpan. Periksa sinyal lalu coba lagi."));
    } finally { setSaving(false); }
  }

  /** Foto dari kamera: dikecilkan, dicap waktu + lokasi + tempat PKL, lalu dikirim ke jalur khusus yang
   *  mencatat WAKTU SERVER dan mengembalikan tanda — jurnal dengan tanda itu tampil "foto kamera". */
  async function fotoDariKamera(file: File) {
    setKamera(false); setMemrosesFoto(true); setError("");
    try {
      const olah = await kecilkanFoto(file, 1600);
      if (!olah.kanvas) throw new Error("foto");
      const baris = [waktuCap(), lokasi ? `${lokasi.lat.toFixed(5)}, ${lokasi.lng.toFixed(5)} (±${Math.round(lokasi.akurasi)} m)` : "", internship?.company ?? ""];
      const jadi = await kanvasKeFile(capFoto(olah.kanvas, baris), "jurnal-pkl.jpg", 0.82);
      if (!jadi) throw new Error("foto");
      const fd = new FormData();
      fd.append("file", jadi);
      const r = await fetch("/api/student/pkl/foto", { method: "POST", body: fd }).catch(() => null);
      // Sinyal putus saat mengunggah: fotonya ditahan di HP dan ikut antrean jurnal.
      if (!r) { setFotoTunda({ blob: jadi, url: URL.createObjectURL(jadi) }); setPhotoUrl(""); setFotoKamera(null); setDate(todayStr()); return; }
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.url) throw new Error(d?.error || "unggah");
      setFotoTunda(null); setFotoKamera(d); setPhotoUrl(d.url); setDate(todayStr());
    } catch (e) {
      setError(e instanceof Error && e.message.length > 8 ? e.message : "Foto gagal diproses. Coba ambil lagi.");
    } finally { setMemrosesFoto(false); }
  }

  async function kirimLaporan() {
    if (!laporan.jenis || laporan.isi.trim().length < 10) { toast.error("Pilih jenis masalah dan jelaskan minimal 10 huruf."); return; }
    setMengirimLaporan(true);
    const r = await fetch("/api/student/pkl/laporan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(laporan) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMengirimLaporan(false);
    if (!r?.ok) { toast.error(d?.error || "Gagal mengirim laporan"); return; }
    toast.success("Laporan terkirim ke Humas dan guru pembimbing.");
    setLaporan({ jenis: "", isi: "" }); setLapor(false); load();
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

      {/* Pendaftaran PKL — tampil selama sekolah membuka tingkat kelas ini DAN tempat PKL-nya
          belum pasti. Dulu panel ini hanya muncul saat siswa belum punya baris PKL sama sekali,
          jadi begitu admin memasukkan seluruh peserta lebih dulu, formulirnya ikut hilang. */}
      {bolehDaftar && penempatanBelumPasti(internship?.company) && (
        <div className="panel p-5 mb-6">
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
            Daftar dan lengkapi berkas syaratnya. <b>Tempat PKL dan guru pembimbing ditetapkan sekolah</b>
            (Humas / bagian PKL), bukan dipilih sendiri.
          </p>

          {regLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
          ) : (
            <>
              {registration?.status === "REJECTED" && registration.reviewNote && (
                <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                  <span className="font-semibold">Alasan ditolak:</span> {registration.reviewNote} — silakan perbaiki lalu ajukan ulang.
                </div>
              )}

              {requirements.length > 0 ? (
                <div className="space-y-3">
                  {requirements.map(r => (
                    <FileUpload key={r.id} value={docUploads[r.id] || ""} folder="pkl-registration"
                      label={r.name}
                      onChange={url => setDocUploads(prev => ({ ...prev, [r.id]: url }))} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Sekolah belum menetapkan dokumen syarat — kamu tetap bisa mendaftar sekarang.</p>
              )}

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
      )}

      {!internship ? (
        !bolehDaftar && (
          <EmptyState icon={Briefcase} title="Belum Ada Data PKL"
            description={alasanTutup ?? "Informasi PKL akan muncul setelah diinput oleh admin/wali kelas."} />
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
              {internship.teacher && <div><span className="text-gray-400 text-xs">Guru pembimbing</span><p className="font-semibold text-navy">{internship.teacher.user.name}</p></div>}
              {internship.mitra?.jamKerja && <div><span className="text-gray-400 text-xs">Jam kerja</span><p className="font-semibold text-navy">{internship.mitra.jamKerja}</p></div>}
              {internship.mitra?.address && <div className="sm:col-span-2"><span className="text-gray-400 text-xs">Alamat</span><p className="font-semibold text-navy">{internship.mitra.address}</p></div>}
            </div>
          </div>

          <PanelHarianPkl />

          {/* Laporan masalah — sakit, kecelakaan kerja, tidak cocok, dll. Sampai ke Humas & guru pembimbing. */}
          <div className="panel p-5 mb-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading font-semibold text-navy flex items-center gap-2"><TriangleAlert size={16} className="text-amber-600" /> Ada masalah di tempat PKL?</h3>
              {!lapor && <button type="button" onClick={() => setLapor(true)} className="btn-modal-cancel btn-teks px-3 text-xs"><Send size={14} /> Laporkan</button>}
            </div>
            {lapor && (
              <div className="mt-4 space-y-3">
                <div><label className="label-field">Jenis masalah</label>
                  <Select value={laporan.jenis} onChange={v => setLaporan(l => ({ ...l, jenis: v }))} placeholder="Pilih jenis masalah" options={Object.entries(JENIS_LAPORAN).map(([value, label]) => ({ value, label }))} /></div>
                <div><label className="label-field">Ceritakan yang terjadi</label>
                  <textarea className="input-field" rows={3} value={laporan.isi} onChange={e => setLaporan(l => ({ ...l, isi: e.target.value }))} placeholder="Apa yang terjadi, sejak kapan, dan apa yang kamu butuhkan dari sekolah" /></div>
                <p className="text-xs text-gray-500">Laporan dibaca Humas dan guru pembimbingmu, bukan pihak tempat PKL. Untuk keadaan darurat, telepon guru pembimbing langsung.</p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setLapor(false)} className="btn-modal-cancel">Batal</button>
                  <button type="button" onClick={kirimLaporan} disabled={mengirimLaporan} className="btn-modal-save">{mengirimLaporan ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Kirim Laporan</button>
                </div>
              </div>
            )}
            {internship.laporanMasalah.length > 0 && (
              <ul className="mt-4 space-y-2">
                {internship.laporanMasalah.map(l => (
                  <li key={l.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-primary-900">{JENIS_LAPORAN[l.jenis] ?? l.jenis}</span>
                      <span className={`status-badge ${STATUS_LAPORAN[l.status]?.kelas ?? ""}`}>{STATUS_LAPORAN[l.status]?.label ?? l.status}</span>
                      <span className="angka ml-auto text-xs text-gray-400">{fmt(l.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-gray-600">{l.isi}</p>
                    {l.tindakLanjut && <p className="mt-2 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-700"><span className="font-semibold">Tindak lanjut sekolah:</span> {l.tindakLanjut}</p>}
                  </li>
                ))}
              </ul>
            )}
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

            {menunggu > 0 && (
              <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span className="angka font-semibold">{menunggu}</span> jurnal masih tersimpan di HP ini, menunggu sinyal. Jangan hapus data peramban atau aplikasi sampai terkirim.
              </p>
            )}
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
                {daftarKompetensi.length > 0 && (
                  <div>
                    <label className="label-field">Kompetensi yang dilatih hari ini</label>
                    <div className="flex flex-wrap gap-1.5">
                      {daftarKompetensi.map(k => {
                        const pilih = kompetensi.includes(k);
                        return (
                          <button key={k} type="button" aria-pressed={pilih} onClick={() => setKompetensi(v => pilih ? v.filter(x => x !== k) : [...v, k])}
                            className={`sentuh rounded-full border px-3 py-1 text-xs font-medium transition ${pilih ? "border-primary-900 bg-primary-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>{k}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={ambilLokasi} className="btn-modal-cancel px-3 text-xs"><MapPin size={14} /> {lokasi ? "Perbarui Lokasi" : "Sertakan Lokasi Saat Ini"}</button>
                  {statusLokasi && <span className={`text-xs ${lokasi ? "text-emerald-700" : "text-gray-500"}`}>{statusLokasi}</span>}
                </div>
                <div>
                  <label className="label-field">Foto bukti kegiatan</label>
                  {adaKamera && !pakaiGaleri ? (
                    <>
                      {fotoTunda ? (
                        <div className="flex items-start gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={fotoTunda.url} alt="Foto kegiatan" className="h-28 w-28 rounded-xl border border-gray-100 object-cover" />
                          <div className="min-w-0 space-y-2">
                            <p className="text-xs text-amber-700">Sinyal putus — foto disimpan di HP dan ikut terkirim bersama jurnal.</p>
                            <button type="button" onClick={() => setFotoTunda(null)} className="btn-modal-cancel btn-teks px-3 text-xs"><X size={14} /> Hapus foto</button>
                          </div>
                        </div>
                      ) : photoUrl && fotoKamera?.url === photoUrl ? (
                        <div className="flex items-start gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photoUrl} alt="Foto kegiatan" className="h-28 w-28 rounded-xl border border-gray-100 object-cover" />
                          <div className="min-w-0 space-y-2">
                            <LencanaFotoJurnal ada terverifikasi waktu={new Date(fotoKamera.waktu).toISOString()} lokasi={!!lokasi} />
                            <button type="button" onClick={() => { setPhotoUrl(""); setFotoKamera(null); }} className="btn-modal-cancel btn-teks px-3 text-xs"><X size={14} /> Hapus foto</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => { if (!lokasi) ambilLokasi(); setKamera(true); }} disabled={memrosesFoto} className="btn-modal-cancel btn-teks w-full">
                          {memrosesFoto ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {memrosesFoto ? "Memproses foto…" : "Ambil Foto dengan Kamera"}
                        </button>
                      )}
                      <p className="mt-1.5 text-xs text-gray-500">Foto diambil langsung dari kamera, lalu dicap waktu, lokasi, dan nama tempat PKL.{" "}
                        <button type="button" className="font-medium text-primary-700 hover:underline" onClick={() => { setPakaiGaleri(true); setPhotoUrl(""); setFotoKamera(null); }}>Kamera tidak bisa dipakai?</button></p>
                    </>
                  ) : (
                    <>
                      <ImageUpload value={photoUrl} onChange={setPhotoUrl} folder="pkl-jurnal" label="" />
                      <p className="mt-1.5 text-xs text-amber-700">Foto dari galeri tercatat sebagai &ldquo;waktu tidak terverifikasi&rdquo;.{adaKamera ? <>{" "}<button type="button" className="font-medium text-primary-700 hover:underline" onClick={() => { setPakaiGaleri(false); setPhotoUrl(""); }}>Pakai kamera</button></> : " Buka aplikasi lewat alamat HTTPS sekolah untuk memakai kamera."}</p>
                    </>
                  )}
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
              <p className="text-sm text-gray-400 text-center py-10">Belum ada jurnal harian. Mulai catat kegiatan PKL-mu hari ini!</p>
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
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <LencanaFotoJurnal ada={!!entry.photoUrl} terverifikasi={entry.fotoTerverifikasi} waktu={entry.fotoWaktu} lokasi={entry.lat != null} />
                        {entry.parafIndustriAt && <span className="text-xs font-medium text-emerald-700">diparaf {entry.parafIndustriNama ?? "pembimbing industri"}</span>}
                      </div>
                      {entry.kompetensi.length > 0 && <p className="mt-1 text-xs text-gray-500">Kompetensi: {entry.kompetensi.join(", ")}</p>}
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
      {kamera && <KameraBerkas mode="bebas" onTutup={() => setKamera(false)} onFoto={fotoDariKamera} />}
    </div>
  );
}
