"use client";
import TimePicker from "@/components/shared/TimePicker";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, HeartHandshake, Loader2, Plus, Send, X } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Janji {
  id: string; sumber: string; pengajuNama: string; topik: string; pesan: string; waktuUsul: string | null; status: string;
  jadwal: string | null; tempat: string | null; konselorNama: string | null; createdAt: string;
  siswa: string; nis: string; kelas: string; tujuan?: string; catatanKonselor?: string | null;
}
interface Data { peran: "BK" | "SISWA" | "WALI" | "ORTU"; siswaWali: { id: string; nama: string; kelas: string }[]; anak: { id: string; nama: string; kelas: string }[]; daftar: Janji[] }

const TOPIK: Record<string, string> = { BELAJAR: "Belajar", PRIBADI: "Pribadi", SOSIAL: "Sosial / pertemanan", KARIR: "Karier & lanjut studi", LAINNYA: "Lainnya" };
const STATUS: Record<string, { label: string; kelas: string }> = {
  MENUNGGU: { label: "Menunggu jadwal", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  DIJADWALKAN: { label: "Dijadwalkan", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  SELESAI: { label: "Selesai", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DIBATALKAN: { label: "Dibatalkan", kelas: "bg-gray-50 text-gray-600 border-gray-200" },
};
const SUMBER: Record<string, string> = { SISWA: "Permintaan siswa", WALI_KELAS: "Rujukan wali kelas", ORANG_TUA: "Permintaan orang tua" };
const hariIniWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const fmtJadwal = (s: string) => new Date(s).toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** JANJI TEMU KONSELING (17 Sep 2026) — satu komponen untuk siswa (ajukan), wali kelas (rujuk), dan BK/Kesiswaan/Admin (kelola).
 * Peran ditentukan server; catatan konselor hanya dikirim ke BK. */
export default function KonselingManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [saring, setSaring] = useState("AKTIF");
  const [ajukan, setAjukan] = useState(false);
  const [form, setForm] = useState({ studentId: "", topik: "", pesan: "", waktuUsul: "", tujuan: "BK" });
  const [jadwalkan, setJadwalkan] = useState<Janji | null>(null);
  const [jf, setJf] = useState({ tanggal: hariIniWib(), jam: "09:00", tempat: "Ruang BK" });
  const [tutup, setTutup] = useState<Janji | null>(null);
  const [catatan, setCatatan] = useState("");
  const [rekamBk, setRekamBk] = useState(true);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/konseling", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else setData(d);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function kirim(url: string, method: string, body: unknown, pesanOk: string) {
    setSibuk(true);
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return false; }
    toast.success(pesanOk);
    muat();
    return true;
  }

  async function simpanAjuan() {
    const pesanOk = data?.peran === "SISWA" ? "Permintaan terkirim ke Guru BK." : data?.peran === "ORTU" ? (form.tujuan === "WALI_KELAS" ? "Permintaan terkirim ke wali kelas." : "Permintaan terkirim ke Guru BK.") : "Rujukan terkirim ke Guru BK.";
    if (await kirim("/api/konseling", "POST", form, pesanOk)) {
      setAjukan(false); setForm({ studentId: "", topik: "", pesan: "", waktuUsul: "", tujuan: "BK" });
    }
  }
  async function simpanJadwal() {
    if (!jadwalkan) return;
    const jadwal = `${jf.tanggal}T${jf.jam || "09:00"}:00+07:00`;
    if (await kirim(`/api/konseling/${jadwalkan.id}`, "PATCH", { aksi: "jadwal", jadwal, tempat: jf.tempat }, "Jadwal dikirim ke siswa.")) setJadwalkan(null);
  }
  async function simpanSelesai() {
    if (!tutup) return;
    if (await kirim(`/api/konseling/${tutup.id}`, "PATCH", { aksi: "selesai", catatan, rekamBk }, "Konseling ditandai selesai.")) { setTutup(null); setCatatan(""); }
  }
  async function batalkan(j: Janji) {
    const ok = await confirm(`Batalkan permintaan konseling ${j.siswa}?`);
    if (ok) kirim(`/api/konseling/${j.id}`, "PATCH", { aksi: "batal" }, "Permintaan dibatalkan.");
  }

  const peran = data?.peran;
  const daftar = (data?.daftar ?? []).filter(j => saring === "SEMUA" || (saring === "AKTIF" ? ["MENUNGGU", "DIJADWALKAN"].includes(j.status) : j.status === saring));
  const judul = peran === "SISWA" ? "Konseling dengan Guru BK" : peran === "ORTU" ? "Janji Temu dengan Sekolah" : peran === "WALI" ? "Rujukan & Janji Temu" : "Janji Konseling";
  const keterangan = peran === "SISWA" ? "Ajukan waktu bicara dengan Guru BK — isi permintaan hanya dibaca Guru BK"
    : peran === "ORTU" ? "Ajukan waktu bertemu wali kelas atau Guru BK untuk membicarakan perkembangan anak"
    : peran === "WALI" ? "Rujuk siswa kelas wali Anda ke Guru BK, dan tanggapi permintaan janji temu orang tua"
    : "Permintaan siswa & rujukan wali kelas: tetapkan jadwal, lalu catat hasilnya";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<HeartHandshake size={22} />} title={judul} description={keterangan} />
      {galat ? <EmptyState icon={HeartHandshake} title="Tidak tersedia" description={galat} /> : !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="baris-alat mb-5">
            <div className="alat-tab flex gap-1 bg-gray-100 rounded-xl p-1">
              {[["AKTIF", "Berjalan"], ["SELESAI", "Selesai"], ["SEMUA", "Semua"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setSaring(k)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${saring === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
              ))}
            </div>
            {peran !== "BK" && (
              <div className="alat-aksi">
                <button type="button" onClick={() => setAjukan(true)} className="btn-modal-save"><Plus /> {peran === "SISWA" ? "Minta Konseling" : peran === "ORTU" ? "Ajukan Janji Temu" : "Rujuk Siswa"}</button>
              </div>
            )}
          </div>
          {daftar.length === 0 ? (
            <EmptyState icon={HeartHandshake} title="Belum ada permintaan"
              description={peran === "SISWA" ? "Butuh teman bicara? Tekan Minta Konseling — Guru BK akan menetapkan waktunya." : "Permintaan yang masuk akan tampil di sini."} />
          ) : (
            <div className="panel overflow-hidden">
              <ul className="divide-y divide-gray-50">
                {daftar.map(j => {
                  const st = STATUS[j.status] ?? STATUS.MENUNGGU;
                  return (
                    <li key={j.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {peran !== "SISWA" && <p className="font-semibold text-primary-900">{j.siswa} <span className="text-xs font-normal text-gray-500">· {j.kelas}</span></p>}
                        <span className="status-badge bg-primary-50 text-primary-700 border-primary-100">{TOPIK[j.topik] ?? j.topik}</span>
                        <span className={`status-badge ${st.kelas}`}>{st.label}</span>
                        <span className="ml-auto text-xs text-gray-500">{SUMBER[j.sumber] ?? j.sumber}{j.sumber !== "SISWA" ? ` · ${j.pengajuNama}` : ""} · {new Date(j.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{j.pesan}</p>
                      {j.waktuUsul && j.status === "MENUNGGU" && <p className="mt-1 text-xs text-gray-500">Waktu yang diusulkan: {j.waktuUsul}</p>}
                      {j.jadwal && j.status !== "DIBATALKAN" && (
                        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-blue-800">
                          <CalendarClock size={15} className="shrink-0" /> {fmtJadwal(j.jadwal)} WIB · {j.tempat}{j.konselorNama ? ` · ${j.konselorNama}` : ""}
                        </p>
                      )}
                      {peran === "BK" && j.catatanKonselor && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 whitespace-pre-line"><span className="font-semibold">Catatan rahasia:</span> {j.catatanKonselor}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {peran === "BK" && ["MENUNGGU", "DIJADWALKAN"].includes(j.status) && (
                          <>
                            <button type="button" className="btn-modal-cancel px-3 text-xs" onClick={() => {
                              const d = j.jadwal ? new Date(new Date(j.jadwal).getTime() + 7 * 3600_000).toISOString() : "";
                              setJf({ tanggal: d ? d.slice(0, 10) : hariIniWib(), jam: d ? d.slice(11, 16) : "09:00", tempat: j.tempat ?? "Ruang BK" });
                              setJadwalkan(j);
                            }}><CalendarClock /> {j.status === "DIJADWALKAN" ? "Ubah Jadwal" : "Tetapkan Jadwal"}</button>
                            <button type="button" className="btn-modal-save px-3 text-xs" onClick={() => { setCatatan(""); setRekamBk(true); setTutup(j); }}><CheckCircle2 /> Selesai</button>
                          </>
                        )}
                        {((peran === "BK" && ["MENUNGGU", "DIJADWALKAN"].includes(j.status)) || (peran !== "BK" && j.status === "MENUNGGU")) && (
                          <button type="button" className="btn-modal-cancel px-3 text-xs" onClick={() => batalkan(j)} disabled={sibuk}><X /> Batalkan</button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      <Modal open={ajukan} onClose={() => !sibuk && setAjukan(false)} title={peran === "SISWA" ? "Minta konseling" : peran === "ORTU" ? "Ajukan janji temu" : "Rujuk siswa ke Guru BK"} size="lg"
        footer={<>
          <button type="button" onClick={() => setAjukan(false)} disabled={sibuk} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={simpanAjuan} disabled={sibuk || form.pesan.trim().length < 5 || (peran === "WALI" && !form.studentId) || (peran === "ORTU" && (data?.anak.length ?? 0) > 1 && !form.studentId)} className="btn-modal-save">
            {sibuk ? <Loader2 className="animate-spin" /> : <Send />} Kirim
          </button>
        </>}>
        <div className="space-y-4">
          {peran === "ORTU" && (
            <>
              {(data?.anak.length ?? 0) > 1 && (
                <div><label className="label-field">Anak</label>
                  <Select value={form.studentId} onChange={v => setForm(f => ({ ...f, studentId: v }))} placeholder="Pilih anak"
                    options={(data?.anak ?? []).map(a => ({ value: a.id, label: `${a.nama} — ${a.kelas}` }))} /></div>
              )}
              <div><label className="label-field">Ingin bertemu</label>
                <Select value={form.tujuan} onChange={v => setForm(f => ({ ...f, tujuan: v }))}
                  options={[{ value: "WALI_KELAS", label: "Wali kelas" }, { value: "BK", label: "Guru BK" }]} /></div>
            </>
          )}
          {peran === "WALI" && (
            <div><label className="label-field">Siswa</label>
              <Select value={form.studentId} onChange={v => setForm(f => ({ ...f, studentId: v }))} placeholder="Pilih siswa"
                options={(data?.siswaWali ?? []).map(s => ({ value: s.id, label: `${s.nama} — ${s.kelas}` }))} /></div>
          )}
          <div><label className="label-field">Topik</label>
            <Select value={form.topik} onChange={v => setForm(f => ({ ...f, topik: v }))} placeholder="Pilih topik"
              options={Object.entries(TOPIK).map(([value, label]) => ({ value, label }))} /></div>
          <div>
            <label htmlFor="pesan-konseling" className="label-field">{peran === "SISWA" ? "Apa yang ingin kamu bicarakan?" : peran === "ORTU" ? "Hal yang ingin dibicarakan" : "Alasan rujukan"}</label>
            <textarea id="pesan-konseling" rows={5} maxLength={1500} className="input-field" value={form.pesan}
              onChange={e => setForm(f => ({ ...f, pesan: e.target.value }))}
              placeholder={peran === "SISWA" ? "Ceritakan singkat saja — detailnya bisa dibicarakan langsung." : peran === "ORTU" ? "mis. perkembangan belajar, kendala di rumah, rencana setelah lulus" : "Perubahan perilaku, nilai, kehadiran, atau hal lain yang Anda amati"} />
          </div>
          <div>
            <label htmlFor="waktu-usul" className="label-field">Waktu yang cocok (opsional)</label>
            <input id="waktu-usul" className="input-field" maxLength={100} value={form.waktuUsul}
              onChange={e => setForm(f => ({ ...f, waktuUsul: e.target.value }))} placeholder="mis. Selasa saat istirahat kedua" />
          </div>
        </div>
      </Modal>

      <Modal open={!!jadwalkan} onClose={() => !sibuk && setJadwalkan(null)} title="Tetapkan jadwal konseling" description={jadwalkan ? `${jadwalkan.siswa} · ${jadwalkan.kelas}` : undefined}
        footer={<>
          <button type="button" onClick={() => setJadwalkan(null)} disabled={sibuk} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={simpanJadwal} disabled={sibuk || !jf.tanggal} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Send />} Kirim Jadwal</button>
        </>}>
        <div className="space-y-4">
          {jadwalkan?.waktuUsul && <p className="text-sm text-gray-600">Usulan waktu: <span className="font-medium">{jadwalkan.waktuUsul}</span></p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label-field">Tanggal</label><DatePicker value={jf.tanggal} onChange={v => setJf(f => ({ ...f, tanggal: v }))} /></div>
            <div><label htmlFor="jam-konseling" className="label-field">Jam (WIB)</label><TimePicker value={jf.jam} onChange={v => setJf(f => ({ ...f, jam: v }))} id="jam-konseling" /></div>
          </div>
          <div><label htmlFor="tempat-konseling" className="label-field">Tempat</label><input id="tempat-konseling" className="input-field" maxLength={100} value={jf.tempat} onChange={e => setJf(f => ({ ...f, tempat: e.target.value }))} /></div>
          <p className="text-xs text-gray-500">Siswa{jadwalkan?.sumber === "WALI_KELAS" ? " dan wali kelas perujuk" : ""} menerima notifikasi jadwal ini.</p>
        </div>
      </Modal>

      <Modal open={!!tutup} onClose={() => !sibuk && setTutup(null)} title="Konseling selesai" description={tutup ? `${tutup.siswa} · ${tutup.kelas}` : undefined} size="lg"
        footer={<>
          <button type="button" onClick={() => setTutup(null)} disabled={sibuk} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={simpanSelesai} disabled={sibuk} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Simpan</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label htmlFor="catatan-konselor" className="label-field">Catatan konselor (rahasia, hanya terlihat BK)</label>
            <textarea id="catatan-konselor" rows={6} maxLength={5000} className="input-field" value={catatan} onChange={e => setCatatan(e.target.value)}
              placeholder="Pokok masalah, pendekatan yang dipakai, kesepakatan, rencana tindak lanjut" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={rekamBk} onChange={e => setRekamBk(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Salin catatan ke Rekam BK siswa (jenis Konseling)
          </label>
        </div>
      </Modal>
    </div>
  );
}
