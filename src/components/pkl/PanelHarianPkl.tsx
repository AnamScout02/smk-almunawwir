"use client";
import { useCallback, useEffect, useState } from "react";
import { MapPin, LogIn, LogOut, Loader2, FileText, Star, CheckCircle2, Send, Siren, Phone, CalendarDays, IdCard } from "lucide-react";
import FileUpload from "@/components/shared/FileUpload";
import { useToast } from "@/components/shared/ToastProvider";

type Presensi = { tanggal: string; status: string; jamMasuk: string | null; jamPulang: string | null; jarakMeter: number | null; metode: string };
type Data = {
  agenda: { tanggal: string; judul: string; ket: string }[]; guru: { nama: string; telp: string | null } | null;
  pkl: { sedang: boolean; punyaTitik: boolean; status: string } | null;
  hariIni: Presensi | null; rekap: Record<string, number>; riwayat: Presensi[];
  laporan: { url: string | null; status: string | null; catatan: string | null; pada: string | null };
  umpan: { terbuka: boolean; isi: { bintang?: number; aspek?: Record<string, number>; saran?: string; rekomendasi?: boolean } | null; pada: string | null; aspek: { kunci: string; label: string }[] };
};
const WARNA: Record<string, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border-emerald-200", IZIN: "bg-blue-50 text-blue-700 border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border-amber-200", ALPHA: "bg-red-50 text-red-600 border-red-200",
};
const LAPORAN: Record<string, { label: string; kelas: string }> = {
  DIKIRIM: { label: "Menunggu diperiksa", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  REVISI: { label: "Perlu direvisi", kelas: "bg-red-50 text-red-600 border-red-200" },
  DISETUJUI: { label: "Disetujui", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};
const jam = (s: string | null) => (s ? new Date(s).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—");
const tgl = (s: string) => new Date(s).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function Bintang({ nilai, onPilih, label }: { nilai: number; onPilih: (n: number) => void; label: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="min-w-0 text-sm text-gray-700">{label}</span>
      <span className="flex shrink-0 gap-0.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" role="radio" aria-checked={nilai === n} aria-label={`${n} bintang`} onClick={() => onPilih(n)} className="sentuh p-1">
            <Star size={22} className={n <= nilai ? "fill-amber-400 text-amber-400" : "text-gray-300"} />
          </button>
        ))}
      </span>
    </div>
  );
}

/** PANEL HARIAN PKL SISWA (9 Okt 2026): presensi masuk/pulang dengan lokasi HP, laporan akhir, dan umpan balik tentang
 *  tempat PKL. Memuat datanya sendiri (/api/student/pkl/harian) supaya halaman PKL siswa tidak makin gemuk. */
export default function PanelHarianPkl() {
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [sibuk, setSibuk] = useState("");
  const [absen, setAbsen] = useState<"" | "izin" | "sakit">("");
  const [ket, setKet] = useState("");
  const [berkas, setBerkas] = useState("");
  const [bintang, setBintang] = useState(0);
  const [aspek, setAspek] = useState<Record<string, number>>({});
  const [saran, setSaran] = useState("");
  const [rekomendasi, setRekomendasi] = useState(true);
  const [ubahUmpan, setUbahUmpan] = useState(false);
  const [darurat, setDarurat] = useState(false);
  const [terkirim, setTerkirim] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/student/pkl/harian").then(r => r.json()).then((x: Data) => {
      if (!x?.pkl) return;
      setD(x);
      if (x.umpan.isi) { setBintang(x.umpan.isi.bintang ?? 0); setAspek(x.umpan.isi.aspek ?? {}); setSaran(x.umpan.isi.saran ?? ""); setRekomendasi(x.umpan.isi.rekomendasi !== false); }
    }).catch(() => {});
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function kirim(body: Record<string, unknown>, pesan: string) {
    setSibuk(String(body.aksi));
    try {
      const r = await fetch("/api/student/pkl/harian", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error ?? "Gagal menyimpan."); return null; }
      toast.success(pesan); muat(); return j as { jarak?: number | null; diLokasi?: boolean | null };
    } catch { toast.error("Tidak ada sambungan. Coba lagi saat sinyal kembali."); return null; } finally { setSibuk(""); }
  }
  /** Lokasi diambil saat tombol ditekan. Tanpa izin lokasi / lewat alamat HTTP presensi tetap tercatat, bertanda "tanpa lokasi". */
  function denganLokasi(aksi: "masuk" | "pulang") {
    const lanjut = (lok?: { lat: number; lng: number; akurasi: number }) => kirim({ aksi, ...lok }, aksi === "masuk" ? "Presensi masuk tercatat." : "Presensi pulang tercatat.");
    if (aksi === "pulang" || !window.isSecureContext || !navigator.geolocation) { void lanjut(); return; }
    setSibuk(aksi);
    navigator.geolocation.getCurrentPosition(
      p => void lanjut({ lat: p.coords.latitude, lng: p.coords.longitude, akurasi: Math.round(p.coords.accuracy) }),
      () => void lanjut(), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  /** DARURAT: kabari Humas & guru pembimbing seketika (laporan berjenis DARURAT), disertai lokasi HP bila diizinkan. */
  function kabariDarurat() {
    const kirimLaporan = async (lok?: string) => {
      setSibuk("darurat");
      try {
        const r = await fetch("/api/student/pkl/laporan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jenis: "DARURAT", isi: `DARURAT — saya butuh dihubungi segera.${lok ? ` Lokasi saya: ${lok}` : ""}` }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) toast.error(j.error ?? "Gagal mengirim. Telepon guru pembimbing langsung."); else { setTerkirim(true); toast.success("Sekolah sudah dikabari."); }
      } catch { toast.error("Tidak ada sambungan. Telepon guru pembimbing langsung."); } finally { setSibuk(""); }
    };
    if (!window.isSecureContext || !navigator.geolocation) { void kirimLaporan(); return; }
    setSibuk("darurat");
    navigator.geolocation.getCurrentPosition(p => void kirimLaporan(`https://maps.google.com/?q=${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}`), () => void kirimLaporan(), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  }

  if (!d?.pkl) return null;
  const h = d.hariIni, lap = d.laporan, um = d.umpan;
  const tampilLaporan = d.pkl.status !== "CANCELLED" && (d.pkl.sedang || d.pkl.status === "COMPLETED" || !!lap.url);
  return (
    <>
      {d.agenda.length > 0 && (
        <div className="panel mb-6 p-5">
          <h3 className="flex items-center gap-2 font-heading font-semibold text-navy"><CalendarDays size={16} className="text-primary-700" /> Agenda PKL</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {d.agenda.map(a => <li key={a.tanggal + a.judul} className="flex flex-wrap gap-x-3"><span className="angka w-24 shrink-0 font-medium text-primary-900">{new Date(`${a.tanggal}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" })}</span><span className="min-w-0 flex-1 text-gray-700">{a.judul}{a.ket && <span className="block text-xs text-gray-500">{a.ket}</span>}</span></li>)}
          </ul>
        </div>
      )}

      {d.pkl.sedang && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-red-700"><Siren size={18} /> Keadaan darurat di tempat PKL?</p>
            {!darurat && <button type="button" className="btn-hapus" onClick={() => setDarurat(true)}>Darurat</button>}
          </div>
          {darurat && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-red-700">Untuk kecelakaan, sakit mendadak, atau keadaan yang membuatmu tidak aman. Bila nyawa terancam, hubungi 112 lebih dulu.</p>
              <div className="flex flex-wrap gap-2">
                {d.guru?.telp && <a href={`tel:${d.guru.telp.replace(/[^0-9+]/g, "")}`} className="btn-hapus"><Phone size={16} /> Telepon {d.guru.nama}</a>}
                <button type="button" className="btn-modal-cancel" disabled={sibuk === "darurat" || terkirim} onClick={kabariDarurat}>{sibuk === "darurat" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {terkirim ? "Sekolah sudah dikabari" : "Kabari sekolah sekarang"}</button>
                <button type="button" className="btn-modal-cancel" onClick={() => setDarurat(false)}>Tutup</button>
              </div>
              {!d.guru?.telp && <p className="text-xs text-red-700">Nomor guru pembimbing belum tercatat — tekan &ldquo;Kabari sekolah sekarang&rdquo;.</p>}
            </div>
          )}
        </div>
      )}

      {d.pkl.sedang && (
        <div className="panel mb-6 p-5">
          <h3 className="flex items-center gap-2 font-heading font-semibold text-navy"><MapPin size={16} className="text-primary-700" /> Presensi PKL hari ini</h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {h ? <span className={`status-badge ${WARNA[h.status] ?? ""}`}>{h.status}</span> : <span className="text-gray-400">Belum presensi.</span>}
            {h?.status === "HADIR" && <span className="angka text-gray-600">Masuk {jam(h.jamMasuk)} · Pulang {jam(h.jamPulang)}</span>}
            {h?.status === "HADIR" && (h.jarakMeter != null
              ? <span className={h.jarakMeter <= 300 ? "text-emerald-700" : "text-amber-700"}>{h.jarakMeter <= 300 ? "di lokasi PKL" : `${h.jarakMeter >= 1000 ? `${(h.jarakMeter / 1000).toFixed(1)} km` : `${h.jarakMeter} m`} dari tempat PKL`}</span>
              : h.jamMasuk && h.metode === "LOKASI" ? <span className="text-gray-400">tanpa lokasi</span> : null)}
          </div>
          {absen ? (
            <div className="mt-4 space-y-3">
              <div><label className="label-field">Keterangan {absen}</label>
                <textarea className="input-field" rows={2} value={ket} onChange={e => setKet(e.target.value)} placeholder={absen === "sakit" ? "Sakit apa, sudah ke dokter atau belum" : "Keperluan apa, sudah izin ke pembimbing industri atau belum"} /></div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-modal-cancel" onClick={() => setAbsen("")}>Batal</button>
                <button type="button" className="btn-modal-save" disabled={!!sibuk} onClick={async () => { if (await kirim({ aksi: absen, keterangan: ket }, "Tercatat.")) { setAbsen(""); setKet(""); } }}>{sibuk ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Kirim</button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {!h?.jamMasuk && <button type="button" className="btn-modal-save" disabled={!!sibuk} onClick={() => denganLokasi("masuk")}>{sibuk === "masuk" ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />} Presensi Masuk</button>}
              {h?.jamMasuk && !h.jamPulang && <button type="button" className="btn-modal-save" disabled={!!sibuk} onClick={() => denganLokasi("pulang")}>{sibuk === "pulang" ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Presensi Pulang</button>}
              {!h?.jamMasuk && <><button type="button" className="btn-modal-cancel" onClick={() => setAbsen("izin")}>Izin</button><button type="button" className="btn-modal-cancel" onClick={() => setAbsen("sakit")}>Sakit</button></>}
            </div>
          )}
          <p className="mt-3 text-xs text-gray-500">
            30 hari terakhir: <span className="angka">{d.rekap.HADIR ?? 0}</span> hadir · <span className="angka">{d.rekap.IZIN ?? 0}</span> izin · <span className="angka">{d.rekap.SAKIT ?? 0}</span> sakit · <span className="angka">{d.rekap.ALPHA ?? 0}</span> alpha.
            {!d.pkl.punyaTitik && " Titik lokasi tempat PKL belum diisi sekolah, jadi jaraknya belum bisa dihitung."}
          </p>
          {d.riwayat.length > 1 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {d.riwayat.slice(0, 7).map(x => <li key={x.tanggal} className={`status-badge ${WARNA[x.status] ?? ""}`} title={`${jam(x.jamMasuk)}–${jam(x.jamPulang)}`}>{tgl(x.tanggal)}</li>)}
            </ul>
          )}
        </div>
      )}

      {tampilLaporan && (
        <div className="mb-6 flex justify-end"><a href="/dashboard/student/pkl/portofolio" className="btn-modal-cancel"><IdCard size={16} /> Portofolio PKL</a></div>
      )}

      {tampilLaporan && (
        <div className="panel mb-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-heading font-semibold text-navy"><FileText size={16} className="text-primary-700" /> Laporan akhir PKL</h3>
            {lap.status && <span className={`status-badge ${LAPORAN[lap.status]?.kelas ?? ""}`}>{LAPORAN[lap.status]?.label ?? lap.status}</span>}
          </div>
          {lap.url && <p className="mt-2 text-sm"><a href={lap.url} target="_blank" rel="noreferrer" className="font-medium text-primary-700 hover:underline">Lihat berkas yang dikirim</a></p>}
          {lap.status === "REVISI" && lap.catatan && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><span className="font-semibold">Catatan revisi:</span> {lap.catatan}</p>}
          {lap.status !== "DISETUJUI" && (
            <div className="mt-3 space-y-3">
              <FileUpload value={berkas} onChange={setBerkas} folder="pkl-jurnal" label={lap.url ? "Berkas pengganti (PDF)" : "Berkas laporan (PDF)"} accept="application/pdf" />
              <div className="flex justify-end"><button type="button" className="btn-modal-save" disabled={!berkas || !!sibuk} onClick={async () => { if (await kirim({ aksi: "laporan", url: berkas }, "Laporan akhir terkirim.")) setBerkas(""); }}>{sibuk === "laporan" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Kirim Laporan Akhir</button></div>
            </div>
          )}
        </div>
      )}

      {um.terbuka && (
        <div className="panel mb-6 p-5">
          <h3 className="flex items-center gap-2 font-heading font-semibold text-navy"><Star size={16} className="text-amber-500" /> Bagaimana tempat PKL-mu?</h3>
          {um.isi && !ubahUmpan ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 size={16} /> Terima kasih, penilaianmu sudah tersimpan ({um.isi.bintang} dari 5 bintang).</span>
              <button type="button" className="btn-modal-cancel px-3 text-xs" onClick={() => setUbahUmpan(true)}>Ubah</button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-gray-500">Dibaca panitia PKL untuk menilai tempat ini bagi adik kelasmu. Tidak diperlihatkan ke tempat PKL.</p>
              <Bintang label="Secara keseluruhan" nilai={bintang} onPilih={setBintang} />
              {um.aspek.map(a => <Bintang key={a.kunci} label={a.label} nilai={aspek[a.kunci] ?? 0} onPilih={n => setAspek(s => ({ ...s, [a.kunci]: n }))} />)}
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={rekomendasi} onChange={e => setRekomendasi(e.target.checked)} /> Saya menyarankan tempat ini untuk adik kelas</label>
              <textarea className="input-field" rows={2} value={saran} onChange={e => setSaran(e.target.value)} placeholder="Cerita singkat atau saran (boleh kosong)" />
              <div className="flex justify-end"><button type="button" className="btn-modal-save" disabled={!!sibuk} onClick={async () => { if (await kirim({ aksi: "umpan", bintang, aspek, saran, rekomendasi }, "Penilaian tersimpan.")) setUbahUmpan(false); }}>{sibuk === "umpan" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Simpan Penilaian</button></div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
