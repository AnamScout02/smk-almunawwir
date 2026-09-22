"use client";
import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarX2, Clock, Copy, Eye, Loader2, Save, Send, Smartphone, Users, UserX, X, AlertTriangle, Inbox } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { kirimUjiPush } from "@/lib/push-client";
import Select from "@/components/admin/Select";
import { salinTeks } from "@/lib/salin-teks";

interface BelumAktif {
  kelompok: { kunci: string; label: string; total: number; belum: number; daftar: { nama: string; keterangan: string }[] }[];
  jumlah: { siswa: { total: number; belum: number }; orangTua: { total: number; belum: number } };
}

interface Data {
  tersedia: boolean;
  pengaturan: { aktif: boolean; jamAbsensi: string; jamPiket: string; jamJurnal: string; jamPeringatanDini: string; jamPerpustakaan: string; jamRekapKelas: string; jamRingkasanOrtu: string; tanggalLibur: string[]; liburNasional: boolean };
  libur: { mendatang: { tanggal: string; nama: string; sumber: keyof typeof SUMBER_LIBUR }[]; nasional: { jumlah: number; diperbarui: string | null } };
  perangkat: { total: number; pengguna: number; perPeran: { peran: string; perangkat: number; pengguna: number }[] };
  riwayat: { id: string; jenis: string; judul: string; isi: string; jumlahPenerima: number; jumlahPerangkat: number; createdAt: string }[];
}

const LABEL_JENIS: Record<string, [string, string]> = {
  ABSENSI_BELUM: ["Absensi belum diisi", "bg-amber-50 text-amber-700 border-amber-200"],
  PIKET_BELUM: ["Buku piket", "bg-amber-50 text-amber-700 border-amber-200"],
  JURNAL_BELUM: ["Jurnal belum diisi", "bg-amber-50 text-amber-700 border-amber-200"],
  UJIAN_MULAI: ["Ujian dimulai", "bg-blue-50 text-blue-700 border-blue-200"],
  TUGAS_BARU: ["Tugas baru", "bg-blue-50 text-blue-700 border-blue-200"],
  ANAK_ALPHA: ["Anak alpha", "bg-red-50 text-red-600 border-red-200"],
  POIN_PELANGGARAN: ["Poin pelanggaran", "bg-red-50 text-red-600 border-red-200"],
  POIN_PRESTASI: ["Poin prestasi", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  ALPHA_BERUNTUN: ["Alpha beruntun", "bg-red-50 text-red-600 border-red-200"],
  PERINGATAN_DINI: ["Peringatan dini", "bg-purple-50 text-purple-700 border-purple-200"],
  PERPUS_JATUH_TEMPO: ["Perpustakaan: jatuh tempo", "bg-amber-50 text-amber-700 border-amber-200"],
  PERPUS_TERLAMBAT: ["Perpustakaan: terlambat", "bg-red-50 text-red-600 border-red-200"],
  PERPUS_RESERVASI: ["Perpustakaan: pesanan siap", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  IZIN_SISWA: ["Izin/sakit siswa", "bg-blue-50 text-blue-700 border-blue-200"],
  REKAP_HARIAN_KELAS: ["Rekap harian kelas", "bg-blue-50 text-blue-700 border-blue-200"],
  PENGUMUMAN: ["Pengumuman", "bg-amber-50 text-amber-700 border-amber-200"],
  KONSELING: ["Konseling BK", "bg-purple-50 text-purple-700 border-purple-200"],
  SARPRAS: ["Sarpras & Lab", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  UKS: ["UKS", "bg-red-50 text-red-600 border-red-200"],
  UJI: ["Uji", "bg-gray-50 text-gray-600 border-gray-200"],
};

const fmtWaktu = (d: string) => new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const SUMBER_LIBUR = {
  KALENDER: { label: "Kalender Pendidikan", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  NASIONAL: { label: "Nasional", kelas: "bg-red-50 text-red-600 border-red-200" },
  MANUAL: { label: "Tambahan", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  MINGGU: { label: "Minggu", kelas: "bg-gray-50 text-gray-600 border-gray-200" },
} as const;

const fmtTanggal = (t: string) => new Date(`${t}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function NotifikasiPushManager() {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<Data["pengaturan"] | null>(null);
  const [tanggalBaru, setTanggalBaru] = useState("");
  const [simpan, setSimpan] = useState(false);
  const [uji, setUji] = useState(false);
  const [pratinjauTanggal, setPratinjauTanggal] = useState(() => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10));
  const [pratinjauJam, setPratinjauJam] = useState("07:35");
  const [pratinjau, setPratinjau] = useState<{ hasil: { jenis: string; judul: string; isi: string; penerima: number }[]; totalPenerima: number } | null>(null);
  const [memuatPratinjau, setMemuatPratinjau] = useState(false);
  const [belum, setBelum] = useState<BelumAktif | null>(null);
  const [kelompokBelum, setKelompokBelum] = useState("wali");
  useEffect(() => {
    fetch("/api/admin/notifikasi/belum-aktif").then(r => (r.ok ? r.json() : null)).then(d => d && setBelum(d)).catch(() => {});
  }, []);

  const muat = useCallback(() => {
    fetch("/api/admin/notifikasi").then(r => (r.ok ? r.json() : null))
      .then((d: Data | null) => { if (d) { setData(d); setForm(f => f ?? d.pengaturan); } })
      .catch(() => {});
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function simpanPengaturan() {
    if (!form) return;
    setSimpan(true);
    const r = await fetch("/api/admin/notifikasi", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSimpan(false);
    if (!r?.ok) return toast.error(d?.error ?? "Gagal menyimpan pengaturan.");
    toast.success("Pengaturan notifikasi disimpan.");
    setForm(null); muat();
  }

  async function kirimUji() {
    setUji(true);
    const r = await kirimUjiPush();
    setUji(false);
    if (r.ok) toast.success(r.pesan); else toast.error(r.pesan);
    muat();
  }

  async function lihatPratinjau() {
    if (!/^\d{1,2}[:.]\d{2}$/.test(pratinjauJam.trim())) return toast.error("Isi jam dengan format JJ:MM, mis. 07:35.");
    const [h, m] = pratinjauJam.trim().split(/[:.]/);
    setMemuatPratinjau(true);
    const r = await fetch(`/api/admin/notifikasi/pratinjau?waktu=${pratinjauTanggal}T${h.padStart(2, "0")}:${m}`).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMemuatPratinjau(false);
    if (!r?.ok) return toast.error(d?.error ?? "Pratinjau gagal dimuat.");
    setPratinjau(d);
  }

  function tambahLibur(t: string) {
    setTanggalBaru("");
    if (!t || !form || form.tanggalLibur.includes(t)) return;
    setForm({ ...form, tanggalLibur: [...form.tanggalLibur, t].sort() });
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<BellRing size={22} />} title="Notifikasi Push"
        description="Pengingat & kabar penting yang muncul di HP/laptop warga sekolah walau aplikasi sedang ditutup" />

      {!data || !form ? (
        <div className="flex items-center justify-center min-h-[40vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <div className="space-y-5">
          {!data.tersedia && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-700"><p className="font-semibold text-red-800">Kunci VAPID belum terpasang di server</p>Notifikasi tidak bisa dikirim sampai VAPID_PUBLIC_KEY & VAPID_PRIVATE_KEY diisi.</div>
            </div>
          )}

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatTile value={data.perangkat.total} label="Perangkat Aktif" icon={Smartphone} color="primary" size="md" />
            <StatTile value={data.perangkat.pengguna} label="Pengguna Berlangganan" icon={Users} color="emerald" size="md" />
            {data.perangkat.perPeran.filter(p => ["Guru", "Siswa"].includes(p.peran)).map(p => (
              <StatTile key={p.peran} value={p.pengguna} label={`${p.peran} berlangganan`} icon={Users} color={p.peran === "Guru" ? "blue" : "purple"} size="md" />
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Per peran: {data.perangkat.perPeran.map(p => `${p.peran} ${p.pengguna} orang / ${p.perangkat} perangkat`).join(" · ")}.
            Setiap orang mengaktifkan sendiri dari halaman Profil (menu Akun → Notifikasi di HP).
          </p>

          <div className="grid gap-5 lg:grid-cols-5">
            <div className="page-card lg:col-span-3">
              <div className="page-card-header">
                <div className="flex items-center gap-2"><Clock size={16} className="text-primary-700" /><h3 className="font-heading font-semibold text-primary-900">Pengingat Terjadwal</h3></div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.aktif} onChange={e => setForm({ ...form, aktif: e.target.checked })} className="w-4 h-4 accent-primary-700" />
                  Aktif
                </label>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-gray-500">Jam WIB, pisahkan dengan koma. Tiap jam dicek selama satu jam; setiap penerima hanya diingatkan sekali per jam. Hari Minggu & tanggal libur dilewati.</p>
                {([
                  ["jamAbsensi", "Absensi kelas belum diisi", "Ketua kelas, sekretaris & wali kelas dari kelas yang punya jadwal hari itu"],
                  ["jamPiket", "Buku piket belum lengkap", "Petugas piket hari itu, bila kehadiran guru di jam yang sudah berjalan belum diisi"],
                  ["jamJurnal", "Jurnal mengajar belum diisi", "Guru yang mengajar hari itu tetapi belum mengisi jurnal kelasnya"],
                  ["jamPeringatanDini", "Ringkasan peringatan dini (khusus Senin)", "Wali kelas: siswa kelasnya berisiko tinggi/sedang · Guru BK & Wakasek Kesiswaan: rekap sekolah"],
                  ["jamPerpustakaan", "Pengingat perpustakaan", "Peminjam yang batas kembalinya besok, dan yang terlambat 1, 3, atau 7 hari"],
                  ["jamRekapKelas", "Rekap harian kelas", "Ke wali kelas: jumlah hadir/izin/sakit/alpha hari ini, nama siswa alpha, dan izin orang tua yang menunggu"],
                  ["jamRingkasanOrtu", "Ringkasan mingguan orang tua", "Tiap Sabtu ke orang tua: kehadiran anak pekan ini, nilai baru, dan poin"],
                ] as const).map(([kunci, judul, ket]) => (
                  <div key={kunci}>
                    <label className="label-field" htmlFor={`jam-${kunci}`}>{judul}</label>
                    <input id={`jam-${kunci}`} className="input-field font-mono" value={form[kunci]} placeholder="07:30,09:30"
                      onChange={e => setForm({ ...form, [kunci]: e.target.value })} />
                    <p className="text-xs text-gray-400 mt-1">{ket}</p>
                  </div>
                ))}
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-500 leading-relaxed">
                  Dikirim otomatis tanpa jadwal: <strong>ujian dimulai</strong> (siswa kelas peserta), <strong>tugas baru</strong> (siswa kelas),
                  <strong> anak ditandai ALPHA</strong> dan <strong>poin pelanggaran/prestasi</strong> (orang tua), <strong>alpha 3 hari berturut-turut</strong> (wali kelas & BK).
                </div>
              </div>
            </div>

            <div className="page-card lg:col-span-2">
              <div className="page-card-header">
                <div className="flex items-center gap-2"><CalendarX2 size={16} className="text-primary-700" /><h3 className="font-heading font-semibold text-primary-900">Hari Libur</h3></div>
                <span className="text-xs text-gray-400">{data.libur.mendatang.length} libur · 4 bulan ke depan</span>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-gray-500">
                  Pengingat absensi, piket & jurnal, pita Tugas Hari Ini, dan absen mandiri QR otomatis libur pada <strong>hari Minggu</strong>,
                  agenda <strong>Libur</strong> di Kalender Pendidikan, dan <strong>tanggal merah nasional</strong> — tidak perlu diisi satu per satu.
                </p>
                <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.liburNasional} onChange={e => setForm({ ...form, liburNasional: e.target.checked })} className="w-4 h-4 mt-0.5 accent-primary-700" />
                  <span>
                    Ikuti tanggal merah nasional
                    <span className="block text-xs text-gray-400">
                      {data.libur.nasional.jumlah
                        ? `${data.libur.nasional.jumlah} tanggal tersimpan · diperbarui otomatis tiap minggu${data.libur.nasional.diperbarui ? ` (terakhir ${fmtTanggal(data.libur.nasional.diperbarui.slice(0, 10))})` : ""}`
                        : "Belum ada salinan — diambil otomatis begitu server bisa mengakses kalender libur nasional."}
                    </span>
                  </span>
                </label>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Libur mendatang</p>
                  {data.libur.mendatang.length === 0 ? (
                    <p className="text-xs text-gray-400">Tidak ada libur selain hari Minggu dalam 4 bulan ke depan.</p>
                  ) : (
                    <ul className="divide-y divide-gray-50 rounded-xl border border-gray-100 max-h-64 overflow-y-auto">
                      {data.libur.mendatang.map(l => (
                        <li key={l.tanggal} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                          <span className="w-36 shrink-0 text-gray-600 tabular-nums">{fmtTanggal(l.tanggal)}</span>
                          <span className="flex-1 min-w-0 truncate text-gray-800" title={l.nama}>{l.nama}</span>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full border text-xs font-semibold ${SUMBER_LIBUR[l.sumber].kelas}`}>{SUMBER_LIBUR[l.sumber].label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Libur tambahan (di luar kalender)</p>
                  <DatePicker value={tanggalBaru} onChange={tambahLibur} />
                  <div className="flex flex-wrap gap-2">
                    {form.tanggalLibur.length === 0 && <span className="text-xs text-gray-400">Belum ada libur tambahan.</span>}
                    {form.tanggalLibur.map(t => (
                      <span key={t} className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full border border-gray-200 bg-white text-xs text-gray-700">
                        {fmtTanggal(t)}
                        <button type="button" title="Hapus" onClick={() => setForm({ ...form, tanggalLibur: form.tanggalLibur.filter(x => x !== t) })}
                          className="p-0.5 text-gray-400 hover:text-red-600 rounded-full"><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="alat-aksi alat-teks justify-end">
            <button type="button" onClick={kirimUji} disabled={uji} className="btn-modal-cancel">
              {uji ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Kirim uji ke perangkat saya
            </button>
            <button type="button" onClick={simpanPengaturan} disabled={simpan} className="btn-modal-save">
              {simpan ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Pengaturan
            </button>
          </div>

          {belum && (() => {
            const g = belum.kelompok.find(k => k.kunci === kelompokBelum) ?? belum.kelompok[0];
            const salin = async () => {
              const teks = `Mohon aktifkan notifikasi aplikasi sekolah (buka aplikasi → ketuk Aktifkan Notifikasi di bagian atas dashboard):\n${g.daftar.map((o, i) => `${i + 1}. ${o.nama} — ${o.keterangan}`).join("\n")}`;
              if (await salinTeks(teks)) toast.success("Daftar disalin — tempel di grup WA."); else toast.error("Tidak bisa menyalin otomatis.");
            };
            return (
              <div className="page-card">
                <div className="page-card-header">
                  <div className="flex items-center gap-2"><UserX size={16} className="text-primary-700" /><h3 className="font-heading font-semibold text-primary-900">Belum Mengaktifkan Notifikasi</h3></div>
                  <span className="text-xs text-gray-400">Siswa {belum.jumlah.siswa.belum}/{belum.jumlah.siswa.total} · Orang tua {belum.jumlah.orangTua.belum}/{belum.jumlah.orangTua.total} belum</span>
                </div>
                <div className="p-5 space-y-3">
                  <p className="text-sm text-gray-500">Mereka tetap menerima pengingat di kotak notifikasi & pita dashboard saat membuka aplikasi, tetapi tidak muncul di HP saat aplikasi ditutup. Salin daftarnya untuk diingatkan lewat grup WA.</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-72 max-w-full"><Select value={g.kunci} onChange={setKelompokBelum} options={belum.kelompok.map(k => ({ value: k.kunci, label: `${k.label} (${k.belum} dari ${k.total} belum)` }))} /></div>
                    <button type="button" onClick={salin} disabled={!g.daftar.length} className="btn-modal-cancel"><Copy size={15} /> Salin daftar</button>
                  </div>
                  {g.daftar.length === 0 ? (
                    <p className="text-sm text-emerald-700">Semua {g.label.toLowerCase()} sudah mengaktifkan notifikasi.</p>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto scrollbar-visible divide-y divide-gray-50 rounded-xl border border-gray-100">
                      {g.daftar.map((o, i) => <li key={`${o.nama}-${i}`} className="px-3 py-2 flex justify-between gap-3 text-sm"><span className="font-medium text-gray-800">{o.nama}</span><span className="text-xs text-gray-500 text-right">{o.keterangan}</span></li>)}
                    </ul>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="page-card">
            <div className="page-card-header">
              <div className="flex items-center gap-2"><Eye size={16} className="text-primary-700" /><h3 className="font-heading font-semibold text-primary-900">Pratinjau Pengingat</h3></div>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-500">Lihat pengingat yang <strong>akan</strong> terkirim pada tanggal &amp; jam tertentu berdasarkan data saat ini — tidak ada yang benar-benar dikirim. Pakai jam yang berada dalam satu jam setelah jam pengingat (mis. 07:35 untuk pengingat 07:30).</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-52"><label className="label-field">Tanggal</label><DatePicker value={pratinjauTanggal} onChange={setPratinjauTanggal} /></div>
                <div className="w-28"><label className="label-field" htmlFor="jam-pratinjau">Jam (WIB)</label><input id="jam-pratinjau" className="input-field font-mono" value={pratinjauJam} onChange={e => setPratinjauJam(e.target.value)} /></div>
                <button type="button" onClick={lihatPratinjau} disabled={memuatPratinjau} className="btn-modal-save">
                  {memuatPratinjau ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} Pratinjau
                </button>
              </div>
              {pratinjau && (pratinjau.hasil.length === 0 ? (
                <p className="text-sm text-gray-500 rounded-xl bg-gray-50 border border-gray-100 p-3">Tidak ada pengingat yang akan terkirim pada waktu itu (semua sudah diisi, di luar jam pengingat, atau hari libur).</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">{pratinjau.hasil.length} pengingat · {pratinjau.totalPenerima} penerima</p>
                  <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 max-h-80 overflow-y-auto scrollbar-visible">
                    {pratinjau.hasil.map((h, i) => {
                      const [label, gaya] = LABEL_JENIS[h.jenis] ?? [h.jenis, "bg-gray-50 text-gray-600 border-gray-200"];
                      return (
                        <li key={i} className="p-3 flex items-start gap-3">
                          <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${gaya}`}>{label}</span>
                          <span className="flex-1 min-w-0"><span className="font-medium text-gray-800 text-sm">{h.judul}</span><span className="block text-xs text-gray-500">{h.isi}</span></span>
                          <span className="text-xs text-gray-400 whitespace-nowrap">{h.penerima} penerima</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="page-card overflow-hidden">
            <div className="page-card-header">
              <h3 className="font-heading font-semibold text-primary-900">Kiriman Terbaru</h3>
              <span className="text-xs text-gray-400">60 terakhir</span>
            </div>
            {data.riwayat.length === 0 ? (
              <EmptyState icon={Inbox} title="Belum ada notifikasi terkirim" description="Kiriman akan muncul di sini begitu ada pengingat atau kejadian." />
            ) : (
              <div className="overflow-x-auto scrollbar-visible">
                <table className="data-table">
                  <thead><tr><th>Waktu</th><th>Jenis</th><th>Isi</th><th className="text-center">Penerima</th><th className="text-center">Perangkat</th></tr></thead>
                  <tbody>
                    {data.riwayat.map(r => {
                      const [label, gaya] = LABEL_JENIS[r.jenis] ?? [r.jenis, "bg-gray-50 text-gray-600 border-gray-200"];
                      return (
                        <tr key={r.id}>
                          <td className="whitespace-nowrap text-xs text-gray-500">{fmtWaktu(r.createdAt)}</td>
                          <td><span className={`px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${gaya}`}>{label}</span></td>
                          <td><span className="font-medium text-gray-800">{r.judul}</span><span className="block text-xs text-gray-500">{r.isi}</span></td>
                          <td className="text-center">{r.jumlahPenerima}</td>
                          <td className={`text-center font-semibold ${r.jumlahPerangkat ? "text-emerald-700" : "text-gray-300"}`}>{r.jumlahPerangkat}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
