"use client";
import { useCallback, useEffect, useState } from "react";
import { EyeOff, Loader2, MessageSquareHeart, Plus, Reply, Send } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";

interface Aspirasi { id: string; kategori: string; isi: string; status: string; tanggapan: string | null; createdAt: string; pengirim: string }

const KATEGORI: Record<string, string> = { SARANA: "Sarana & prasarana", PEMBELAJARAN: "Pembelajaran", KEGIATAN: "Kegiatan & ekstrakurikuler", PERUNDUNGAN: "Perundungan", LAINNYA: "Lainnya" };
const STATUS: Record<string, { label: string; kelas: string }> = {
  BARU: { label: "Baru", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  DIBACA: { label: "Dibaca", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  DITINDAKLANJUTI: { label: "Ditindaklanjuti", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

/** KOTAK ASPIRASI SISWA (17 Sep 2026). Siswa mengirim (boleh anonim — tanpa kaitan akun sama sekali);
 * Guru BK, Wakasek Kesiswaan & Admin membaca, menandai, dan menanggapi. */
export default function AspirasiManager() {
  const toast = useToast();
  const [peran, setPeran] = useState<"BK" | "SISWA" | null>(null);
  const [daftar, setDaftar] = useState<Aspirasi[]>([]);
  const [galat, setGalat] = useState("");
  const [saring, setSaring] = useState("");
  const [tulis, setTulis] = useState(false);
  const [form, setForm] = useState({ kategori: "", isi: "", anonim: true });
  const [balas, setBalas] = useState<Aspirasi | null>(null);
  const [tanggapan, setTanggapan] = useState("");
  const [statusBaru, setStatusBaru] = useState("DITINDAKLANJUTI");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/aspirasi", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else { setPeran(d.peran); setDaftar(d.daftar); }
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function kirim(url: string, method: string, body: unknown, ok: string) {
    setSibuk(true);
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return false; }
    if (ok) toast.success(ok);
    muat();
    return true;
  }

  async function kirimAspirasi() {
    const ok = await kirim("/api/aspirasi", "POST", form, form.anonim ? "Aspirasi terkirim tanpa nama. Terima kasih!" : "Aspirasi terkirim. Terima kasih!");
    if (ok) { setTulis(false); setForm({ kategori: "", isi: "", anonim: true }); }
  }
  async function simpanTanggapan() {
    if (!balas) return;
    if (await kirim(`/api/aspirasi/${balas.id}`, "PATCH", { status: statusBaru, tanggapan }, "Tanggapan tersimpan.")) setBalas(null);
  }
  function bukaBalas(a: Aspirasi) {
    setTanggapan(a.tanggapan ?? ""); setStatusBaru(a.status === "BARU" ? "DITINDAKLANJUTI" : a.status); setBalas(a);
    if (a.status === "BARU") kirim(`/api/aspirasi/${a.id}`, "PATCH", { status: "DIBACA" }, "");
  }

  const tersaring = daftar.filter(a => !saring || a.status === saring || a.kategori === saring);
  const hal = usePaginasi(tersaring, 24, saring);
  const baru = daftar.filter(a => a.status === "BARU").length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<MessageSquareHeart size={22} />} title="Kotak Aspirasi"
        description={peran === "SISWA" ? "Sampaikan saran atau keluhan untuk sekolah — boleh tanpa nama" : `Saran & keluhan siswa${baru ? ` — ${baru} belum dibaca` : ""}`} />
      {galat ? <EmptyState icon={MessageSquareHeart} title="Tidak tersedia" description={galat} /> : !peran ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="baris-alat mb-5">
            {peran === "BK" && (
              <div className="alat-saring">
                <Select value={saring} onChange={setSaring} placeholder="Semua aspirasi" options={[
                  { value: "", label: "Semua aspirasi" },
                  ...Object.entries(STATUS).map(([value, s]) => ({ value, label: `Status: ${s.label}` })),
                  ...Object.entries(KATEGORI).map(([value, label]) => ({ value, label: `Kategori: ${label}` })),
                ]} />
              </div>
            )}
            {peran === "SISWA" && (
              <div className="alat-aksi"><button type="button" onClick={() => setTulis(true)} className="btn-modal-save btn-teks"><Plus /> Tulis Aspirasi</button></div>
            )}
          </div>
          {peran === "SISWA" && (
            <p className="mb-4 flex items-start gap-2 text-xs text-gray-500"><EyeOff size={14} className="mt-0.5 shrink-0" />
              Aspirasi tanpa nama tidak tersimpan di akunmu sehingga tidak tampil di daftar ini dan tidak bisa dilacak siapa pun — termasuk tanggapannya.</p>
          )}
          {tersaring.length === 0 ? (
            <EmptyState icon={MessageSquareHeart} title="Belum ada aspirasi"
              description={peran === "SISWA" ? "Aspirasi yang kamu kirim dengan nama akan tampil di sini beserta tanggapannya." : "Aspirasi siswa akan tampil di sini."} />
          ) : (
            <div className="panel overflow-hidden">
              <ul className="divide-y divide-gray-50">
                {hal.potongan.map(a => {
                  const st = STATUS[a.status] ?? STATUS.BARU;
                  return (
                    <li key={a.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {peran === "BK" && <p className={`font-semibold ${a.pengirim === "Anonim" ? "text-gray-500 italic" : "text-primary-900"}`}>{a.pengirim}</p>}
                        <span className="status-badge bg-primary-50 text-primary-700 border-primary-100">{KATEGORI[a.kategori] ?? a.kategori}</span>
                        <span className={`status-badge ${st.kelas}`}>{st.label}</span>
                        <span className="ml-auto text-xs text-gray-500">{new Date(a.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{a.isi}</p>
                      {a.tanggapan && <p className="mt-2 rounded-lg bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900 whitespace-pre-line"><span className="font-semibold">Tanggapan sekolah:</span> {a.tanggapan}</p>}
                      {peran === "BK" && (
                        <div className="mt-3"><button type="button" className="btn-modal-cancel px-3 text-xs" onClick={() => bukaBalas(a)}><Reply /> {a.tanggapan ? "Ubah Tanggapan" : "Tanggapi"}</button></div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Paginasi hal={hal} satuan="aspirasi" className="border-t border-gray-100" />
            </div>
          )}
        </>
      )}

      <Modal open={tulis} onClose={() => !sibuk && setTulis(false)} title="Tulis aspirasi" size="lg"
        footer={<>
          <button type="button" onClick={() => setTulis(false)} disabled={sibuk} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={kirimAspirasi} disabled={sibuk || form.isi.trim().length < 10} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Send />} Kirim</button>
        </>}>
        <div className="space-y-4">
          <div><label className="label-field">Kategori</label>
            <Select value={form.kategori} onChange={v => setForm(f => ({ ...f, kategori: v }))} placeholder="Pilih kategori"
              options={Object.entries(KATEGORI).map(([value, label]) => ({ value, label }))} /></div>
          <div>
            <label htmlFor="isi-aspirasi" className="label-field">Isi aspirasi</label>
            <textarea id="isi-aspirasi" rows={6} maxLength={2000} className="input-field" value={form.isi} onChange={e => setForm(f => ({ ...f, isi: e.target.value }))}
              placeholder="Tulis dengan jelas: apa yang terjadi atau apa yang kamu usulkan" />
            <p className="mt-1 text-xs text-gray-400">{form.isi.length}/2000</p>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.anonim} onChange={e => setForm(f => ({ ...f, anonim: e.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
            <span>Kirim tanpa nama<span className="block text-xs text-gray-500">Hilangkan centang bila kamu ingin dihubungi atau melihat tanggapan di halaman ini.</span></span>
          </label>
          {form.kategori === "PERUNDUNGAN" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Bila kamu atau temanmu dalam bahaya, segera temui Guru BK atau wali kelas — kamu juga bisa memakai menu Konseling.</p>
          )}
        </div>
      </Modal>

      <Modal open={!!balas} onClose={() => !sibuk && setBalas(null)} title="Tanggapi aspirasi" description={balas ? `${balas.pengirim} · ${KATEGORI[balas.kategori] ?? balas.kategori}` : undefined} size="lg"
        footer={<>
          <button type="button" onClick={() => setBalas(null)} disabled={sibuk} className="btn-modal-cancel">Tutup</button>
          <button type="button" onClick={simpanTanggapan} disabled={sibuk} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Send />} Simpan</button>
        </>}>
        <div className="space-y-4">
          {balas && <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 whitespace-pre-line">{balas.isi}</p>}
          <div><label className="label-field">Status</label>
            <Select value={statusBaru} onChange={setStatusBaru} options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} /></div>
          <div>
            <label htmlFor="tanggapan-aspirasi" className="label-field">Tanggapan {balas?.pengirim === "Anonim" ? "(catatan internal — pengirim anonim tidak bisa melihatnya)" : "(terlihat oleh siswa pengirim)"}</label>
            <textarea id="tanggapan-aspirasi" rows={5} maxLength={2000} className="input-field" value={tanggapan} onChange={e => setTanggapan(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
