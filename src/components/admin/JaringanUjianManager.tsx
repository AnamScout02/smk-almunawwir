"use client";
import { useCallback, useEffect, useState } from "react";
import { Network, Loader2, Save, ShieldCheck, ShieldOff, TriangleAlert, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";

interface Status {
  mode: "MATI" | "OTOMATIS" | "PAKSA_AKTIF";
  antarmuka: string[]; host: string[];
  aturan: number; aktif: boolean; sedangUjian: number; routerOk: boolean; pesan?: string;
  error?: string;
}

const MODE = [
  { value: "MATI", label: "Mati — tidak ada blokir sama sekali" },
  { value: "OTOMATIS", label: "Otomatis — blokir hanya saat ada yang sedang ujian" },
  { value: "PAKSA_AKTIF", label: "Paksa aktif — blokir terus sampai dimatikan lagi" },
];

/** MODE UJIAN JARINGAN — pengaturan blokir hiburan otomatis saat CBT berlangsung (24 September 2026).
 *
 * Halaman ini mengubah internet SATU SEKOLAH, jadi tampilannya sengaja menonjolkan tiga hal: mode yang sedang
 * berlaku, apakah blokirnya sedang menyala detik ini, dan berapa peserta yang sedang mengerjakan — supaya
 * tidak ada yang bertanya-tanya "kenapa YouTube mati" tanpa bisa menemukan jawabannya. */
export default function JaringanUjianManager({ tanpaKerangka }: { tanpaKerangka?: boolean } = {}) {
  const [d, setD] = useState<Status | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [mode, setMode] = useState("MATI");
  const [antarmuka, setAntarmuka] = useState("");
  const [host, setHost] = useState("");
  const [tenggang, setTenggang] = useState("10");
  const toast = useToast();

  const muat = useCallback((diam = false) => fetch("/api/admin/jaringan-ujian", { cache: "no-store" })
    .then(async r => {
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || j.error) { if (!diam) setGalat(j?.error || "Gagal memuat"); return; }
      setD(j); setGalat("");
      if (!diam) {
        setMode(j.mode); setAntarmuka(j.antarmuka.join(", ")); setHost(j.host.join(", "));
      }
    })
    .catch(() => { if (!diam) setGalat("Gagal memuat"); }), []);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => { const t = setInterval(() => muat(true), 30_000); return () => clearInterval(t); }, [muat]);

  const simpan = async () => {
    setSibuk(true);
    try {
      const r = await fetch("/api/admin/jaringan-ujian", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, antarmuka, host, tenggang }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { toast.error(j?.error || "Gagal menyimpan"); return; }
      toast.success(j?.dibuat ? `Tersimpan — ${j.dibuat} aturan baru dibuat di router` : "Tersimpan");
      if (j?.status) setD(j.status);
    } finally { setSibuk(false); }
  };

  if (!d && !galat) return <div className={`${tanpaKerangka ? "" : "p-6 lg:p-8"} flex items-center justify-center min-h-[60vh] text-gray-400`}><Loader2 size={24} className="animate-spin" /></div>;
  if (!d) return <div className={`${tanpaKerangka ? "" : "p-6 lg:p-8"} text-center text-gray-400 py-20`}>{galat}</div>;

  return (
    <div className={tanpaKerangka ? "" : "p-6 lg:p-8 pt-16 lg:pt-8"}>
      {!tanpaKerangka && (
      <PageHeader icon={<Network size={22} />} title="Mode Ujian Jaringan"
        description="Menutup hiburan di jaringan siswa selama ada yang mengerjakan CBT, lalu membukanya kembali sendiri" />
      )}

      {!d.routerOk && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex gap-2">
          <TriangleAlert size={18} className="shrink-0 text-red-600" />
          <span>Router tidak bisa dihubungi, jadi pengaturan di halaman ini belum tentu berlaku. {d.pesan}</span>
        </div>
      )}

      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile ikon={d.aktif ? "perisai" : "hadir"} color={d.aktif ? "amber" : "emerald"}
          value={d.aktif ? "Aktif" : "Tidak aktif"} label="Blokir saat ini" sorot={d.aktif} />
        <StatTile ikon="siswa" color={d.sedangUjian ? "primary" : "gray"} value={d.sedangUjian} label="Sedang mengerjakan ujian" />
        <StatTile ikon="daftar-centang" color={d.aturan ? "blue" : "gray"} value={d.aturan} label="Aturan terpasang di router" />
      </div>

      <div className="panel p-5 mb-5">
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <TriangleAlert size={16} className="shrink-0 text-amber-600" />
          <span>
            Pengaturan ini memengaruhi internet seluruh jaringan yang dipilih. Bawaannya <b>Mati</b> supaya tidak ada yang
            berubah tanpa sengaja. Guru dan tata usaha berada di jaringan berbeda, jadi tidak ikut terblokir selama
            daftar antarmuka di bawah hanya berisi jaringan siswa.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label-field">Mode</label>
            <Select value={mode} onChange={setMode} options={MODE} />
            <p className="mt-1 text-xs text-gray-500">
              <b>Otomatis</b> menyalakan blokir begitu ada peserta yang sedang mengerjakan, dan mematikannya kembali
              beberapa menit setelah peserta terakhir selesai — tidak memakai jadwal ujian, karena jendela ujian sekolah
              ini bisa terbuka berhari-hari.
            </p>
          </div>
          <div>
            <label className="label-field">Jaringan yang dibatasi</label>
            <input value={antarmuka} onChange={e => setAntarmuka(e.target.value)} className="input-field font-mono" placeholder="vlan30_SISWA" />
            <p className="mt-1 text-xs text-gray-500">Nama antarmuka di router, dipisah koma. Pastikan hanya jaringan siswa.</p>
          </div>
          <div>
            <label className="label-field">Menit tenggang setelah ujian selesai</label>
            <input value={tenggang} onChange={e => setTenggang(e.target.value.replace(/\D/g, ""))} className="input-field" inputMode="numeric" />
            <p className="mt-1 text-xs text-gray-500">Mencegah blokir mati-nyala saat peserta terakhir masih menyusul mengumpulkan.</p>
          </div>
          <div className="md:col-span-2">
            <label className="label-field">Situs yang ditutup selama ujian</label>
            <textarea value={host} onChange={e => setHost(e.target.value)} rows={3} className="input-field font-mono" />
            <p className="mt-1 text-xs text-gray-500">
              Pola nama situs dipisah koma (mis. <code>*youtube*</code>). Dicocokkan pada sapaan TLS, dan jalur QUIC ikut
              ditutup — tanpa itu YouTube memakai jalurnya sendiri dan lolos.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" disabled={sibuk} onClick={simpan} className="btn-modal-save">
            {sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan &amp; terapkan
          </button>
        </div>
      </div>

      <div className="panel p-5">
        <h3 className="font-heading font-semibold text-primary-900 text-sm mb-2 flex items-center gap-2">
          {d.aktif ? <ShieldCheck size={15} className="text-amber-600" /> : <ShieldOff size={15} className="text-gray-400" />}
          Cara kerjanya
        </h3>
        <ul className="space-y-1.5 text-sm text-gray-600">
          <li className="flex gap-2"><Users size={14} className="mt-0.5 shrink-0 text-gray-400" /> Sistem memeriksa tiap 2 menit apakah ada peserta yang sedang mengerjakan CBT.</li>
          <li className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-gray-400" /> Bila ada, aturan di router dinyalakan; bila tidak ada lagi, dimatikan kembali.</li>
          <li className="flex gap-2"><Network size={14} className="mt-0.5 shrink-0 text-gray-400" /> Aturannya dibuat sekali dan diberi tanda <code>SMK-UJIAN</code>. Aturan lain di router tidak pernah disentuh.</li>
        </ul>
      </div>
    </div>
  );
}
