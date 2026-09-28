"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Network, Tv, Router as RouterIkon, ShieldCheck, Settings, Loader2, Save, Plug, Eye, EyeOff, Cctv, Bell, DoorOpen, Hammer, ScrollText, Smartphone } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import PapanTvManager from "@/components/sarpras/PapanTvManager";
import PerangkatJaringanManager from "@/components/sarpras/PerangkatJaringanManager";
import JaringanManager from "@/components/shared/JaringanManager";
import JaringanUjianManager from "@/components/admin/JaringanUjianManager";
import CctvManager from "@/components/sarpras/CctvManager";
import { useToast } from "@/components/shared/ToastProvider";
import BarisPintasan from "@/components/shared/BarisPintasan";

/** JARINGAN & LAYAR — SATU HALAMAN untuk empat modul (27 September 2026).
 *
 * Permintaan user: "kenapa fitur papan & tv, perangkat jaringan, dan jaringan sekolah, tidak dijadikan 1
 * saja dan yang bisa di ringkas". Keempatnya (Papan & TV, Perangkat Jaringan, Jaringan Sekolah, Mode Ujian
 * Jaringan) memang satu urusan: semuanya membaca router yang SAMA lewat `bacaRouter()`, dan petugas yang
 * membukanya berpindah-pindah di antara keempatnya dalam satu pekerjaan — mencari TV yang mati lalu
 * memeriksa AP ruangannya lalu melihat hotspot.
 *
 * Yang digabung hanya KERANGKAnya: tiap bagian tetap komponen yang sudah berjalan, dipasang dengan
 * `tanpaKerangka` supaya PageHeader-nya tidak dobel. Menulis ulang isi keempatnya hanya untuk menyatukan
 * tampilan akan mengorbankan fitur yang sudah terbukti di lapangan.
 *
 * HAK AKSES BERBEDA per bagian, dan itu sengaja dipertahankan: pengelola sarana prasarana melihat Layar &
 * Perangkat, Pengelola Jaringan Sekolah melihat Router, Mode Ujian, dan Setelan. Tab yang tidak berhak
 * TIDAK dirender sama sekali (bukan disembunyikan dengan CSS), dan tiap API di belakangnya tetap memeriksa
 * haknya sendiri — halaman gabungan bukan pengganti penjaga. */

type Kunci = "layar" | "perangkat" | "router" | "ujian" | "setelan";
type Hak = "sarpras" | "cctv" | "jaringan";

/* `hak` boleh beberapa: tab tampil bila pengguna punya SALAH SATUNYA, dan isinya disaring lagi per bagian.
   Tab "Perangkat" memuat perangkat jaringan DAN CCTV — keduanya "kotak yang menempel di dinding dan
   dipantau", jadi digabung alih-alih menambah satu tab lagi (permintaan user 27 September 2026: CCTV
   "dimasukkan ke perangkat jaringan dan teman-temannya tadi jadi satu"). */
const BAGIAN: { kunci: Kunci; label: string; ikon: typeof Tv; hak: Hak[] }[] = [
  { kunci: "layar", label: "Layar & TV", ikon: Tv, hak: ["sarpras"] },
  { kunci: "perangkat", label: "Perangkat & CCTV", ikon: RouterIkon, hak: ["sarpras", "cctv"] },
  { kunci: "router", label: "Router & Hotspot", ikon: Network, hak: ["jaringan"] },
  { kunci: "ujian", label: "Mode Ujian", ikon: ShieldCheck, hak: ["jaringan"] },
  { kunci: "setelan", label: "Setelan Router", ikon: Settings, hak: ["jaringan"] },
];

export default function PusatJaringanManager(
  { sarpras, jaringan, cctv, basePath = "/dashboard/admin" }:
  { sarpras: boolean; jaringan: boolean; cctv: boolean; basePath?: string },
) {
  const punya: Record<Hak, boolean> = { sarpras, cctv, jaringan };
  const tersedia = BAGIAN.filter(b => b.hak.some(h => punya[h]));
  const params = useSearchParams();
  const navigasi = useRouter();
  const diminta = params.get("bagian") as Kunci | null;
  const awal = tersedia.find(b => b.kunci === diminta)?.kunci ?? tersedia[0]?.kunci ?? "layar";
  const [bagian, setBagian] = useState<Kunci>(awal);

  /* Tautan dari luar (menu lama, lonceng, penanda peramban) membawa ?bagian= — kalau berubah, ikuti. */
  useEffect(() => { if (diminta && tersedia.some(b => b.kunci === diminta)) setBagian(diminta); }, [diminta]); // eslint-disable-line react-hooks/exhaustive-deps

  const pindah = (k: Kunci) => {
    setBagian(k);
    /* Alamat ikut berubah supaya tab yang sedang dibuka bisa ditautkan & dimuat ulang tanpa kembali ke
     * tab pertama. `replace` — bukan `push` — agar tombol kembali peramban tidak menelusuri tiap tab. */
    navigasi.replace(`?bagian=${k}`, { scroll: false });
  };

  const aktif = tersedia.find(b => b.kunci === bagian) ?? tersedia[0];
  const guru = basePath.includes("/teacher");

  /* PINTASAN — halaman TETANGGA yang dibuka dalam pekerjaan yang sama, bukan pengulangan tab di bawahnya
     (pola Dashboard Kurikulum). Rute admin TIDAK ditautkan dari portal guru: layout Admin hanya menerima
     jabatan TU, jadi guru akan dialihkan (CLAUDE.md #45). */
  const pintasan = [
    ...(guru ? [] : [{ href: `${basePath}/bel-sekolah`, label: "Bel Sekolah Otomatis", ikon: Bell }]),
    { href: `${basePath}/daftar-ruang`, label: "Daftar Ruang", ikon: DoorOpen },
    { href: `${basePath}/layanan-sarpras`, label: "Layanan Sarpras", ikon: Hammer },
    ...(guru
      ? [{ href: "/pasang-aplikasi", label: "Aplikasi & APK Papan", ikon: Smartphone }]
      : [{ href: `${basePath}/log-aktivitas`, label: "Log Aktivitas", ikon: ScrollText }]),
  ];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Network size={22} />} title="Jaringan & Layar"
        description="TV & papan informasi, perangkat jaringan, CCTV, router, dan mode ujian — satu tempat" />

      <div className="space-y-6">
        <BarisPintasan items={pintasan} />

        {tersedia.length > 1 && (
          <div className="baris-alat">
            <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
              {tersedia.map(b => (
                <button key={b.kunci} type="button" onClick={() => pindah(b.kunci)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    bagian === b.kunci ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                  <b.ikon size={15} /> {b.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {aktif?.kunci === "layar" && <PapanTvManager tanpaKerangka />}
        {aktif?.kunci === "perangkat" && (
          <div className="space-y-6">
            {sarpras && <PerangkatJaringanManager tanpaKerangka />}
            {cctv && (
              /* Judul bagian dipakai karena dua modul berbagi satu tab — tanpa penanda, tabel perangkat
                 dan petak kamera terbaca seperti satu daftar yang terpotong. */
              <div className="space-y-3">
                <p className="label-kecil flex items-center gap-2 text-primary-900"><Cctv size={14} /> CCTV Sekolah</p>
                <CctvManager tanpaKerangka />
              </div>
            )}
          </div>
        )}
        {aktif?.kunci === "router" && <JaringanManager tanpaKerangka />}
        {aktif?.kunci === "ujian" && <JaringanUjianManager tanpaKerangka />}
        {aktif?.kunci === "setelan" && <SetelanRouterPanel />}
      </div>
    </div>
  );
}

interface Tampil {
  uji?: { ok: boolean; pesan: string; mulai: number };
  host: string; port: number; user: string; adaSandi: boolean; sandiRusak: boolean;
  manual: { host: boolean; port: boolean; user: boolean; sandi: boolean };
  bawaanEnv: { host: string; port: number; user: string; adaSandi: boolean };
}

/** SETELAN SAMBUNGAN ROUTER — alamat, port, pengguna, sandi diisi di sini (27 September 2026).
 *
 * Sandi TIDAK PERNAH dikirim balik dari server, jadi kotaknya selalu tampil kosong: kosong berarti
 * "jangan diubah", bukan "hapus". Menghapus sandi tersimpan harus ditekan tegas. */
function SetelanRouterPanel() {
  const [data, setData] = useState<Tampil | null>(null);
  const [galat, setGalat] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [user, setUser] = useState("");
  const [sandi, setSandi] = useState("");
  const [lihatSandi, setLihatSandi] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [hasilUji, setHasilUji] = useState<{ ok: boolean; pesan: string; mulai?: number } | null>(null);
  const [menguji, setMenguji] = useState(false);
  const toast = useToast();

  /** `uji` = true saat halaman dibuka & saat tombol ditekan; sisanya cuma memuat setelan. */
  const muat = (uji = false) => fetch(`/api/jaringan/setelan${uji ? "?uji=1" : ""}`, { cache: "no-store" })
    .then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) { setGalat(d?.error || "Gagal memuat setelan router."); return; }
      setData(d); setGalat("");
      setHost(d.manual.host ? d.host : "");
      setPort(d.manual.port ? String(d.port) : "");
      setUser(d.manual.user ? d.user : "");
      if (d.uji) setHasilUji(d.uji);
    })
    .catch(() => setGalat("Gagal memuat setelan router."));

  /* Diuji sekali saat halaman dibuka supaya indikatornya langsung berarti; sesudah itu hanya
     bila petugas menekan "Uji koneksi" — membuka tab lain tidak perlu menghubungi router. */
  useEffect(() => { setMenguji(true); muat(true).finally(() => setMenguji(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ujiSekarang = async () => {
    setMenguji(true); setHasilUji(null);
    await muat(true);
    setMenguji(false);
  };

  const simpan = async (hapusSandi = false) => {
    setSibuk(true); setHasilUji(null);
    try {
      const r = await fetch("/api/jaringan/setelan", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, user, sandi: sandi || undefined, hapusSandi }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) { toast.error(d?.error || "Gagal menyimpan setelan."); return; }
      setSandi("");
      setData(d.setelan);
      setHasilUji(d.uji ?? null);
      if (d.uji?.ok) toast.success("Setelan tersimpan — router menjawab.");
      else if (d.uji) toast.warning("Setelan tersimpan, tetapi router belum menjawab.");
      else toast.success("Setelan tersimpan.");
    } catch { toast.error("Gagal menyimpan setelan."); }
    finally { setSibuk(false); }
  };

  if (!data && !galat) return <div className="flex min-h-[40vh] items-center justify-center text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (!data) return <div className="py-20 text-center text-gray-400">{galat}</div>;

  const env = data.bawaanEnv;

  return (
    <div className="space-y-5">
      <div className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-heading text-sm font-semibold text-navy">Sambungan ke router</h3>
          {/* Indikator status: yang dilihat petugas pertama kali, sebelum membaca isian apa pun. */}
          <span className={`status-badge ${
            menguji ? "border-gray-200 bg-gray-50 text-gray-500"
            : !hasilUji ? "border-gray-200 bg-gray-50 text-gray-500"
            : hasilUji.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-600"}`}>
            {menguji
              ? <><Loader2 size={12} className="animate-spin" /> Menguji…</>
              : !hasilUji ? <>Belum diuji</>
              : hasilUji.ok
                ? <><span className="status-dot bg-emerald-500" /> Terhubung{hasilUji.mulai ? ` · ${hasilUji.mulai} md` : ""}</>
                : <><span className="status-dot bg-red-500" /> Tidak terhubung</>}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Dipakai seluruh fitur yang membaca router: status TV, perangkat jaringan, hotspot, dan Mode Ujian.
          Isian yang dibiarkan kosong memakai nilai bawaan dari berkas <span className="font-mono">.env</span> server.
        </p>

        {data.sandiRusak && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Sandi tersimpan tidak bisa dibuka — biasanya karena kunci sesi server berganti. Isi ulang sandinya di bawah.
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <label className="label-field">Alamat router (IP atau nama host)</label>
            <input value={host} onChange={e => setHost(e.target.value)} className="input-field"
              placeholder={env.host || "mis. 192.168.100.1"} />
            <p className="mt-1 text-xs text-gray-400">{data.manual.host ? "Diisi dari halaman ini." : `Memakai bawaan .env${env.host ? `: ${env.host}` : " (belum ada)"}.`}</p>
          </div>
          <div className="min-w-0">
            <label className="label-field">Port API</label>
            <input value={port} onChange={e => setPort(e.target.value)} inputMode="numeric" className="input-field"
              placeholder={String(env.port)} />
            <p className="mt-1 text-xs text-gray-400">{data.manual.port ? "Diisi dari halaman ini." : `Memakai bawaan .env: ${env.port}.`}</p>
          </div>
          <div className="min-w-0">
            <label className="label-field">Nama pengguna</label>
            <input value={user} onChange={e => setUser(e.target.value)} autoComplete="off" className="input-field"
              placeholder={env.user || "mis. admin"} />
            <p className="mt-1 text-xs text-gray-400">{data.manual.user ? "Diisi dari halaman ini." : `Memakai bawaan .env${env.user ? `: ${env.user}` : " (belum ada)"}.`}</p>
          </div>
          <div className="min-w-0">
            <label className="label-field">Sandi</label>
            <div className="relative">
              <input value={sandi} onChange={e => setSandi(e.target.value)} type={lihatSandi ? "text" : "password"}
                autoComplete="new-password" className="input-field pr-11"
                placeholder={data.adaSandi ? "Tersimpan — kosongkan bila tidak diubah" : "Belum ada sandi tersimpan"} />
              <button type="button" onClick={() => setLihatSandi(v => !v)} title={lihatSandi ? "Sembunyikan" : "Tampilkan"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-primary-700">
                {lihatSandi ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {data.manual.sandi ? "Tersimpan terenkripsi di basis data — tidak pernah ditampilkan kembali."
                : `Memakai bawaan .env${env.adaSandi ? "" : " (belum ada)"}.`}
            </p>
          </div>
        </div>

        <div className="baris-alat mt-5">
          <div className="alat-aksi">
            <button type="button" disabled={sibuk || menguji} onClick={ujiSekarang} className="btn-modal-cancel btn-teks">
              {menguji ? <Loader2 className="animate-spin" /> : <Plug />} Uji koneksi
            </button>
            <button type="button" disabled={sibuk} onClick={() => simpan()} className="btn-modal-save btn-teks">
              {sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan &amp; uji sambungan
            </button>
            {data.manual.sandi && (
              <button type="button" disabled={sibuk} onClick={() => simpan(true)} className="btn-modal-cancel btn-teks">
                Hapus sandi tersimpan
              </button>
            )}
          </div>
        </div>

        {hasilUji && (
          <div className={`mt-4 flex gap-2 rounded-xl border px-4 py-3 text-sm ${
            hasilUji.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
            <Plug size={18} className="shrink-0" />
            <span>{hasilUji.pesan}</span>
          </div>
        )}
      </div>

      <div className="panel p-5">
        <h3 className="font-heading text-sm font-semibold text-navy">Yang perlu diperhatikan</h3>
        <ul className="mt-2 space-y-1.5 text-xs text-gray-600">
          <li>• Sandi router ikut terkirim ke alamat yang diisi di sini — pastikan alamatnya benar-benar router sekolah.</li>
          <li>• Port yang dipakai adalah port <span className="font-semibold">API RouterOS</span> (<span className="font-mono">/ip service api</span>), bukan Winbox atau SSH.</li>
          <li>• Pengguna router itu harus punya izin membaca DHCP, hotspot, ARP, dan mengubah aturan firewall (untuk Mode Ujian).</li>
          <li>• Batasi <span className="font-mono">available-from</span> layanan API ke alamat server situs saja; API yang terbuka ke internet pernah dicoba ditembus dari luar.</li>
        </ul>
      </div>
    </div>
  );
}
