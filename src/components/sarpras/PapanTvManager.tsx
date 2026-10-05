"use client";
import { useCallback, useEffect, useState } from "react";
import { salinTeks } from "@/lib/salin-teks";
import { Tv, Loader2, Plus, RefreshCw, Wifi, WifiOff, TriangleAlert, Pencil, Trash2, Search, MonitorPlay, Copy, Power, Sun, Home, Megaphone, Send, Save, BellOff } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import TimePicker from "@/components/shared/TimePicker";
import DatePicker from "@/components/shared/DatePicker";
import DindingLayar from "@/components/sarpras/DindingLayar";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Baris {
  id: string; nama: string; ruang: string; mac: string; aktif: boolean;
  ip: string | null; jaringan: string | null; status: "ONLINE" | "OFFLINE" | "BELUM_LOGIN";
  terlihatDetikLalu: number | null; macAcak: boolean; catatan: string | null;
  diamDetik: number | null; trafikMb: number | null; nyalaDetik: number | null; jadwalMati: string | null; jadwalNyala: string | null;
  token: string | null; kelasId: string | null; papanJudul: string | null; papanIsi: string | null; papanOtomatis: boolean; papanQr: string; papanJenis: string; papanGiliran: number; volumeBel: number | null; ipTetap: string | null;
  perangkatModel: string | null; aplikasiDepan: string | null;
  /** Mode Bel yang berlaku sekarang (NORMAL | HENING | UJIAN) dan batasnya (ISO, null = sampai diubah). */
  belMode: string; belModeSampai: string | null;
  /** Dibaca lewat ADB: MENYALA / TIDUR (layar padam, sistem hidup — bisa dinyalakan dari sini) / null. */
  layar?: "MENYALA" | "TIDUR" | null;
}

/** MODE BEL per TV (4 Okt 2026) — untuk ruang yang dipakai ANBK/TKA. Lihat src/lib/bel-profil.ts. */
const MODE_BEL = [
  { value: "NORMAL", label: "Normal — ikut bel sekolah" },
  { value: "HENING", label: "Hening — bel diam, pengumuman tampil tanpa suara" },
  { value: "UJIAN", label: "Ikut Bel Ujian — jadwal bel ujian di TV ini" },
];
const BATAS_MODE = [
  { value: "UBAH", label: "Sampai diubah lagi" },
  { value: "HARI_INI", label: "Sampai akhir hari ini" },
  { value: "TANGGAL", label: "Sampai tanggal & jam tertentu" },
];
/** Tanggal/jam WIB → ISO. Formulir selalu berbicara dalam WIB, apa pun zona waktu komputer petugas. */
const isoWib = (tgl: string, jam: string) => new Date(`${tgl}T${jam || "23:59"}:00+07:00`).toISOString();
const hariIniWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
interface Kandidat {
  mac: string; ip: string; namaHost: string | null; jaringan: string | null;
  sistem: string | null; macAcak: boolean; mungkinTv: boolean; barusanMuncul: boolean;
}
interface Data { baris: Baris[]; routerOk: boolean; kandidat: Kandidat[]; ruang: string[]; kelas: { id: string; name: string }[]; bolehKelola: boolean }

const GAYA = {
  ONLINE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  BELUM_LOGIN: "bg-amber-50 text-amber-700 border-amber-200",
  OFFLINE: "bg-gray-50 text-gray-500 border-gray-200",
};
const LABEL = { ONLINE: "Hidup", BELUM_LOGIN: "Belum login hotspot", OFFLINE: "Mati / tak terlihat" };

/** TV menyala tapi tidak ada lalu lintas = besar kemungkinan tidak ditonton. Ambang 2 menit dipilih longgar
 * karena Android TV tetap mengirim lalu lintas latar (pembaruan, jam) walau layarnya cuma menampilkan menu. */
const aktivitas = (b: Baris) => {
  if (b.status === "OFFLINE" || b.diamDetik === null) return null;
  if (b.diamDetik < 120) return { teks: "sedang dipakai", kelas: "text-emerald-700" };
  const m = Math.round(b.diamDetik / 60);
  return { teks: m < 60 ? `diam ${m} mnt` : `diam ${Math.round(m / 60)} jam`, kelas: "text-gray-500" };
};

const lalu = (d: number | null) => {
  if (d === null) return "—";
  if (d < 60) return `${d} dtk lalu`;
  if (d < 3600) return `${Math.round(d / 60)} mnt lalu`;
  return `${Math.round(d / 3600)} jam lalu`;
};

/** PAPAN & TV — pemantauan layar sekolah untuk Sarpras (24 September 2026).
 *
 * Statusnya dibaca dari MikroTik, jadi TV TIDAK perlu dipasangi aplikasi apa pun untuk bisa dipantau
 * hidup/matinya. Jumlah TV & ruang berubah-ubah, karena itu tidak ada daftar tetap: perangkat yang
 * terlihat router muncul sebagai kandidat, tinggal diberi nama & ruang. */
const LABEL_CARA: Record<string, string> = {
  TEKS_SUARA: "Teks + suara", TEKS: "Teks saja", SUARA: "Suara saja",
};

export default function PapanTvManager({ tanpaKerangka }: { tanpaKerangka?: boolean } = {}) {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [form, setForm] = useState<{ id?: string; nama: string; ruang: string; mac: string; catatan: string; jadwalMati: string; jadwalNyala: string; kelasId: string; papanJudul: string; papanIsi: string; papanOtomatis: boolean; papanQr: string; papanJenis: string; papanGiliran: number; volumeBel: string; ipTetap: string } | null>(null);
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [umum, setUmum] = useState<{ judul: string; isi: string; cara: string } | null>(null);
  const [modeBel, setModeBel] = useState<{ mode: string; batas: string; tanggal: string; jam: string } | null>(null);
  const [kelolaTemplat, setKelolaTemplat] = useState(false);
  const [suntingTemplat, setSuntingTemplat] = useState<{ id?: string; judul: string; isi: string; cara: string } | null>(null);
  const toast = useToast();
  /* Template pengumuman: dimuat sekali saat halaman dibuka. Bukan tiap modal dibuka — daftarnya pendek dan
     jarang berubah, sedangkan modal pengumuman justru dibuka saat sedang terburu-buru. */
  const [templat, setTemplat] = useState<{ id: string; judul: string; isi: string | null; cara: string }[]>([]);
  const confirm = useConfirm();

  const muat = useCallback((diam = false) => {
    if (!diam) setData(d => d);
    return fetch("/api/sarpras/layar", { cache: "no-store" })
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok || !d) setGalat(d?.error || "Gagal memuat"); else { setData(d); setGalat(""); } })
      .catch(() => setGalat("Gagal memuat"));
  }, []);

  useEffect(() => { muat().finally(() => setData(d => d ?? { baris: [], routerOk: false, kandidat: [], ruang: [], kelas: [], bolehKelola: false })); }, [muat]);
  useEffect(() => {
    fetch("/api/sarpras/template-pengumuman")
      .then(r => (r.ok ? r.json() : null))
      .then(d => setTemplat(Array.isArray(d?.daftar) ? d.daftar : []))
      .catch(() => {});
  }, []);

  // Status perangkat berubah pelan; 30 detik sudah terasa langsung tanpa membebani router.
  useEffect(() => { const t = setInterval(() => muat(true), 30_000); return () => clearInterval(t); }, [muat]);

  const simpan = async () => {
    if (!form) return;
    setSibuk(true);
    try {
      const r = await fetch("/api/sarpras/layar", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { toast.error(d?.error || "Gagal menyimpan"); return; }
      if (d?.macAcak) toast.warning("Tersimpan, tapi MAC itu MAC acak WiFi — matikan MAC acak di TV lalu perbarui MAC-nya, kalau tidak pemantauan berhenti sendiri saat MAC berubah.");
      else toast.success("Tersimpan");
      setForm(null); await muat(true);
    } finally { setSibuk(false); }
  };

  const muatTemplat = () => fetch("/api/sarpras/template-pengumuman")
    .then(r => (r.ok ? r.json() : null))
    .then(d => setTemplat(Array.isArray(d?.daftar) ? d.daftar : []))
    .catch(() => {});

  const simpanTemplat = async () => {
    if (!suntingTemplat?.judul.trim()) return;
    setSibuk(true);
    try {
      const r = await fetch("/api/sarpras/template-pengumuman", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...suntingTemplat, urutan: templat.length + 1 }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { toast.error(d?.error || "Gagal menyimpan"); return; }
      toast.success("Template tersimpan"); setSuntingTemplat(null); await muatTemplat();
    } finally { setSibuk(false); }
  };

  const hapusTemplat = async (t: { id: string; judul: string }) => {
    if (!await confirm(`Hapus template "${t.judul}"? Pengumuman yang sudah tayang tidak terpengaruh.`)) return;
    const r = await fetch(`/api/sarpras/template-pengumuman?id=${t.id}`, { method: "DELETE" });
    if (!r.ok) { toast.error("Gagal menghapus"); return; }
    toast.success("Template dihapus"); await muatTemplat();
  };

  /** Perintah untuk semua layar terpilih sekaligus — sekolah punya belasan TV, satu per satu tidak masuk akal. */
  const massal = async (isi: { tombol?: "daya" | "bangunkan" | "beranda"; aksi?: "buka-papan" }, judul: string) => {
    const ids = [...pilih];
    if (!ids.length) return;
    if (isi.tombol === "daya" && !await confirm(`Matikan ${ids.length} TV terpilih? Layarnya padam, dan bisa dinyalakan lagi dari sini dengan tombol Nyalakan.`)) return;
    setSibuk(true);
    try {
      const r = await fetch("/api/sarpras/layar/massal", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, ...isi }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { toast.error(d?.error || "Perintah gagal"); return; }
      const gagal = (d.hasil ?? []).filter((h: { ok: boolean }) => !h.ok);
      if (gagal.length === 0) toast.success(`${judul}: ${d.berhasil} TV berhasil`);
      else toast.warning(`${judul}: ${d.berhasil} berhasil, ${gagal.length} gagal — ${gagal.slice(0, 2).map((g: { nama: string; pesan: string }) => `${g.nama} (${g.pesan})`).join("; ")}`);
      await muat(true);
    } finally { setSibuk(false); }
  };

  const simpanModeBel = async () => {
    if (!modeBel) return;
    const ids = [...pilih];
    if (!ids.length) return;
    const sampai = modeBel.mode === "NORMAL" || modeBel.batas === "UBAH" ? null
      : modeBel.batas === "HARI_INI" ? isoWib(hariIniWib(), "23:59")
      : modeBel.tanggal ? isoWib(modeBel.tanggal, modeBel.jam) : null;
    if (modeBel.mode !== "NORMAL" && modeBel.batas === "TANGGAL" && !modeBel.tanggal) { toast.warning("Pilih tanggal berakhirnya."); return; }
    setSibuk(true);
    try {
      const r = await fetch("/api/sarpras/layar/massal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, belMode: { mode: modeBel.mode, sampai } }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { toast.error(d?.error || "Gagal menyimpan mode bel"); return; }
      toast.success(`Mode bel ${ids.length} TV disimpan`);
      setModeBel(null);
      await muat(true);
    } finally { setSibuk(false); }
  };

  /** Pengumuman untuk semua TV terpilih sekaligus — termasuk dibacakan TV, karena papan membunyikan nada
   * perhatian lalu membaca teksnya. Mengosongkan = mencabut pengumuman serentak. */
  const kirimPengumuman = async (isiPengumuman: { judul: string; isi: string; cara: string } | null) => {
    const ids = [...pilih];
    if (!ids.length) return;
    setSibuk(true);
    try {
      const r = await fetch("/api/sarpras/layar/massal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, pengumuman: isiPengumuman }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { toast.error(d?.error || "Gagal mengirim"); return; }
      toast.success(isiPengumuman ? `Pengumuman tayang di ${ids.length} TV` : `Pengumuman dicabut dari ${ids.length} TV`);
      setUmum(null);
      await muat(true);
      // Papan menyegarkan diri tiap 10 menit; dorong sekarang supaya pengumuman langsung tampil & dibacakan.
      await fetch("/api/sarpras/layar/massal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, aksi: "buka-papan" }),
      }).catch(() => null);
    } finally { setSibuk(false); }
  };

  const tautanPapan = (t: string) => `${location.origin}/layar/${t}`;

  const buatTautan = async (b: Baris) => {
    const r = await fetch("/api/sarpras/layar", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id, buatToken: true }),
    });
    if (!r.ok) { toast.error("Gagal membuat tautan"); return; }
    toast.success("Tautan papan dibuat"); await muat(true);
  };

  // Jaringan sekolah dibuka lewat HTTP, jadi Clipboard API sering tidak tersedia — salinTeks menyediakan
  // cadangannya dan mengembalikan hasil yang sebenarnya (CLAUDE.md #28).
  const salin = async (teks: string) => {
    if (await salinTeks(teks)) toast.success("Tautan disalin");
    else toast.error("Gagal menyalin — salin manual dari kotak tautan");
  };

  const hapus = async (b: Baris) => {
    if (!await confirm(`Hapus layar "${b.nama}"? Riwayatnya ikut hilang. Kalau TV-nya cuma dilepas sementara, lebih baik tandai tidak aktif lewat tombol ubah.`)) return;
    const r = await fetch(`/api/sarpras/layar?id=${encodeURIComponent(b.id)}`, { method: "DELETE" });
    if (r.ok) { toast.success("Layar dihapus"); muat(true); } else toast.error("Gagal menghapus");
  };

  if (!data && !galat) return <div className={`${tanpaKerangka ? "" : "p-6 lg:p-8"} flex items-center justify-center min-h-[60vh] text-gray-400`}><Loader2 size={24} className="animate-spin" /></div>;
  if (!data) return <div className={`${tanpaKerangka ? "" : "p-6 lg:p-8"} text-center text-gray-400 py-20`}>{galat}</div>;

  const q = cari.trim().toLowerCase();
  const tersaring = data.baris.filter(b => !q || [b.nama, b.ruang, b.mac, b.ip].some(v => (v ?? "").toLowerCase().includes(q)));
  const hidup = data.baris.filter(b => b.aktif && b.status === "ONLINE").length;
  const mati = data.baris.filter(b => b.aktif && b.status === "OFFLINE").length;
  const perhatian = data.baris.filter(b => b.aktif && (b.status === "BELUM_LOGIN" || b.macAcak)).length;

  return (
    <div className={tanpaKerangka ? "" : "p-6 lg:p-8 pt-16 lg:pt-8"}>
      {!tanpaKerangka && (
      <PageHeader icon={<Tv size={22} />} title="Papan & TV"
        description="Pemantauan TV sekolah — hidup/mati, jaringan, dan perangkat yang perlu ditata" />
      )}

      {!data.routerOk && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-2">
          <TriangleAlert size={18} className="shrink-0 text-amber-600" />
          <span>Router tidak bisa dihubungi, jadi status hidup/mati belum bisa dibaca. Daftar layarnya tetap tampil.</span>
        </div>
      )}

      {mati > 0 && (
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          <strong className="text-blue-800">{mati} TV tidak terlihat.</strong> Setelah listrik padam, TV TCL masuk siaga dingin (WiFi mati)
          sehingga tidak bisa dinyalakan dari sini — nyalakan SEKALI dengan remote, sesudah itu bisa dikendalikan dari sini lagi.
          Supaya menyala sendiri saat listrik kembali, atur menu Hotel TV → Mode Nyala ke &quot;Langsung menyala&quot;; TV yang menyala di
          luar jam papan akan ditidurkan otomatis.
        </div>
      )}

      <div className="kisi-kartu kisi-kartu-4 mb-5">
        <StatTile ikon="perisai" color="primary" value={data.baris.filter(b => b.aktif).length} label="TV terdaftar" />
        <StatTile ikon="hadir" color="emerald" value={hidup} label="Sedang hidup" />
        <StatTile ikon="alpha" color={mati ? "red" : "gray"} value={mati} label="Mati / tak terlihat" />
        <StatTile ikon="peringatan" color={perhatian ? "amber" : "gray"} value={perhatian} label="Perlu ditata" sorot={perhatian > 0} />
      </div>

      <div className="baris-alat mb-5">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, ruang, MAC, atau IP..." className="input-field pl-10" />
        </div>
        <div className="alat-aksi">
          <button type="button" onClick={() => muat(true)} className="btn-modal-cancel"><RefreshCw /> Muat ulang</button>
          {data.bolehKelola && (
            <button type="button" onClick={() => setForm({ nama: "", ruang: "", mac: "", catatan: "", jadwalMati: "", jadwalNyala: "", kelasId: "", papanJudul: "", papanIsi: "", papanOtomatis: true, papanQr: "MATI", papanJenis: "UMUM", papanGiliran: 60, volumeBel: "", ipTetap: "" })} className="btn-modal-save"><Plus /> Tambah TV</button>
          )}
        </div>
      </div>

      {/* Dinding layar: hanya TV yang sedang hidup — TV mati tidak bisa difoto layarnya, dan menampilkan
          kotak gagal berderet cuma bikin bingung petugas. */}
      <DindingLayar bolehKelola={data.bolehKelola}
        layar={data.baris.filter(b => b.aktif && b.status !== "OFFLINE").map(b => ({ id: b.id, nama: b.nama, ruang: b.ruang, status: b.status, ip: b.ip }))} />

      {data.bolehKelola && pilih.size > 0 && (
        <div className="baris-alat mb-5 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3">
          <span className="text-sm font-semibold text-primary-900">{pilih.size} TV terpilih</span>
          <div className="alat-aksi">
            <button type="button" disabled={sibuk} onClick={() => massal({ tombol: "bangunkan" }, "Nyalakan")} className="btn-modal-cancel btn-teks"><Sun /> Nyalakan</button>
            <button type="button" disabled={sibuk} onClick={() => massal({ tombol: "beranda" }, "Ke beranda")} className="btn-modal-cancel btn-teks"><Home /> Beranda</button>
            <button type="button" disabled={sibuk} onClick={() => massal({ aksi: "buka-papan" }, "Buka papan")} className="btn-modal-save btn-teks"><MonitorPlay /> Buka Papan Sekolah</button>
            <button type="button" disabled={sibuk} onClick={() => setUmum({ judul: "", isi: "", cara: "TEKS_SUARA" })} className="btn-modal-cancel btn-teks"><Megaphone /> Pengumuman</button>
            <button type="button" disabled={sibuk} onClick={() => kirimPengumuman(null)} className="btn-modal-cancel btn-teks">Cabut pengumuman</button>
            <button type="button" disabled={sibuk} onClick={() => setModeBel({ mode: "HENING", batas: "HARI_INI", tanggal: hariIniWib(), jam: "15:00" })} className="btn-modal-cancel btn-teks"><BellOff /> Mode Bel</button>
            <button type="button" disabled={sibuk} onClick={() => massal({ tombol: "daya" }, "Matikan")} className="btn-hapus btn-teks"><Power /> Matikan</button>
          </div>
        </div>
      )}

      <div className="panel overflow-hidden mb-6">
        {tersaring.length === 0 ? (
          <EmptyState icon={Tv} title="Belum ada TV terdaftar"
            description="Nyalakan TV-nya, lalu daftarkan dari daftar perangkat terdeteksi di bawah — atau isi MAC-nya manual lewat tombol Tambah TV." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>
                {data.bolehKelola && (
                  <th className="w-10">
                    <input type="checkbox" aria-label="Pilih semua"
                      checked={tersaring.length > 0 && tersaring.every(b => pilih.has(b.id))}
                      onChange={e => setPilih(e.target.checked ? new Set(tersaring.map(b => b.id)) : new Set())}
                      className="h-4 w-4 rounded border-gray-300" />
                  </th>
                )}
                <th>Nama</th><th>Ruang</th><th>Status</th><th>Aktivitas</th><th>Data terpakai</th><th>IP</th><th>Nyala sejak</th><th></th></tr></thead>
              <tbody>
                {tersaring.map(b => (
                  <tr key={b.id} className={b.aktif ? "" : "opacity-50"}>
                    {data.bolehKelola && (
                      <td>
                        <input type="checkbox" aria-label={`Pilih ${b.nama}`} checked={pilih.has(b.id)}
                          onChange={e => setPilih(p => { const n = new Set(p); if (e.target.checked) n.add(b.id); else n.delete(b.id); return n; })}
                          className="h-4 w-4 rounded border-gray-300" />
                      </td>
                    )}
                    <td className="font-medium text-primary-900 whitespace-nowrap">
                      {b.nama}
                      {b.macAcak && <span className="ml-2 status-badge bg-amber-50 text-amber-700 border-amber-200" title="MAC ini MAC acak WiFi — bisa berubah sendiri dan membuat pemantauan berhenti">MAC acak</span>}
                      {b.belMode !== "NORMAL" && (
                        <span className={`ml-2 status-badge ${b.belMode === "HENING" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}
                          title={b.belModeSampai ? `Sampai ${new Date(b.belModeSampai).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })}` : "Sampai diubah lagi"}>
                          {b.belMode === "HENING" ? "Bel hening" : "Bel ujian"}
                        </span>
                      )}
                      <span className="block font-mono text-xs font-normal text-gray-400">{b.mac}</span>
                    </td>
                    <td className="text-sm text-gray-600">{b.ruang}</td>
                    <td>
                      {b.status !== "OFFLINE" && b.layar === "TIDUR" ? (
                        <span className="status-badge bg-gray-50 text-gray-600 border-gray-200" title="Layar padam, sistem TV tetap hidup — bisa dinyalakan dengan tombol Nyalakan">
                          <Wifi size={12} /> Siaga · layar mati
                        </span>
                      ) : (
                        <span className={`status-badge ${GAYA[b.status]}`}
                          title={b.status === "OFFLINE" ? "Tidak terlihat router. Setelah listrik padam, TV masuk siaga dingin (WiFi mati) — nyalakan SEKALI dengan remote, sesudah itu bisa dikendalikan dari sini lagi." : undefined}>
                          {b.status === "ONLINE" ? <Wifi size={12} /> : <WifiOff size={12} />} {LABEL[b.status]}</span>
                      )}
                    </td>
                    <td className="text-xs">{(() => { const a = aktivitas(b); return a ? <span className={`font-semibold ${a.kelas}`}>{a.teks}</span> : <span className="text-gray-400">—</span>; })()}</td>
                    <td className="text-xs tabular-nums text-gray-600">{b.trafikMb === null ? "—" : `${b.trafikMb} MB`}</td>
                    <td className="font-mono text-xs">{b.ip ?? "—"}<span className="block text-gray-400">{b.jaringan ?? ""}</span></td>
                    <td className="text-xs text-gray-500">{b.nyalaDetik === null ? lalu(b.terlihatDetikLalu) : lalu(b.nyalaDetik).replace(" lalu", "")}</td>
                    <td className="text-right whitespace-nowrap">
                      {data.bolehKelola && <>
                        {b.token
                          ? <button onClick={() => salin(tautanPapan(b.token!))} title="Salin tautan papan informasi" className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Copy size={14} /></button>
                          : <button onClick={() => buatTautan(b)} title="Buat tautan papan informasi" className="p-1.5 text-gray-400 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><MonitorPlay size={14} /></button>}
                        <button onClick={() => setForm({ id: b.id, nama: b.nama, ruang: b.ruang, mac: b.mac, catatan: b.catatan ?? "", jadwalMati: b.jadwalMati ?? "", jadwalNyala: b.jadwalNyala ?? "", kelasId: b.kelasId ?? "", papanJudul: b.papanJudul ?? "", papanIsi: b.papanIsi ?? "", papanOtomatis: b.papanOtomatis, papanQr: b.papanQr ?? "MATI", papanJenis: b.papanJenis ?? "UMUM", papanGiliran: b.papanGiliran ?? 60, volumeBel: b.volumeBel == null ? "" : String(b.volumeBel), ipTetap: b.ipTetap ?? "" })} title="Ubah" className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                        <button onClick={() => hapus(b)} title="Hapus" className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data.bolehKelola && data.kandidat.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="border-b border-gray-100 bg-white px-5 py-3">
            <h3 className="font-heading font-semibold text-primary-900 text-sm">Perangkat terdeteksi router, belum terdaftar</h3>
            <p className="text-xs text-gray-500 mt-0.5">Yang bertanda <b>mungkin TV</b> bersistem Android tapi tidak mengirim nama perangkat — ciri khas Android TV (HP hampir selalu mengirim namanya).</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>MAC</th><th>IP</th><th>Nama perangkat</th><th>Sistem</th><th>Jaringan</th><th></th></tr></thead>
              <tbody>
                {data.kandidat.slice(0, 40).map(k => (
                  <tr key={k.mac}>
                    <td className="font-mono text-xs">{k.mac}{k.macAcak && <span className="ml-2 text-amber-600">acak</span>}</td>
                    <td className="font-mono text-xs">{k.ip}</td>
                    <td className="text-sm">{k.namaHost ?? <span className="text-gray-400">tanpa nama</span>}</td>
                    <td className="text-xs text-gray-500">{k.sistem ?? "—"}</td>
                    <td className="text-xs text-gray-500">{k.jaringan ?? "—"}</td>
                    <td className="text-right whitespace-nowrap">
                      {k.mungkinTv && <span className="status-badge bg-primary-50 text-primary-700 border-primary-100 mr-2">mungkin TV</span>}
                      {k.barusanMuncul && <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200 mr-2">baru aktif</span>}
                      <button onClick={() => setForm({ nama: "", ruang: "", mac: k.mac, catatan: "", jadwalMati: "", jadwalNyala: "", kelasId: "", papanJudul: "", papanIsi: "", papanOtomatis: true, papanQr: "MATI", papanJenis: "UMUM", papanGiliran: 60, volumeBel: "", ipTetap: "" })} className="btn-modal-cancel px-3 text-xs">Daftarkan</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!modeBel} onClose={() => setModeBel(null)} title={`Mode bel ${pilih.size} TV terpilih`} size="md"
        footer={<>
          <button type="button" onClick={() => setModeBel(null)} className="btn-modal-cancel flex-1">Batal</button>
          <button type="button" disabled={sibuk} onClick={simpanModeBel} className="btn-modal-save flex-1">
            {sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan
          </button>
        </>}>
        {modeBel && (
          <div className="space-y-4">
            <div>
              <label className="label-field">Mode bel</label>
              <Select value={modeBel.mode} onChange={v => setModeBel({ ...modeBel, mode: v })} options={MODE_BEL} />
              <p className="mt-1.5 text-xs text-gray-500">
                {modeBel.mode === "HENING"
                  ? "Untuk ruang ANBK/TKA: bel tidak berbunyi dan volume TV tidak disentuh. Pengumuman tetap tampil di layar (mis. token) tanpa nada maupun suara."
                  : modeBel.mode === "UJIAN"
                    ? "TV ini memakai jadwal Bel Ujian (menu Bel Sekolah) walaupun ruang lain memakai bel biasa. Mulai terpakai paling lambat 10 menit setelah disimpan, saat papan memuat ulang."
                    : "Kembali mengikuti bel sekolah: Bel Reguler, atau Bel Ujian pada tanggal Kegiatan Ujian."}
              </p>
            </div>
            {modeBel.mode !== "NORMAL" && (
              <div>
                <label className="label-field">Berlaku</label>
                <Select value={modeBel.batas} onChange={v => setModeBel({ ...modeBel, batas: v })} options={BATAS_MODE} />
                {modeBel.batas === "TANGGAL" && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><label className="label-field">Tanggal</label><DatePicker value={modeBel.tanggal} onChange={v => setModeBel({ ...modeBel, tanggal: v })} /></div>
                    <div><label className="label-field">Jam</label><TimePicker value={modeBel.jam} onChange={v => setModeBel({ ...modeBel, jam: v })} /></div>
                  </div>
                )}
                <p className="mt-1.5 text-xs text-gray-500">Setelah batasnya lewat, TV otomatis kembali ke mode Normal — tidak perlu ada yang mengembalikan.</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!umum} onClose={() => setUmum(null)} title={`Pengumuman ke ${pilih.size} TV terpilih`} size="md"
        footer={<>
          <button type="button" onClick={() => setUmum(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk || !(umum?.judul.trim() || umum?.isi.trim())}
            onClick={() => umum && kirimPengumuman(umum)} className="btn-modal-save">
            {sibuk ? <Loader2 className="animate-spin" /> : <Send />} Tayangkan
          </button>
        </>}>
        {umum && (
          <div className="space-y-4">
            {templat.length > 0 && (
              <div>
                <label className="label-field">Pakai template</label>
                <Select value="" onChange={v => {
                  const t = templat.find(x => x.id === v);
                  if (t) setUmum({ judul: t.judul, isi: t.isi ?? "", cara: t.cara });
                }} placeholder="— pilih template (boleh disunting setelahnya) —"
                  options={templat.map(t => ({ value: t.id, label: t.judul }))} />
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                  <span>Tanda kurung siku seperti <b>[nama]</b> atau <b>[jam]</b> diganti sendiri — papan tidak menebaknya.</span>
                  <button type="button" onClick={() => setKelolaTemplat(true)} className="font-semibold text-primary-700 hover:underline">Kelola template</button>
                </p>
              </div>
            )}
            <div>
              <label className="label-field">Judul pengumuman</label>
              <input value={umum.judul} onChange={e => setUmum({ ...umum, judul: e.target.value })} autoFocus
                placeholder="mis. Ananda Rizky XI TKJ 1 dimohon ke ruang TU" className="input-field" />
            </div>
            <div>
              <label className="label-field">Keterangan (opsional)</label>
              <textarea value={umum.isi} onChange={e => setUmum({ ...umum, isi: e.target.value })} rows={3} className="input-field" />
            </div>
            <div>
              <label className="label-field">Cara penyampaian</label>
              <Select value={umum.cara} onChange={v => setUmum({ ...umum, cara: v })} options={[
                { value: "TEKS_SUARA", label: "Teks + suara — memenuhi layar lalu dibacakan" },
                { value: "TEKS", label: "Teks saja — tampil di layar, tidak dibacakan" },
                { value: "SUARA", label: "Suara saja — dibacakan, papan tetap tampil biasa" },
              ]} />
            </div>
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              {umum.cara === "SUARA"
                ? <>Pengumuman <b>hanya dibacakan sekali</b>; papan tetap menampilkan panel biasa. Cocok untuk panggilan singkat yang tidak perlu menutup layar.</>
                : umum.cara === "TEKS"
                  ? <>Pengumuman <b>memenuhi layar</b> TV terpilih tanpa dibacakan. Tekan &quot;Cabut pengumuman&quot; untuk mengembalikannya.</>
                  : <>Pengumuman akan <b>memenuhi layar</b>, <b>dibunyikan nada perhatian</b>, lalu <b>dibacakan</b> bila TV punya mesin suara. Tekan &quot;Cabut pengumuman&quot; untuk mengembalikannya.</>}
            </p>
          </div>
        )}
      </Modal>

      {/* KELOLA TEMPLATE — supaya kalimat yang sering dipakai bisa diubah petugas sendiri, tanpa lewat basis data. */}
      <Modal open={kelolaTemplat} onClose={() => setKelolaTemplat(false)} title="Template pengumuman" size="lg" scrollBody
        footer={<>
          <button type="button" onClick={() => setKelolaTemplat(false)} className="btn-modal-cancel">Tutup</button>
          <button type="button" onClick={() => setSuntingTemplat({ judul: "", isi: "", cara: "TEKS_SUARA" })} className="btn-modal-save"><Plus /> Template baru</button>
        </>}>
        {templat.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">Belum ada template.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Judul</th><th>Cara</th><th></th></tr></thead>
              <tbody>
                {templat.map(t => (
                  <tr key={t.id}>
                    <td>
                      <p className="font-medium text-primary-900">{t.judul}</p>
                      {t.isi && <p className="mt-0.5 text-xs text-gray-500">{t.isi}</p>}
                    </td>
                    <td><span className="status-badge bg-gray-50 text-gray-600 border-gray-200">{LABEL_CARA[t.cara] ?? t.cara}</span></td>
                    <td className="text-right whitespace-nowrap">
                      <button onClick={() => setSuntingTemplat({ id: t.id, judul: t.judul, isi: t.isi ?? "", cara: t.cara })}
                        title="Ubah" className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => hapusTemplat({ id: t.id, judul: t.judul })}
                        title="Hapus" className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal open={!!suntingTemplat} onClose={() => setSuntingTemplat(null)}
        title={suntingTemplat?.id ? "Ubah template" : "Template baru"} size="md"
        footer={<>
          <button type="button" onClick={() => setSuntingTemplat(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk || !suntingTemplat?.judul.trim()} onClick={simpanTemplat} className="btn-modal-save">
            {sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan
          </button>
        </>}>
        {suntingTemplat && (
          <div className="space-y-4">
            <div>
              <label className="label-field">Judul</label>
              <input value={suntingTemplat.judul} autoFocus
                onChange={e => setSuntingTemplat({ ...suntingTemplat, judul: e.target.value })}
                placeholder="mis. Panggilan ke Ruang BK" className="input-field" />
            </div>
            <div>
              <label className="label-field">Keterangan (opsional)</label>
              <textarea value={suntingTemplat.isi} rows={3}
                onChange={e => setSuntingTemplat({ ...suntingTemplat, isi: e.target.value })}
                placeholder="Ananda [nama] kelas [kelas] dimohon segera menuju Ruang BK." className="input-field" />
              <p className="mt-1 text-xs text-gray-500">Pakai <b>[nama]</b>, <b>[kelas]</b>, <b>[jam]</b> sebagai isian yang diketik petugas saat mengirim.</p>
            </div>
            <div>
              <label className="label-field">Cara bawaan</label>
              <Select value={suntingTemplat.cara} onChange={v => setSuntingTemplat({ ...suntingTemplat, cara: v })} options={[
                { value: "TEKS_SUARA", label: "Teks + suara" },
                { value: "TEKS", label: "Teks saja" },
                { value: "SUARA", label: "Suara saja" },
              ]} />
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ubah layar" : "Daftarkan TV"} size="md" scrollBody
        footer={<>
          <button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk} onClick={simpan} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Plus />} Simpan</button>
        </>}>
        {form && (
          <div className="space-y-4">
            <div>
              <label className="label-field">Nama layar</label>
              <input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="TV Lab TKJ" className="input-field" />
            </div>
            <div>
              <label className="label-field">Ruang</label>
              {data.ruang.length > 0
                ? <Select value={form.ruang} onChange={v => setForm({ ...form, ruang: v })} options={data.ruang.map(r => ({ value: r, label: r }))} placeholder="Pilih ruang..." />
                : <input value={form.ruang} onChange={e => setForm({ ...form, ruang: e.target.value })} placeholder="Lab TKJ" className="input-field" />}
              <p className="mt-1 text-xs text-gray-500">
                Ruang diambil dari <a href="/dashboard/admin/daftar-ruang" className="font-semibold text-primary-700 hover:underline">Daftar Ruang</a> —
                satu-satunya tempat menambah ruangan, dipakai juga oleh pemesanan ruang dan ruang ujian.
              </p>
            </div>
            <div>
              <label className="label-field">MAC perangkat</label>
              <input value={form.mac} onChange={e => setForm({ ...form, mac: e.target.value.toUpperCase() })} placeholder="2C:1B:3A:71:9E:9E" className="input-field font-mono" disabled={!!form.id} />
              <p className="mt-1 text-xs text-gray-500">Pakai MAC ASLI perangkat. Di TV: Setelan → Jaringan → nama WiFi → Privasi MAC → &quot;Gunakan MAC perangkat&quot;. MAC acak berubah sendiri dan membuat pemantauan berhenti diam-diam.</p>
            </div>
            <div>
              <label className="label-field">Alamat IP tetap (opsional)</label>
              <input value={form.ipTetap} onChange={e => setForm({ ...form, ipTetap: e.target.value.trim() })}
                placeholder="kosongkan = dicari otomatis dari router" className="input-field font-mono" />
              <p className="mt-1 text-xs text-amber-700">
                <b>Biasanya dikosongkan.</b> Sistem sudah mencari sendiri alamat yang benar-benar menjawab. Isi HANYA bila
                router memberi <b>sewa statis</b> untuk MAC ini — kalau alamatnya dikunci di sini padahal TV berpindah
                alamat, perintah (termasuk tombol daya) bisa nyasar ke perangkat lain yang kebetulan memakai IP itu.
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <label className="label-field">Pengumuman di papan (opsional)</label>
              <input value={form.papanJudul} onChange={e => setForm({ ...form, papanJudul: e.target.value })}
                placeholder="mis. Rapat Dewan Guru pukul 13.00" className="input-field mb-2" />
              <textarea value={form.papanIsi} onChange={e => setForm({ ...form, papanIsi: e.target.value })} rows={3}
                placeholder="Keterangan tambahan (boleh dikosongkan)" className="input-field" />
              <p className="mt-1 text-xs text-amber-800">
                Begitu diisi, papan TV ini <b>mengganti jam besar dengan pengumuman ini</b> sampai dikosongkan lagi.
              </p>
            </div>
            <div>
              <label className="label-field">Jenis papan</label>
              <Select value={form.papanJenis} onChange={v => setForm({ ...form, papanJenis: v })} options={[
                { value: "UMUM", label: "Papan umum — jadwal, pengumuman, agenda, bel" },
                { value: "GURU", label: "Papan ruang guru / ruang rapat — panel bergilir" },
              ]} />
              <p className="mt-1 text-xs text-gray-500">
                Papan ruang guru menampilkan panel yang <b>bergilir</b>: presensi pegawai hari ini, jurnal & absensi
                kelas yang belum diisi, buku piket, dan rekap kehadiran siswa. Karena panelnya <b>menyebut nama guru</b>,
                pilihan ini hanya untuk TV di ruang pegawai — jangan dipakai di TV kelas atau koridor.
              </p>
            </div>
            {form.papanJenis === "GURU" && (
              <div>
                <label className="label-field">Ganti panel setiap (detik)</label>
                <input type="number" min={15} max={600} value={form.papanGiliran}
                  onChange={e => setForm({ ...form, papanGiliran: Number(e.target.value) || 60 })} className="input-field" />
                <p className="mt-1 text-xs text-gray-500">15–600 detik. Bawaannya 60 detik. Panel juga bisa digeser manual dengan tombol <b>kiri/kanan</b> pada remote TV; setelah digeser, pergiliran otomatis ditahan 3 menit.</p>
              </div>
            )}
            <div>
              <label className="label-field">Kelas yang jadwalnya ditampilkan (opsional)</label>
              <Select value={form.kelasId} onChange={v => setForm({ ...form, kelasId: v })}
                options={[{ value: "", label: "— papan umum (agenda & pengumuman saja) —" }, ...data.kelas.map(k => ({ value: k.id, label: k.name }))]} />
              <p className="mt-1 text-xs text-gray-500">Hanya untuk TV di depan kelas. TV ruang rapat, TU, dan lab dibiarkan kosong — papannya menampilkan jam, pengumuman, dan agenda saja.</p>
            </div>
            <div>
              <label className="label-field">Volume TV saat bel berbunyi (%)</label>
              <input type="number" min={0} max={100} value={form.volumeBel}
                onChange={e => setForm({ ...form, volumeBel: e.target.value })}
                placeholder="kosongkan = volume TV tidak diubah" className="input-field" />
              <p className="mt-1 text-xs text-gray-500">
                Volume TV dinaikkan ke angka ini <b>15 detik sebelum</b> bel lalu <b>dikembalikan persis</b> ke volume
                semula setelah bel selesai — jadi bel tetap terdengar walau TV sedang dikecilkan, tanpa meninggalkan
                TV keras untuk pemakaian berikutnya. Butuh Debugging jaringan aktif di TV.
              </p>
            </div>
            <div>
              <label className="label-field">QR presensi mandiri di papan</label>
              <Select value={form.papanQr} onChange={v => setForm({ ...form, papanQr: v })} options={[
                { value: "MATI", label: "Tidak ditampilkan" },
                { value: "JAM_PRESENSI", label: "Hanya saat jam presensi — untuk TV siswa" },
                { value: "SELALU", label: "Sepanjang hari — untuk TV ruang guru" },
              ]} />
              <p className="mt-1 text-xs text-gray-500">
                QR-nya berganti tiap 5 detik (foto layar cepat basi), pindaian tetap diterima ±1 menit. Pilih
                <b> sepanjang hari</b> untuk ruang guru karena jadwal guru tidak semuanya pagi.
              </p>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3">
              <input type="checkbox" checked={form.papanOtomatis} onChange={e => setForm({ ...form, papanOtomatis: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300" />
              <span className="text-sm">
                <b>Buka papan otomatis saat TV menganggur</b>
                <span className="mt-0.5 block text-xs text-gray-500">
                  TV yang baru dinyalakan kembali ke papan informasi sendiri, tanpa siapa pun mengetik alamat.
                  Sistem <b>tidak akan</b> merebut layar yang sedang dipakai guru — papan hanya muncul saat TV berada di beranda.
                </span>
              </span>
            </label>
            <div>
              <label className="label-field">Jam nyala otomatis (opsional)</label>
              <TimePicker value={form.jadwalNyala} onChange={v => setForm({ ...form, jadwalNyala: v })} />
              <p className="mt-1 text-xs text-gray-500">
                Hanya berfungsi bila TV disetel mode <b>&quot;Tanpa layar&quot;</b> (Daya &amp; Energi) — pada mode Doze, TV benar-benar tidur dan tidak bisa dibangunkan dari jaringan.
              </p>
            </div>
            <div>
              <label className="label-field">Jam mati otomatis (opsional)</label>
              <TimePicker value={form.jadwalMati} onChange={v => setForm({ ...form, jadwalMati: v })} />
              <p className="mt-1 text-xs text-gray-500">
                TV ditidurkan sendiri pada jam ini setiap hari sekolah (hari libur dilewati). <b>Menyalakan kembali harus manual</b> —
                saat standby, WiFi TV ikut mati sehingga tidak ada perintah yang bisa sampai. Kosongkan untuk mematikan penjadwalan.
              </p>
            </div>
            <div>
              <label className="label-field">Catatan (opsional)</label>
              <input value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} placeholder="mis. dipasang 24 Sep 2026, garansi 3 tahun" className="input-field" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
