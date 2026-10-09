import "server-only";
import { prisma } from "@/lib/prisma";
import { analisisSebaran } from "@/lib/analisis-sebaran";
import { buatPencocok } from "@/lib/cocok-sekolah";

/** POTENSI LULUSAN SMP/MTs (8 Oktober 2026, permintaan user: "data dari internet jumlah siswa SMP kelas IX per kecamatan
 *  maupun per sekolah"). Sumber: layanan terbuka situs resmi "Sekolah Kita" Kemendikdasmen — yang dipakai halaman
 *  publiknya sendiri, tanpa login. `dapo.kemendikdasmen.go.id` SENGAJA tidak dipakai: ia dipasangi penghalang robot.
 *
 *  - Data DISALIN ke tabel `PotensiSekolah` saat panitia menekan "Perbarui", TIDAK diambil tiap halaman dibuka: satu
 *    kabupaten = ratusan permintaan (satu per sekolah), dijalankan berurutan dengan jeda supaya tidak membebani sumber.
 *  - Hanya kabupaten/kota yang memang jadi asal siswa kita yang boleh diambil (`kabupatenBoleh`).
 *  - Angka = keadaan semester yang dilaporkan sekolah ke Dapodik (kolom `semester`), bukan hitungan kita. */
const B = "https://sekolah.data.kemendikdasmen.go.id/v1/sekolah-service";
const KEPALA = { "User-Agent": "Mozilla/5.0 (compatible; SMK-Al-Munawwir-SPMB/1.0)", "Content-Type": "application/json", Accept: "application/json" };
const jeda = (ms: number) => new Promise(r => setTimeout(r, ms));
const tanpaAwalan = (s: string) => (s ?? "").replace(/^(Kab\.|Kabupaten|Kec\.|Kecamatan|Prov\.)\s+/i, "").trim();
/** "Kabupaten Banyuwangi" (data wilayah kita) → "Kab. Banyuwangi" (penulisan sumber). "Kota X" tetap. */
export const namaKabSumber = (nama: string) => nama.replace(/^Kabupaten\s+/i, "Kab. ");

async function ambil(url: string, isi?: unknown) {
  const r = await fetch(url, { method: isi ? "POST" : "GET", headers: KEPALA, body: isi ? JSON.stringify(isi) : undefined, signal: AbortSignal.timeout(30_000), cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Dua kelompok sekolah: sasaran promosi (SMP/MTs) dan sekolah lanjutan (pesaing). Diambil & dihapus TERPISAH. */
export const KELOMPOK = { smp: ["SMP", "MTs"], lanjutan: ["SMK", "SMA", "MA"] } as const;
export type JenisPotensi = keyof typeof KELOMPOK;

export type KeadaanPotensi = { berjalan: boolean; jenis?: JenisPotensi; kab: string; selesai: number; total: number; galat: string; mulai: number; usai: number };
const g = globalThis as unknown as { __potensi?: KeadaanPotensi };
export const keadaanPotensi = (): KeadaanPotensi => g.__potensi ?? { berjalan: false, kab: "", selesai: 0, total: 0, galat: "", mulai: 0, usai: 0 };

/** Kabupaten/kota asal siswa kita (≥3 siswa terpetakan) — satu-satunya yang boleh diambil. */
export async function kabupatenBoleh(): Promise<{ nama: string; siswa: number }[]> {
  const a = await analisisSebaran();
  const m = new Map<string, number>();
  for (const k of a.kecamatan) m.set(k.kab, (m.get(k.kab) ?? 0) + k.total);
  return [...m].filter(x => x[1] >= 3).sort((x, y) => y[1] - x[1]).map(([nama, siswa]) => ({ nama, siswa }));
}

type BarisCari = { sekolah_id: string; npsn: string; nama: string; bentuk_pendidikan: string; status_sekolah: string; kecamatan: string };

/** Mulai menyalin satu kabupaten di LATAR. Mengembalikan false bila sedang ada yang berjalan atau kabupatennya tak diizinkan. */
export async function mulaiSegarkanPotensi(kabKita: string, jenis: JenisPotensi = "smp"): Promise<boolean> {
  if (keadaanPotensi().berjalan) return false;
  if (!(await kabupatenBoleh()).some(k => k.nama === kabKita)) return false;
  const st: KeadaanPotensi = { berjalan: true, jenis, kab: kabKita, selesai: 0, total: 0, galat: "", mulai: Date.now(), usai: 0 };
  g.__potensi = st;
  void (async () => {
    try {
      const sekolah: BarisCari[] = [];
      for (const bp of KELOMPOK[jenis]) {
        for (let hal = 0; hal < 40; hal++) {
          const d = await ambil(`${B}/sekolah/cari-sekolah`, { page: hal, size: 100, keyword: "", kabupaten_kota: namaKabSumber(kabKita), bentuk_pendidikan: bp, status_sekolah: "" });
          const isi: BarisCari[] = Array.isArray(d?.data) ? d.data : [];
          sekolah.push(...isi);
          await jeda(600);
          if (isi.length < 100) break;
        }
      }
      st.total = sekolah.length;
      if (!sekolah.length) throw new Error("Sumber tidak mengembalikan satu sekolah pun untuk kabupaten ini.");
      const kab = tanpaAwalan(kabKita);
      let gagalBeruntun = 0;
      const terlihat: string[] = [];
      for (const s of sekolah) {
        try {
          const [pd, rb, fd] = await Promise.all([
            ambil(`${B}/sekolah/peserta-didik/${encodeURIComponent(s.sekolah_id)}`).then(x => (Array.isArray(x?.data) ? x.data[0] : null) ?? {}),
            ambil(`${B}/sekolah/rombongan-belajar/${encodeURIComponent(s.sekolah_id)}`).then(x => (Array.isArray(x?.data) ? x.data[0] : null) ?? {}).catch(() => ({})),
            // Profil: alamat, kontak resmi, akreditasi, titik lokasi, jumlah guru — bahan persiapan kunjungan promosi.
            ambil(`${B}/sekolah/full-detail/${encodeURIComponent(s.sekolah_id)}`).then(x => x?.data ?? {}).catch(() => ({})),
          ]);
          const prof = ((fd as { sekolah?: Record<string, unknown>[] }).sekolah?.[0] ?? {}) as Record<string, unknown>;
          const ptk = ((fd as { ptk?: Record<string, unknown>[] }).ptk?.[0] ?? {}) as Record<string, unknown>;
          const t = (v: unknown, maks = 200) => (typeof v === "string" && v.trim() && v.trim() !== "-" ? v.trim().slice(0, maks) : null);
          const angka = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v !== 0 ? v : null);
          const n = (k: string) => Number(pd?.[k]) || 0;
          const data = {
            sekolahId: s.sekolah_id, nama: s.nama, bentuk: s.bentuk_pendidikan, status: s.status_sekolah, kabupaten: kab, kecamatan: tanpaAwalan(s.kecamatan),
            semester: typeof pd?.semester_id === "string" ? pd.semester_id : null,
            k7: n("pd_tkt_7_l") + n("pd_tkt_7_p"), k8: n("pd_tkt_8_l") + n("pd_tkt_8_p"), k9L: n("pd_tkt_9_l"), k9P: n("pd_tkt_9_p"),
            k10: n("pd_tkt_10_l") + n("pd_tkt_10_p"), k11: n("pd_tkt_11_l") + n("pd_tkt_11_p"), k12: n("pd_tkt_12_l") + n("pd_tkt_12_p"),
            rombel9: Number((rb as Record<string, unknown>)?.rombel_9) || 0, diambilAt: new Date(),
            alamat: [t(prof.alamat_jalan), t(prof.nama_dusun) && `Dusun ${t(prof.nama_dusun)}`].filter(Boolean).join(", ") || null,
            telepon: t(prof.nomor_telepon, 40) ?? t(prof.telepon, 40), email: t(prof.email, 120), website: t(prof.website, 160), akreditasi: t(prof.akreditasi, 20),
            lintang: angka(prof.lintang), bujur: angka(prof.bujur), guru: (Number(ptk.ptk_guru_l) || 0) + (Number(ptk.ptk_guru_p) || 0),
          };
          await prisma.potensiSekolah.upsert({ where: { npsn: s.npsn }, update: data, create: { npsn: s.npsn, ...data } });
          terlihat.push(s.npsn);
          gagalBeruntun = 0;
        } catch {
          if (++gagalBeruntun >= 8) throw new Error("Sumber berhenti menjawab — coba lagi nanti. Data yang sudah tersalin tetap dipakai.");
        }
        st.selesai++;
        await jeda(350);
      }
      // Sekolah yang sudah tidak ada di sumber dibuang — hanya bila putaran ini benar-benar tuntas.
      await prisma.potensiSekolah.deleteMany({ where: { kabupaten: kab, bentuk: { in: [...KELOMPOK[jenis]] }, npsn: { notIn: terlihat } } });
    } catch (e) {
      st.galat = e instanceof Error ? e.message : "Gagal mengambil data.";
    } finally {
      st.berjalan = false; st.usai = Date.now();
    }
  })();
  return true;
}

export type BarisPotensi = {
  npsn: string; nama: string; bentuk: string; status: string; kecamatan: string; semester: string | null;
  k7: number; k8: number; k9: number; k9L: number; k9P: number; rombel9: number;
  /** Siswa kita dari sekolah ini pada angkatan pembanding terbaru (jumlah) — null bila namanya tak bisa dicocokkan pasti. */
  kita: number | null; namaKita: string | null;
  alamat: string | null; telepon: string | null; email: string | null; website: string | null; akreditasi: string | null; guru: number;
  /** Jarak garis lurus dari sekolah kita (km) — null bila titik lokasinya tidak ada di sumber. */
  jarak: number | null; lintang: number | null; bujur: number | null;
  kepala: string | null; kontak: string | null; catatan: string | null; dikunjungi: string | null;
};

/** Titik sekolah kita (sama dengan penanda di Peta Sebaran). */
const KITA = { lintang: -8.2907167, bujur: 114.2072342 };
function jarakKm(lat: number | null, lng: number | null): number | null {
  if (lat === null || lng === null || Math.abs(lat) > 12 || lng < 94 || lng > 142) return null; // titik di luar Indonesia = salah isi
  const r = (x: number) => (x * Math.PI) / 180;
  const a = Math.sin(r(lat - KITA.lintang) / 2) ** 2 + Math.cos(r(KITA.lintang)) * Math.cos(r(lat)) * Math.sin(r(lng - KITA.bujur) / 2) ** 2;
  return Math.round(12742 * Math.asin(Math.sqrt(a)) * 10) / 10;
}
export type Potensi = { kab: string; baris: BarisPotensi[]; tahunKita: number[]; diambil: Date | null; kabTersalin: string[] };

const singgahCocok = new Map<string, { tanda: string; waktu: number; peta: Map<string, { n: number; nama: string }> }>();

export async function susunPotensi(kabKita: string): Promise<Potensi> {
  const [a, semua, tersalin] = await Promise.all([
    analisisSebaran(),
    prisma.potensiSekolah.findMany({ where: { kabupaten: tanpaAwalan(kabKita), bentuk: { in: [...KELOMPOK.smp] } }, orderBy: [{ kecamatan: "asc" }, { nama: "asc" }] }),
    prisma.potensiSekolah.groupBy({ by: ["kabupaten"] }).catch(() => []),
  ]);
  const tahunKita = a.periode.baru;
  // Pencocokan nama (ribuan pembandingan) disinggahkan 10 menit per kabupaten — tanpa ini tiap ganti saringan ±3 detik.
  // Kuncinya ikut jumlah baris & waktu salin terakhir, jadi "Perbarui" otomatis membuat singgahan baru.
  const tanda = `${semua.length}|${semua.reduce((t, s) => Math.max(t, s.diambilAt.getTime()), 0)}|${a.sekolah.length}`;
  let kita = singgahCocok.get(kabKita);
  if (!kita || kita.tanda !== tanda || Date.now() - kita.waktu > 10 * 60_000) {
    const cocok = buatPencocok(semua);
    const peta = new Map<string, { n: number; nama: string }>();
    for (const s of a.sekolah) {
      const c = cocok(s.nama);
      if (!c) continue;
      const x = peta.get(c.npsn) ?? { n: 0, nama: s.nama };
      x.n += tahunKita.reduce((t, th) => t + (s.perTahun[th] ?? 0), 0);
      peta.set(c.npsn, x);
    }
    kita = { tanda, waktu: Date.now(), peta };
    singgahCocok.set(kabKita, kita);
  }
  return {
    kab: kabKita, tahunKita, kabTersalin: tersalin.map(x => x.kabupaten),
    diambil: semua.reduce<Date | null>((t, s) => (!t || s.diambilAt > t ? s.diambilAt : t), null),
    baris: semua.map(s => ({
      npsn: s.npsn, nama: s.nama, bentuk: s.bentuk, status: s.status, kecamatan: s.kecamatan, semester: s.semester,
      k7: s.k7, k8: s.k8, k9: s.k9L + s.k9P, k9L: s.k9L, k9P: s.k9P, rombel9: s.rombel9,
      kita: kita.peta.get(s.npsn)?.n ?? null, namaKita: kita.peta.get(s.npsn)?.nama ?? null,
      alamat: s.alamat, telepon: s.telepon, email: s.email, website: s.website, akreditasi: s.akreditasi, guru: s.guru, jarak: jarakKm(s.lintang, s.bujur), lintang: s.lintang, bujur: s.bujur,
      kepala: s.kepala, kontak: s.kontak, catatan: s.catatan, dikunjungi: s.dikunjungi?.toISOString().slice(0, 10) ?? null,
    })),
  };
}

/** Saringan daftar potensi — SATU fungsi untuk layar, cetak, dan Excel supaya ketiganya selalu sama. */
/** `kec` boleh BEBERAPA kecamatan dipisah koma (permintaan user 8 Okt 2026). `urut`: ix (bawaan) | jarak | serapan. */
export type SaringPotensi = { kab?: string; kec?: string; jenjang?: string; status?: string; q?: string; urut?: string };
export function saringPotensi(p: Potensi, s: SaringPotensi) {
  const kecAda = new Set(p.baris.map(b => b.kecamatan));
  const kecPilih = (s.kec ?? "").split(",").map(x => x.trim()).filter(x => kecAda.has(x));
  const setKec = new Set(kecPilih);
  const jenjang = s.jenjang === "SMP" || s.jenjang === "MTs" ? s.jenjang : "";
  const status = s.status === "NEGERI" || s.status === "SWASTA" ? s.status : "";
  const urut = s.urut === "jarak" || s.urut === "serapan" ? s.urut : "ix";
  const q = (s.q ?? "").trim().toLowerCase().slice(0, 60);
  const tanpaKec = p.baris.filter(b => (!jenjang || b.bentuk === jenjang) && (!status || b.status.toUpperCase() === status) && (!q || b.nama.toLowerCase().includes(q) || b.npsn.includes(q)));
  const nTh = Math.max(1, p.tahunKita.length);
  const serap = (b: BarisPotensi) => (b.k9 > 0 ? (b.kita ?? 0) / nTh / b.k9 : 0);
  const baris = tanpaKec.filter(b => !setKec.size || setKec.has(b.kecamatan)).sort((a, b) =>
    urut === "jarak" ? (a.jarak ?? 9999) - (b.jarak ?? 9999) : urut === "serapan" ? serap(b) - serap(a) || b.k9 - a.k9 : b.k9 - a.k9);
  const perKec = new Map<string, { sekolah: number; k9: number; kita: number }>();
  for (const b of tanpaKec) {
    if (setKec.size && !setKec.has(b.kecamatan)) continue;
    const x = perKec.get(b.kecamatan) ?? { sekolah: 0, k9: 0, kita: 0 };
    x.sekolah++; x.k9 += b.k9; x.kita += b.kita ?? 0;
    perKec.set(b.kecamatan, x);
  }
  // Pilihan kecamatan (dengan jumlah kelas IX setelah saringan lain) — selalu SEMUA kecamatan, supaya bisa ditambah.
  const pilihanKec = new Map<string, number>();
  for (const b of tanpaKec) pilihanKec.set(b.kecamatan, (pilihanKec.get(b.kecamatan) ?? 0) + b.k9);
  const keterangan = [kecPilih.length && `Kecamatan ${kecPilih.join(", ")}`, jenjang, status && (status === "NEGERI" ? "negeri" : "swasta"), q && `nama memuat "${q}"`].filter(Boolean).join(" · ");
  return { kecPilih, kec: kecPilih.join(","), satuKec: kecPilih.length === 1, jenjang, status, q, urut, baris,
    kecUrut: [...perKec].sort((a, b) => b[1].k9 - a[1].k9), pilihanKec: [...pilihanKec].sort((a, b) => b[1] - a[1]), keterangan };
}

/** PETA PERSAINGAN (9 Oktober 2026) — HANYA angka pasti: lulusan tiap SMP/MTs, kelas X/XI/XII tiap sekolah lanjutan, dan
 *  siswa yang masuk ke kita. TIDAK ada tabel "dari SMP A ke sekolah X": data terbuka tidak memuat asal SMP siswa sekolah
 *  lain, dan memodelkannya tanpa satu pun angka pembanding menghasilkan tebakan yang tampak presisi (keputusan user:
 *  rekomendasi B). Jurusan pesaing juga TIDAK dipakai — sumber hanya menyebut satu jurusan per sekolah (terbukti salah untuk
 *  sekolah kita sendiri). */
export type BarisPesaing = {
  npsn: string; nama: string; bentuk: string; status: string; kecamatan: string; akreditasi: string | null;
  k10: number; k11: number; k12: number; jarak: number | null; lintang: number | null; bujur: number | null;
  /** Arah penerimaan dari kelas XII (2 tahun lalu) ke kelas X (tahun ini): ≥15% berubah & selisih ≥10 siswa. */
  arah: "naik" | "turun" | "tetap"; kita: boolean;
};
export type RekapKecamatan = { nama: string; lulusan: number; kursi: number; sekolahLanjutan: number; terbesar: string | null; kita: number };
export type BarisProyeksi = { nama: string; sekolah: number; k9: number; k8: number; k7: number; arah: "naik" | "turun" | "tetap" };
export type Persaingan = {
  kab: string; kodeKab: string | null; adaLanjutan: boolean; diambil: Date | null;
  pesaing: BarisPesaing[]; kita: BarisPesaing | null; smp: BarisPotensi[]; perKec: RekapKecamatan[]; proyeksi: BarisProyeksi[]; nTahun: number;
};

const arahDari = (lama: number, baru: number): "naik" | "turun" | "tetap" =>
  !lama || Math.abs(baru - lama) < 10 ? "tetap" : baru >= lama * 1.15 ? "naik" : baru <= lama * 0.85 ? "turun" : "tetap";

export async function susunPersaingan(kabKita: string, npsnKita: string): Promise<Persaingan> {
  const [p, lanjutan, a] = await Promise.all([
    susunPotensi(kabKita),
    prisma.potensiSekolah.findMany({ where: { kabupaten: tanpaAwalan(kabKita), bentuk: { in: [...KELOMPOK.lanjutan] } } }),
    analisisSebaran(),
  ]);
  const semua: BarisPesaing[] = lanjutan.map(s => ({
    npsn: s.npsn, nama: s.nama, bentuk: s.bentuk, status: s.status, kecamatan: s.kecamatan, akreditasi: s.akreditasi,
    k10: s.k10, k11: s.k11, k12: s.k12, jarak: jarakKm(s.lintang, s.bujur), lintang: s.lintang, bujur: s.bujur,
    arah: arahDari(s.k12, s.k10), kita: !!npsnKita && s.npsn === npsnKita,
  }));
  const nTh = Math.max(1, p.tahunKita.length);
  const kec = new Map<string, RekapKecamatan & { maks: number }>();
  const ambil = (n: string) => { if (!kec.has(n)) kec.set(n, { nama: n, lulusan: 0, kursi: 0, sekolahLanjutan: 0, terbesar: null, kita: 0, maks: 0 }); return kec.get(n)!; };
  for (const b of p.baris) { const k = ambil(b.kecamatan); k.lulusan += b.k9; k.kita += (b.kita ?? 0) / nTh; }
  for (const b of semua) {
    const k = ambil(b.kecamatan);
    k.kursi += b.k10; k.sekolahLanjutan++;
    if (!b.kita && b.k10 > k.maks) { k.maks = b.k10; k.terbesar = `${b.nama} (${b.k10})`; }
  }
  const pro = new Map<string, BarisProyeksi>();
  for (const b of p.baris) {
    const x = pro.get(b.kecamatan) ?? { nama: b.kecamatan, sekolah: 0, k9: 0, k8: 0, k7: 0, arah: "tetap" as const };
    x.sekolah++; x.k9 += b.k9; x.k8 += b.k8; x.k7 += b.k7;
    pro.set(b.kecamatan, x);
  }
  const waktu = [...lanjutan.map(s => s.diambilAt.getTime()), p.diambil?.getTime() ?? 0];
  return {
    kab: kabKita, kodeKab: a.kecamatan.find(w => w.kab === kabKita)?.kode.slice(0, 5) ?? null,
    adaLanjutan: lanjutan.length > 0, diambil: Math.max(...waktu) ? new Date(Math.max(...waktu)) : null,
    pesaing: semua.filter(b => !b.kita).sort((x, y) => y.k10 - x.k10), kita: semua.find(b => b.kita) ?? null, smp: p.baris,
    perKec: [...kec.values()].map(({ maks: _m, ...k }) => ({ ...k, kita: Math.round(k.kita * 10) / 10 })).sort((x, y) => y.lulusan - x.lulusan),
    proyeksi: [...pro.values()].map(x => ({ ...x, arah: arahDari(x.k9, x.k7) })).sort((x, y) => y.k9 - x.k9),
    nTahun: nTh,
  };
}

