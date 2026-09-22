"use client";
import { pecahAlamatDapodik } from "@/lib/dapodik-alamat";
import { useMemo, useState } from "react";
import {
  AlertTriangle, ArrowLeftRight, CheckCircle2, DatabaseZap, FileSpreadsheet, GraduationCap, KeyRound, Loader2, Pencil, PlugZap,
  RefreshCw, Save, School, Search, Server, Users,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Alert from "@/components/admin/Alert";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import Paginasi from "@/components/shared/Paginasi";
import { useToast } from "@/components/shared/ToastProvider";
import { usePaginasi } from "@/lib/use-paginasi";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import Select from "@/components/admin/Select";
import {
  DICOCOKKAN_MANUAL, NAMA_SAJA, NAMA_TANPA_GELAR, type BarisSinkron, type CalonPasangan, type PratinjauDapodik, type StatusSinkron,
} from "@/lib/dapodik-jenis";

interface Hasil {
  ok: boolean; http: number; pesan: string; diperiksa: string;
  sekolah: { nama: string | null; npsn: string | null; alamat: string | null; kecamatan: string | null; kabupaten: string | null; status: string | null } | null;
}

type Tab = "siswa" | "gtk" | "rombel";
type Saringan = "semua" | "tuBelumLengkap" | Exclude<StatusSinkron, "sesuai">;

const pil = "inline-block whitespace-nowrap px-2 py-0.5 rounded-full border text-xs font-semibold";

const PIL_STATUS: Record<StatusSinkron, { label: string; kelas: string }> = {
  perbaiki: { label: "Perlu diperbaiki", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  belumDiDapodik: { label: "Belum di Dapodik", kelas: "bg-red-50 text-red-600 border-red-200" },
  tidakAdaDiTu: { label: "Tidak ada di TU", kelas: "bg-purple-50 text-purple-700 border-purple-200" },
  keluarDiTu: { label: "Lulus/keluar di TU", kelas: "bg-gray-50 text-gray-600 border-gray-200" },
  sesuai: { label: "Sesuai", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const cocokSaringan = (b: BarisSinkron, s: Saringan) =>
  s === "semua" ? true : s === "tuBelumLengkap" ? b.kurangDiTu.length > 0 : b.status === s;

const warnaSebaran = (label: string) =>
  /^(Belum ada di Dapodik|Tidak ada di)/.test(label) ? "bg-amber-50 text-amber-700 border-amber-200"
    : /^(Lulus|Keluar|Pindah|Tanpa kelas|Tanpa rombel)$/.test(label) ? "bg-gray-50 text-gray-600 border-gray-200"
      : "bg-blue-50 text-blue-700 border-blue-200";

/** Kemiripan nama sederhana (kata yang sama) — untuk mengurutkan calon di jendela Cocokkan, paling mirip di atas. */
function kemiripan(a: string, b: string) {
  const kata = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(k => k.length > 1);
  const ka = kata(a), kb = new Set(kata(b));
  if (!ka.length || !kb.size) return 0;
  const sama = ka.filter(k => kb.has(k)).length;
  const awal = ka[0] && kata(b)[0] && ka[0].slice(0, 3) === kata(b)[0].slice(0, 3) ? 0.5 : 0;
  return sama / Math.max(ka.length, kb.size) + awal;
}

interface Koneksi {
  url: string; urlBawaan: string; alamatManual: boolean; ipServer: string; ipManual: boolean;
  adaKunci: boolean; kunciManual: boolean; kunciRusak: boolean; adaKunciBawaan: boolean;
}

/** Label kecil "Diatur manual" / "Bawaan server" di samping isian koneksi. */
function AsalNilai({ manual }: { manual: boolean }) {
  return manual
    ? <span className="px-1.5 py-0.5 rounded-md border text-xs font-semibold bg-blue-50 text-blue-700 border-blue-200">Diatur manual</span>
    : <span className="px-1.5 py-0.5 rounded-md border text-xs font-semibold bg-gray-50 text-gray-500 border-gray-200">Bawaan server</span>;
}

export default function DapodikManager({ npsn, bolehUbah, ...awal }: Koneksi & { npsn: string; bolehUbah: boolean }) {
  const toast = useToast();
  // Alamat Dapodik & IP server situs bisa diubah Administrator (permintaan user 16 Sep 2026 — Dapodik pindah dari VM ke PC biasa).
  const [koneksi, setKoneksi] = useState<Koneksi>(awal);
  const { url, ipServer, adaKunci } = koneksi;
  const [ubahBuka, setUbahBuka] = useState(false);
  // Host & port DIPISAH jadi dua kolom (permintaan user 20 September 2026) — dirakit jadi satu
  // alamat saat dikirim, karena yang disimpan server tetap satu URL utuh.
  const [isiHost, setIsiHost] = useState("");
  const [isiPort, setIsiPort] = useState("");
  const [isiIp, setIsiIp] = useState("");
  const [isiKunci, setIsiKunci] = useState("");
  const [hapusKunci, setHapusKunci] = useState(false);
  const [galatUbah, setGalatUbah] = useState<{ kolom?: string; pesan: string } | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [menguji, setMenguji] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);

  const [memuat, setMemuat] = useState(false);
  /** Keterangan langkah yang sedang berjalan — ditampilkan di tombol Bandingkan. */
  const [kemajuan, setKemajuan] = useState("");
  const [data, setData] = useState<PratinjauDapodik | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("siswa");
  const [saring, setSaring] = useState<Saringan>("semua");
  const [cari, setCari] = useState("");
  const confirmDialog = useConfirm();
  // Cocokkan manual (17 Sep 2026): pasangan tersimpan di server; baris yang baru dicocokkan/dilepas ditandai sampai Ambil Ulang.
  const [cocok, setCocok] = useState<BarisSinkron | null>(null);
  const [pilihanCocok, setPilihanCocok] = useState("");
  const [menyimpanCocok, setMenyimpanCocok] = useState(false);
  const [berubahLokal, setBerubahLokal] = useState<Map<string, string>>(new Map());
  const [idTerpakai, setIdTerpakai] = useState<Set<string>>(new Set());
  const siap = !!(url && npsn && adaKunci);

  async function tes() {
    setMenguji(true);
    const r = await fetch("/api/admin/dapodik/tes", { method: "POST" }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMenguji(false);
    if (!r?.ok) return toast.error(d?.error ?? "Tes koneksi gagal dijalankan.");
    setHasil(d);
  }

  function bukaUbah() {
    const a = pecahAlamatDapodik(koneksi.alamatManual ? koneksi.url : "");
    setIsiHost(a.host);
    setIsiPort(a.port);
    setIsiIp(koneksi.ipManual ? koneksi.ipServer : "");
    setIsiKunci("");
    setHapusKunci(false);
    setGalatUbah(null);
    setUbahBuka(true);
  }

  /** Rakit dua kolom jadi satu alamat. Host kosong = kembali ke bawaan server (port diabaikan). */
  function rakitAlamat() {
    const h = isiHost.trim();
    if (!h) return "";
    const pt = isiPort.trim();
    return pt ? `${h}:${pt}` : h;
  }

  async function simpanKoneksi(e: React.FormEvent) {
    e.preventDefault();
    setMenyimpan(true);
    setGalatUbah(null);
    const r = await fetch("/api/admin/dapodik/pengaturan", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alamat: rakitAlamat(), ipServer: isiIp, kunci: isiKunci, hapusKunci }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMenyimpan(false);
    if (!r?.ok || !d) { setGalatUbah({ kolom: d?.kolom, pesan: d?.error ?? "Pengaturan gagal disimpan — periksa koneksi lalu coba lagi." }); return; }
    setKoneksi({
      url: d.url, urlBawaan: d.urlBawaan, alamatManual: d.alamatManual, ipServer: d.ipServer, ipManual: d.ipManual,
      adaKunci: d.adaKunci, kunciManual: d.kunciManual, kunciRusak: d.kunciRusak, adaKunciBawaan: d.adaKunciBawaan,
    });
    setIsiKunci("");
    setUbahBuka(false);
    if (d.peringatan) toast.warning(d.peringatan);
    if (d.berubah) { setHasil(null); setData(null); toast.success("Pengaturan koneksi Dapodik disimpan. Tekan Tes Koneksi untuk memastikan."); }
    else toast.info("Tidak ada yang berubah.");
  }

  /** Diambil PER LANGKAH, bukan satu permintaan panjang: tiap daftar Dapodik ±15 detik, dan satu
   *  permintaan yang memuat ketiganya (20–47 detik) sesekali dibalas 502 oleh proxy di depan
   *  aplikasi (laporan user 20 September 2026). Sekalian jadi penunjuk kemajuan — dulu layarnya
   *  diam saja setengah menit tanpa keterangan apa pun. */
  const LANGKAH: { kunci: string; label: string }[] = [
    { kunci: "pd", label: "Mengambil peserta didik dari Dapodik..." },
    { kunci: "gtk", label: "Mengambil guru & tendik..." },
    { kunci: "rombel", label: "Mengambil rombongan belajar..." },
  ];
  async function ambil() {
    setMemuat(true);
    setGalat(null);
    try {
      for (const l of LANGKAH) {
        setKemajuan(l.label);
        const r = await fetch(`/api/admin/dapodik/pratinjau?langkah=${l.kunci}&segar=1`, { cache: "no-store" }).catch(() => null);
        const d = await r?.json().catch(() => null);
        if (!r?.ok) { setGalat(d?.error ?? "Pratinjau gagal diambil — periksa koneksi lalu coba lagi."); return; }
      }
      setKemajuan("Membandingkan dengan data TU...");
      const r = await fetch("/api/admin/dapodik/pratinjau", { cache: "no-store" }).catch(() => null);
      const d = await r?.json().catch(() => null);
      if (!r?.ok || !d) { setGalat(d?.error ?? "Pratinjau gagal diambil — periksa koneksi lalu coba lagi."); return; }
      setData(d);
      setBerubahLokal(new Map());
      setIdTerpakai(new Set());
    } finally {
      setMemuat(false);
      setKemajuan("");
    }
  }

  const jenisTab = tab === "gtk" ? "gtk" : "siswa";
  // Baris dari data TU dicocokkan ke calon Dapodik, dan sebaliknya.
  const calonCocok: CalonPasangan[] = useMemo(() => {
    if (!cocok || !data || tab === "rombel") return [];
    const daftar = cocok.tuId ? data[tab].calonDapodik : data[tab].calonTu;
    return daftar.filter(c => !idTerpakai.has(c.id))
      .map(c => ({ c, n: kemiripan(cocok.nama, c.nama) }))
      .sort((x, y) => y.n - x.n || x.c.nama.localeCompare(y.c.nama, "id"))
      .map(x => x.c);
  }, [cocok, data, tab, idTerpakai]);

  function bukaCocok(b: BarisSinkron) {
    setCocok(b);
    setPilihanCocok("");
  }

  async function simpanCocok() {
    if (!cocok || !pilihanCocok) return;
    const calon = calonCocok.find(c => c.id === pilihanCocok);
    const tuId = cocok.tuId ?? pilihanCocok;
    const dapodikId = cocok.dapodikId ?? pilihanCocok;
    const namaDapodik = cocok.dapodikId ? cocok.nama : calon?.nama ?? "";
    setMenyimpanCocok(true);
    const r = await fetch("/api/admin/dapodik/pasangan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jenis: jenisTab, tuId, dapodikId, namaDapodik }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMenyimpanCocok(false);
    if (!r?.ok) { toast.error(d?.error ?? "Pasangan gagal disimpan."); return; }
    setBerubahLokal(m => new Map(m).set(cocok.kunci, `Dicocokkan dengan ${calon?.nama ?? "pilihan"}`));
    setIdTerpakai(x => new Set(x).add(pilihanCocok));
    setCocok(null);
    toast.success("Pasangan disimpan. Tekan Ambil Ulang untuk membandingkan ulang.");
  }

  async function lepasPasangan(b: BarisSinkron) {
    if (!b.tuId) return;
    if (!(await confirmDialog(`Lepas pasangan manual "${b.nama}"? Data ini akan dipasangkan ulang secara otomatis saat Ambil Ulang.`))) return;
    const r = await fetch(`/api/admin/dapodik/pasangan?jenis=${jenisTab}&tuId=${encodeURIComponent(b.tuId)}`, { method: "DELETE" }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) { toast.error(d?.error ?? "Pasangan gagal dilepas."); return; }
    setBerubahLokal(m => new Map(m).set(b.kunci, "Pasangan dilepas"));
    toast.success("Pasangan dilepas. Tekan Ambil Ulang untuk membandingkan ulang.");
  }

  function gantiTab(t: Tab) {
    setTab(t);
    setSaring("semua");
    setCari("");
  }

  const bagian = data && tab !== "rombel" ? data[tab] : null;
  const q = cari.trim().toLowerCase();
  const tampil = useMemo(
    () => (bagian?.baris ?? []).filter(b => cocokSaringan(b, saring)
      && (!q || [b.nama, b.identitas, b.tu, b.dapodik].some(x => x?.toLowerCase().includes(q)))),
    [bagian, saring, q],
  );
  const hal = usePaginasi(tampil, 25, `${tab}|${saring}|${q}|${data?.diambil ?? ""}`);

  const tidakTerdaftar = hasil && !hasil.ok && /tidak terdaftar|ip address.*berbeda/i.test(hasil.pesan);
  const aksesDitolak = hasil && !hasil.ok && /access denied|not authorized/i.test(hasil.pesan);
  const tidakTerjangkau = hasil && !hasil.ok && /tidak bisa menghubungi|tidak menjawab|database aplikasi dapodik/i.test(hasil.pesan);
  const baris = "flex items-center justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0 text-sm";

  const r = bagian?.ringkasan;
  const saringan: { k: Saringan; label: string; n: number }[] = r ? [
    { k: "semua", label: "Semua", n: bagian!.baris.length },
    { k: "perbaiki", label: "Perlu diperbaiki di Dapodik", n: r.perbaiki },
    { k: "belumDiDapodik", label: "Belum ada di Dapodik", n: r.belumDiDapodik },
    { k: "tidakAdaDiTu", label: "Tidak ada di data TU", n: r.tidakAdaDiTu },
    ...(r.keluarDiTu > 0 ? [{ k: "keluarDiTu" as const, label: tab === "siswa" ? "Sudah lulus/keluar di TU" : "Sudah keluar di TU", n: r.keluarDiTu }] : []),
    ...(r.tuBelumLengkap > 0 ? [{ k: "tuBelumLengkap" as const, label: "Data TU belum lengkap", n: r.tuBelumLengkap }] : []),
  ] : [];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<DatabaseZap size={22} />} title="Sinkron Dapodik"
        description="Data TU sebagai acuan — bandingkan dengan Dapodik dan dapatkan daftar yang perlu disamakan operator di aplikasi Dapodik" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="page-card">
          <div className="page-card-header">
            <div className="flex items-center gap-2"><Server size={16} className="text-primary-700" /><h2 className="font-heading font-bold text-gray-800 text-sm">Koneksi Web Service</h2></div>
            {bolehUbah && (
              <button type="button" onClick={bukaUbah} className="btn-modal-cancel px-3 text-xs">
                <Pencil size={14} /> Ubah
              </button>
            )}
          </div>
          <div className="px-5 py-2">
            <div className={baris}>
              <span className="text-gray-500">Alamat Dapodik</span>
              <span className="flex min-w-0 flex-wrap items-center justify-end gap-1.5"><AsalNilai manual={koneksi.alamatManual} /><span className="font-mono text-xs break-all">{url || "— belum diisi —"}</span></span>
            </div>
            <div className={baris}><span className="text-gray-500">NPSN</span><span className="font-mono text-xs">{npsn || "— belum diisi —"}</span></div>
            <div className={baris}>
              <span className="text-gray-500 inline-flex items-center gap-1.5"><KeyRound size={14} /> Kunci Web Service</span>
              <span className="flex flex-wrap items-center justify-end gap-1.5">
                {adaKunci && <AsalNilai manual={koneksi.kunciManual} />}
                <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${adaKunci ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                  {adaKunci ? "Tersimpan di server" : "Belum diisi"}
                </span>
              </span>
            </div>
            <div className={baris}>
              <span className="text-gray-500">IP server situs (didaftarkan di Dapodik)</span>
              <span className="flex flex-wrap items-center justify-end gap-1.5"><AsalNilai manual={koneksi.ipManual} /><span className="font-mono text-xs">{ipServer}</span></span>
            </div>
          </div>
          <div className="px-5 pb-5 pt-2">
            <button type="button" onClick={tes} disabled={menguji || !siap} className="btn-modal-save">
              {menguji ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />} Tes Koneksi
            </button>
            <p className="text-xs text-gray-500 mt-3">Sebelum dipakai: komputer Dapodik menyala, Windows sudah login, dan aplikasi Dapodik sudah dibuka dan login.</p>
            {koneksi.kunciRusak && <p className="error-msg mt-2">Kunci yang disimpan dari halaman tidak bisa dibaca (kunci rahasia server berganti) — isi ulang kunci lewat tombol Ubah.</p>}
            {!bolehUbah && <p className="text-xs text-gray-400 mt-1">Alamat, IP, dan kunci hanya bisa diubah Administrator atau Operator Sekolah.</p>}
            <p className="text-xs text-gray-400 mt-1">Dibatasi 3 kali per menit. Setiap tes tercatat di Log Aktivitas.</p>
          </div>
        </div>

        <div className="space-y-4">
          {!hasil ? (
            <Alert variant="info" title="Belum dites">
              Tekan Tes Koneksi untuk memastikan Web Service Dapodik menjawab. Hasil dan pesan asli dari Dapodik tampil di sini.
            </Alert>
          ) : hasil.ok ? (
            <Alert variant="success" icon={CheckCircle2} title="Terhubung ke Dapodik">
              {hasil.sekolah?.nama ? <>Data sekolah terbaca: <strong>{hasil.sekolah.nama}</strong>{hasil.sekolah.npsn ? ` (NPSN ${hasil.sekolah.npsn})` : ""}{hasil.sekolah.kabupaten ? ` · ${hasil.sekolah.kabupaten}` : ""}.</> : "Web Service menjawab dengan benar."}
            </Alert>
          ) : (
            <Alert variant="error" title={`Belum terhubung${hasil.http ? ` (HTTP ${hasil.http})` : ""}`}>
              Pesan: <strong className="[overflow-wrap:anywhere]">{hasil.pesan}</strong>
            </Alert>
          )}
          {hasil && <p className="text-xs text-gray-400">Diperiksa {new Date(hasil.diperiksa).toLocaleString("id-ID")}</p>}

          {tidakTerjangkau && (
            <div className="page-card p-5 text-sm text-gray-700 space-y-2">
              <p className="font-heading font-bold text-primary-900">Komputer Dapodik tidak terjangkau</p>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Nyalakan komputer Dapodik (<span className="font-mono">{url.replace(/^https?:\/\//, "")}</span>) dan pastikan tidak dalam mode tidur. Kalau komputernya berganti, perbarui alamatnya lewat tombol <strong>Ubah</strong>.</li>
                <li>Login ke Windows, lalu buka aplikasi Dapodik di browser dan login dengan akun operator.</li>
                <li>Firewall Windows di komputer Dapodik harus mengizinkan koneksi masuk ke port Web Service dari IP <span className="font-mono">{ipServer}</span> — server situs berada di jaringan lain, jadi aturan bawaan &ldquo;jaringan lokal saja&rdquo; tidak cukup.</li>
                <li>Setelah itu tekan Tes Koneksi lagi.</li>
              </ol>
            </div>
          )}

          {(tidakTerdaftar || aksesDitolak) && (
            <div className="page-card p-5 text-sm text-gray-700 space-y-2">
              <p className="font-heading font-bold text-primary-900">Yang perlu diperiksa operator di komputer Dapodik</p>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Buka Dapodik → <strong>Pengaturan → Web Service</strong>. Pastikan baris aplikasi <strong>WEB SMK</strong> dengan IP <span className="font-mono">{ipServer}</span> benar-benar tersimpan (tekan Simpan) dan statusnya aktif.</li>
                <li>Pesan <em>&ldquo;IP Address … berbeda&rdquo;</em> berarti IP yang dilihat Dapodik tidak sama dengan yang didaftarkan. Router sekolah menyamarkan lalu lintas ke jaringan komputer Dapodik, jadi yang dilihat Dapodik adalah <strong>IP router di jaringan itu</strong> (cek di MikroTik: <span className="font-mono">/ip address print</span>), bukan IP server situs. Daftarkan IP itu di Dapodik, lalu samakan isian IP server situs lewat tombol Ubah.</li>
                <li>Cocokkan kunci yang tertera di baris itu dengan kunci di situs — satu huruf berbeda (I/l, O/0) sudah cukup membuat ditolak. Kunci baru bisa dimasukkan lewat tombol <strong>Ubah</strong>.</li>
                <li>Kalau baris baru saja ditambahkan, tutup lalu buka lagi aplikasi Dapodik (atau mulai ulang komputernya) supaya daftarnya dimuat ulang.</li>
                <li>Setelah itu tekan Tes Koneksi lagi di halaman ini.</li>
              </ol>
            </div>
          )}
        </div>
      </div>

      <div className="page-card mt-5">
        <div className="page-card-header flex-wrap gap-3">
          <div className="flex items-center gap-2"><ArrowLeftRight size={16} className="text-primary-700" /><h2 className="font-heading font-bold text-gray-800 text-sm">Pratinjau Sinkron</h2></div>
          <div className="flex flex-wrap items-center gap-2">
            {data && (
              <a href="/api/admin/dapodik/ekspor" className="btn-modal-cancel">
                <FileSpreadsheet size={16} className="text-emerald-600" /> Unduh Daftar untuk Operator
              </a>
            )}
            <button type="button" onClick={ambil} disabled={memuat || !siap} className="btn-modal-save btn-teks">
              {memuat ? <Loader2 size={16} className="animate-spin" /> : data ? <RefreshCw size={16} /> : <ArrowLeftRight size={16} />}
              {memuat ? "Mengambil data Dapodik..." : data ? "Ambil Ulang" : "Bandingkan dengan Dapodik"}
            </button>
          </div>
          {kemajuan && (
            <p className="mt-2 text-right text-xs text-gray-500">
              {kemajuan} <span className="text-gray-400">— Web Service Dapodik memerlukan ±15 detik tiap daftar.</span>
            </p>
          )}
        </div>

        <div className="p-5 space-y-4">
          {galat && <Alert variant="error" title="Pratinjau gagal">{galat}</Alert>}

          {!data ? (
            <>
              <Alert variant="info" title="Data TU adalah acuan">
                Setiap perbedaan diperbaiki di aplikasi Dapodik supaya sama dengan data TU. Halaman ini hanya membaca Dapodik — tidak menulis ke Dapodik
                maupun ke data situs. Kolom yang kosong di data TU ditandai supaya dilengkapi TU dari berkas aslinya, bukan disalin dari Dapodik.
              </Alert>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { ikon: Users, judul: "Peserta didik", isi: "Dipasangkan lewat NISN, NIK, NIS = NIPD, lalu nama + tanggal lahir." },
                  { ikon: GraduationCap, judul: "Guru & tendik (GTK)", isi: "Dipasangkan lewat NIK, NUPTK, NIP, lalu nama tanpa gelar." },
                  { ikon: School, judul: "Kelas & rombel", isi: "Siswa tiap kelas TU tercatat di rombel Dapodik mana." },
                ].map(x => (
                  <div key={x.judul} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                    <p className="font-semibold text-primary-900 text-sm inline-flex items-center gap-2"><x.ikon size={15} className="text-primary-700" /> {x.judul}</p>
                    <p className="text-xs text-gray-500 mt-1">{x.isi}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <Alert variant={data.semesterBeda ? "warning" : "info"} icon={data.semesterBeda ? AlertTriangle : undefined}
                title={`Data Dapodik semester ${data.semester} · data TU ${data.tahunTu ?? "—"} (acuan)`}>
                {data.semesterBeda
                  ? <>Dapodik belum pindah ke tahun ajaran data TU, jadi tingkat kelas belum dibandingkan. Siswa baru di TU wajar tampil &ldquo;belum ada di Dapodik&rdquo; dan lulusan tahun lalu tampil &ldquo;sudah lulus di TU&rdquo; sampai operator menjalankan pergantian semester & kelulusan di Dapodik.</>
                  : <>Semua perbedaan disamakan di Dapodik mengikuti data TU.</>}
                {" "}Diambil {new Date(data.diambil).toLocaleString("id-ID")}.
              </Alert>

              <div role="tablist" aria-label="Jenis data" className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 w-fit max-w-full overflow-x-auto scrollbar-hide">
                {([
                  { k: "siswa", label: "Peserta Didik", ikon: Users, n: data.siswa.ringkasan.dapodik },
                  { k: "gtk", label: "GTK", ikon: GraduationCap, n: data.gtk.ringkasan.dapodik },
                  { k: "rombel", label: "Kelas & Rombel", ikon: School, n: data.rombel.kelasTu.length },
                ] as const).map(t => (
                  <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} onClick={() => gantiTab(t.k)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${tab === t.k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                    <t.ikon size={14} /> {t.label} <span className="tabular-nums opacity-70">{t.n}</span>
                  </button>
                ))}
              </div>

              {tab === "rombel" ? (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-heading font-bold text-sm text-gray-800 mb-2">Kelas di data TU (acuan)</h3>
                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                      <div className="overflow-x-auto scrollbar-visible">
                        <table className="data-table min-w-[560px]">
                          <thead><tr><th>Kelas</th><th className="text-right">Siswa aktif</th><th>Tercatat di rombel Dapodik</th></tr></thead>
                          <tbody>
                            {data.rombel.kelasTu.map(k => (
                              <tr key={k.id}>
                                <td className="font-medium text-gray-800 whitespace-nowrap">{k.nama}</td>
                                <td className="text-right tabular-nums">{k.siswaAktif}</td>
                                <td>
                                  <div className="flex flex-wrap gap-1">
                                    {k.sebaran.length === 0 ? <span className="text-xs text-gray-300">—</span>
                                      : k.sebaran.map(x => <span key={x.label} className={`${pil} ${warnaSebaran(x.label)}`}>{x.label} · {x.jumlah}</span>)}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-heading font-bold text-sm text-gray-800 mb-2">Rombel di Dapodik</h3>
                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                      <div className="overflow-x-auto scrollbar-visible">
                        <table className="data-table min-w-[760px]">
                          <thead>
                            <tr><th>Rombel</th><th>Tingkat</th><th>Jurusan</th><th>Wali</th><th className="text-right">Anggota</th><th>Anggota menurut data TU</th></tr>
                          </thead>
                          <tbody>
                            {data.rombel.daftar.map(x => (
                              <tr key={x.id}>
                                <td className="font-medium text-gray-800 whitespace-nowrap">{x.nama}</td>
                                <td className="tabular-nums">{x.tingkat}</td>
                                <td className="text-xs">{x.jurusan || "—"}</td>
                                <td className="text-xs">{x.wali || "—"}</td>
                                <td className="text-right tabular-nums">{x.anggota}</td>
                                <td>
                                  <div className="flex flex-wrap gap-1">
                                    {x.sebaran.map(s => <span key={s.label} className={`${pil} ${warnaSebaran(s.label)}`}>{s.label} · {s.jumlah}</span>)}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ) : r && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Data TU <strong className="tabular-nums">{r.tuAktif}</strong> {tab === "siswa" ? "siswa aktif" : "guru aktif"} ·
                    Dapodik <strong className="tabular-nums">{r.dapodik}</strong> {tab === "siswa" ? "peserta didik" : "GTK"} ·
                    {" "}<strong className="tabular-nums">{r.sesuai}</strong> sudah sesuai
                    {tab === "gtk" && <span className="text-gray-400"> — tenaga kependidikan yang tidak tercatat sebagai guru di TU tampil &ldquo;tidak ada di data TU&rdquo;.</span>}
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {saringan.map(s => (
                      <button key={s.k} type="button" onClick={() => setSaring(s.k)} aria-pressed={saring === s.k}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition ${saring === s.k ? "bg-primary-900 border-primary-900 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                        {s.label}
                        <span className={`tabular-nums px-1.5 rounded-full ${saring === s.k ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>{s.n}</span>
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input id="cari-sinkron" value={cari} onChange={e => setCari(e.target.value)}
                      placeholder={tab === "siswa" ? "Cari nama, NISN, kelas, atau rombel..." : "Cari nama, NUPTK, atau jabatan..."}
                      className="input-field pl-10" />
                  </div>

                  {tampil.length === 0 ? (
                    <EmptyState icon={CheckCircle2} title="Tidak ada baris" description="Tidak ada data yang sesuai dengan saringan atau pencarian ini." />
                  ) : (
                    <div id="daftar-sinkron" className="scroll-mt-28 rounded-xl border border-gray-100 overflow-hidden">
                      <div className="overflow-x-auto scrollbar-visible">
                        <table className="data-table min-w-[860px]">
                          <thead>
                            <tr>
                              <th>Nama</th>
                              <th>{tab === "siswa" ? "Data TU (kelas)" : "Data TU (jabatan)"}</th>
                              <th>{tab === "siswa" ? "Rombel Dapodik" : "Dapodik"}</th>
                              <th>Status</th>
                              <th>Yang perlu dilakukan di Dapodik</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hal.potongan.map(b => {
                              const lemah = b.dasar === NAMA_SAJA || b.dasar === NAMA_TANPA_GELAR;
                              return (
                                <tr key={b.kunci}>
                                  <td>
                                    <p className="font-medium text-gray-800">{b.nama}</p>
                                    {b.identitas && <p className="text-xs text-gray-400 tabular-nums">{b.identitas}</p>}
                                  </td>
                                  <td className="text-xs whitespace-nowrap">{b.tu ?? <span className="text-gray-300">—</span>}</td>
                                  <td className="text-xs">{b.dapodik ?? <span className="text-gray-300">—</span>}</td>
                                  <td>
                                    <span className={`${pil} ${PIL_STATUS[b.status].kelas}`}>{PIL_STATUS[b.status].label}</span>
                                    {b.dasar && <p className={`text-xs mt-1 whitespace-nowrap ${lemah ? "text-amber-600" : b.dasar === DICOCOKKAN_MANUAL ? "text-blue-600" : "text-gray-400"}`}>lewat {b.dasar}</p>}
                                    {bolehUbah && (berubahLokal.has(b.kunci) ? (
                                      <p className="text-xs mt-1.5 font-semibold text-blue-700">{berubahLokal.get(b.kunci)} — Ambil Ulang</p>
                                    ) : b.status === "belumDiDapodik" || b.status === "tidakAdaDiTu" ? (
                                      <button type="button" onClick={() => bukaCocok(b)} className="btn-modal-cancel mt-1.5 px-3 text-xs">
                                        <ArrowLeftRight size={14} /> Cocokkan
                                      </button>
                                    ) : b.dasar === DICOCOKKAN_MANUAL ? (
                                      <button type="button" onClick={() => lepasPasangan(b)} className="mt-1.5 text-xs font-semibold text-red-600 hover:underline">
                                        Lepas pasangan
                                      </button>
                                    ) : null)}
                                  </td>
                                  <td className="text-xs leading-relaxed min-w-[18rem]">
                                    {b.tindakan ? <p className="font-medium text-gray-800">{b.tindakan}</p> : <p className="text-gray-400">Sudah sama dengan data TU</p>}
                                    {b.beda.map(t => (
                                      <p key={t.key}><span className="font-semibold text-amber-700">{t.label}</span>: Dapodik {t.dapodik} → data TU <strong>{t.tu}</strong></p>
                                    ))}
                                    {b.kurangDiDapodik.length > 0 && (
                                      <p className="text-amber-700">Lengkapi: {b.kurangDiDapodik.map(k => `${k.label} ${k.nilai}`).join(" · ")}</p>
                                    )}
                                    {b.kurangDiTu.length > 0 && (
                                      <p className="text-gray-400">Data TU belum mengisi {b.kurangDiTu.join(", ")} — dilengkapi TU dari berkas</p>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <Paginasi hal={hal} satuan="baris" idGulir="daftar-sinkron" className="border-t border-gray-100" />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {bolehUbah && (
        <Modal open={!!cocok} onClose={() => !menyimpanCocok && setCocok(null)} size="lg"
          title={cocok?.tuId ? "Cocokkan dengan data Dapodik" : "Cocokkan dengan data TU"}
          description="Pilih orang yang sama — hanya pasangannya yang disimpan, data TU dan Dapodik tidak berubah"
          footer={<>
            <button type="button" onClick={() => setCocok(null)} disabled={menyimpanCocok} className="btn-modal-cancel">Batal</button>
            <button type="button" onClick={simpanCocok} disabled={menyimpanCocok || !pilihanCocok} className="btn-modal-save">
              {menyimpanCocok ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Pasangan
            </button>
          </>}>
          {cocok && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
                <p className="text-xs text-gray-500">{cocok.tuId ? "Data TU" : "Data Dapodik"}</p>
                <p className="font-semibold text-primary-900">{cocok.nama}</p>
                <p className="text-xs text-gray-500">{[cocok.identitas, cocok.tuId ? cocok.tu : cocok.dapodik].filter(Boolean).join(" · ")}</p>
              </div>
              <div>
                <label className="label-field">{cocok.tuId ? "Pasangannya di Dapodik" : "Pasangannya di data TU"}</label>
                {calonCocok.length === 0 ? (
                  <p className="text-sm text-gray-500">Tidak ada calon yang belum berpasangan.</p>
                ) : (
                  <Select value={pilihanCocok} onChange={setPilihanCocok} placeholder="Ketik nama untuk mencari…"
                    options={calonCocok.map(c => ({ value: c.id, label: c.ket ? `${c.nama} — ${c.ket}` : c.nama }))} />
                )}
                <p className="text-xs text-gray-500 mt-1.5">Urutan dimulai dari nama yang paling mirip. Pastikan tanggal lahir, NISN/NUPTK, atau kelasnya memang orang yang sama.</p>
              </div>
            </div>
          )}
        </Modal>
      )}

      {bolehUbah && (
        <Modal open={ubahBuka} onClose={() => !menyimpan && setUbahBuka(false)} title="Ubah Koneksi Dapodik"
          description="Kosongkan alamat atau IP untuk kembali ke bawaan server"
          footer={<>
            <button type="button" onClick={() => setUbahBuka(false)} disabled={menyimpan} className="btn-modal-cancel">Batal</button>
            <button type="submit" form="form-koneksi-dapodik" disabled={menyimpan} className="btn-modal-save">
              {menyimpan ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
            </button>
          </>}>
          <form id="form-koneksi-dapodik" onSubmit={simpanKoneksi} className="space-y-4">
            {galatUbah && !galatUbah.kolom && <p className="error-msg">{galatUbah.pesan}</p>}
            <div>
              <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                <div>
                  <label htmlFor="alamat-dapodik" className="label-field">IP atau domain Dapodik</label>
                  <input id="alamat-dapodik" className="input-field font-mono" value={isiHost} onChange={e => setIsiHost(e.target.value)}
                    placeholder={pecahAlamatDapodik(koneksi.urlBawaan).host || "192.168.100.99"} autoComplete="off" spellCheck={false} />
                </div>
                <div>
                  <label htmlFor="port-dapodik" className="label-field">Port</label>
                  <input id="port-dapodik" className="input-field font-mono" value={isiPort} onChange={e => setIsiPort(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="5774" autoComplete="off" inputMode="numeric" spellCheck={false} />
                </div>
              </div>
              {galatUbah?.kolom === "alamat" && <p className="error-msg mt-2">{galatUbah.pesan}</p>}
              <p className="text-xs text-gray-500 mt-1.5">
                Boleh IP jaringan lokal, IP publik, maupun nama domain (termasuk <span className="font-mono">localhost</span>).
                Port dikosongkan otomatis memakai 5774. Kosongkan kolom IP/domain untuk kembali ke bawaan server:
                <span className="font-mono"> {koneksi.urlBawaan || "belum diisi"}</span>.
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Kunci Web Service ikut terkirim ke alamat ini — periksa lagi sebelum menyimpan IP publik.
              </p>
            </div>
            <div>
              <label htmlFor="ip-server-dapodik" className="label-field">IP server situs (didaftarkan di Dapodik)</label>
              <input id="ip-server-dapodik" className="input-field font-mono" value={isiIp} onChange={e => setIsiIp(e.target.value)}
                placeholder="172.15.0.3" autoComplete="off" inputMode="decimal" spellCheck={false} />
              {galatUbah?.kolom === "ipServer" && <p className="error-msg mt-2">{galatUbah.pesan}</p>}
              <p className="text-xs text-gray-500 mt-1.5">
                Hanya catatan untuk operator: IP inilah yang ditulis di Dapodik → Pengaturan → Web Service. Isian ini tidak mengubah IP server.
              </p>
            </div>
            <div>
              <label htmlFor="kunci-dapodik" className="label-field">Kunci Web Service baru</label>
              <input id="kunci-dapodik" type="password" className="input-field font-mono" value={isiKunci}
                onChange={e => { setIsiKunci(e.target.value); if (e.target.value) setHapusKunci(false); }}
                placeholder={koneksi.adaKunci ? "Kosongkan bila kunci tidak diganti" : "Tempel kunci dari Dapodik"} autoComplete="new-password" spellCheck={false} />
              {galatUbah?.kolom === "kunci" && <p className="error-msg mt-2">{galatUbah.pesan}</p>}
              <p className="text-xs text-gray-500 mt-1.5">
                Salin dari Dapodik → Pengaturan → Web Service. Kunci disimpan terenkripsi di server dan tidak pernah ditampilkan lagi.
              </p>
              {koneksi.kunciManual && !isiKunci && (
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={hapusKunci} onChange={e => setHapusKunci(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                  Kembali ke kunci bawaan server{koneksi.adaKunciBawaan ? "" : " (bawaan server kosong)"}
                </label>
              )}
            </div>
            <p className="text-xs text-gray-400">Setiap perubahan tercatat di Log Aktivitas — nilai kunci tidak ikut dicatat.</p>
          </form>
        </Modal>
      )}
    </div>
  );
}
