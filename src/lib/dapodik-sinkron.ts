import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { panggilDapodik } from "@/lib/dapodik";
import {
  DICOCOKKAN_MANUAL, NAMA_SAJA, NAMA_TANPA_GELAR,
  type BarisSinkron, type CalonPasangan, type IsianKurang, type KelasTuSinkron, type PratinjauDapodik, type RingkasanSinkron,
  type RombelSinkron, type StatusSinkron, type TemuanBeda,
} from "@/lib/dapodik-jenis";

/** SINKRON DAPODIK — ARAH DATA: data TU di situs adalah ACUAN, Dapodik yang disamakan (keputusan user 14 Sep 2026).
 * Modul ini hanya MEMBACA Dapodik lalu menyusun daftar untuk operator Dapodik: nilai yang berbeda dari data TU, isian TU
 * yang belum ada di Dapodik, siswa/guru TU yang belum terdaftar, serta data Dapodik yang tidak ada / sudah keluar di TU.
 * Tidak ada yang ditulis ke Dapodik maupun ke data situs. Kolom yang kosong di data TU hanya DITANDAI supaya dilengkapi
 * TU dari berkas aslinya — jangan menambah tombol yang menyalin data Dapodik ke situs.
 *
 * Pasangan yang DICOCOKKAN MANUAL oleh operator (tabel DapodikPasangan, 17 Sep 2026) dipakai paling dulu.
 * Sesudahnya pasangan bertingkat; di setiap tingkat nilainya wajib TUNGGAL di kedua sisi (dua siswa ber-NIK sama tidak dipasangkan):
 *   siswa: NISN → NIK → NIS = NIPD (angka saja) → nama + tanggal lahir → nama saja (siswa aktif tanpa tanggal lahir)
 *   GTK:   NIK → NUPTK → NIP → nama tanpa gelar
 * Tingkat kelas hanya dibandingkan bila semester Dapodik = tahun ajaran aktif TU (Dapodik sering tertinggal semester). */

type Obj = Record<string, unknown>;

const teks = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
/** Nilai tanpa huruf/angka bermakna ("-", "0", "000…") dianggap kosong. */
const isi = (v: unknown) => { const t = teks(v); return /[A-Za-z1-9]/.test(t) ? t : ""; };
const angka = (v: unknown) => { const t = teks(v).replace(/\D/g, ""); return /[1-9]/.test(t) ? t : ""; };
const hanyaAngka = (v: string) => v.replace(/\D/g, "");
/** NISN sering kehilangan nol di depan saat lewat Excel — dibandingkan tanpa nol depan. */
const tanpaNolDepan = (v: string) => hanyaAngka(v).replace(/^0+/, "");
const objek = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});

const tanggalIso = (v: unknown): string => {
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  const m = teks(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m && m[1] !== "0000" ? `${m[1]}-${m[2]}-${m[3]}` : "";
};
const tampilTanggal = (iso: string) => iso
  ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  : "";
const tampilJk = (v: string) => (v === "L" ? "Laki-laki" : v === "P" ? "Perempuan" : v);
const ROMAWI: Record<string, string> = { "10": "X", "11": "XI", "12": "XII" };

const GELAR_DEPAN = new Set(["drs", "dra", "dr", "ir", "h", "hj", "kh", "prof", "ust", "ustadz", "ustadzah"]);

/** Bentuk nama untuk DICOCOKKAN, bukan ditampilkan: huruf kecil, tanpa tanda baca/diakritik. `buangGelar` membuang
 * gelar di belakang koma dan gelar bertitik (S.Pd, Drs., H.) — dipakai untuk GTK. */
export function kunciNama(v: unknown, buangGelar = false): string {
  let t = teks(v).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/['`’‘]/g, "");
  if (buangGelar) {
    t = t.replace(/,.*$/, "").split(/\s+/).filter(k => !/^[A-Za-z]{1,4}\.(?:[A-Za-z]{1,4}\.?)*$/.test(k)).join(" ");
  }
  const kata = t.toLowerCase().replace(/[^a-z]+/g, " ").split(" ").filter(Boolean);
  return (buangGelar ? kata.filter(k => !GELAR_DEPAN.has(k)) : kata).join(" ");
}

function labelSemester(id: string) {
  const m = id.match(/^(\d{4})([12])$/);
  return m ? `${m[1]}/${Number(m[1]) + 1} ${m[2] === "1" ? "Ganjil" : "Genap"}` : id || "—";
}

const STATUS_SISWA: Record<string, string> = { LULUS: "Lulus", KELUAR: "Keluar", PINDAH: "Pindah" };
const STATUS_GURU: Record<string, string> = { PENSIUN: "Pensiun", KELUAR: "Keluar" };

interface Kolom<S> {
  key: string; label: string;
  /** Nilai menurut data TU (acuan). Kosong = TU belum mengisi. */
  tu: (s: S) => string;
  /** Nilai menurut Dapodik. Kosong = belum diisi operator. */
  dapodik: (d: Obj) => string;
  banding?: (v: string) => string;
  tampil?: (v: string) => string;
  /** Kosong di TU bukan kekurangan data TU (mis. tingkat kelas untuk siswa yang sudah keluar). */
  abaikanKosongTu?: boolean;
}
interface Tingkat<S> { dasar: string; tu: (s: S) => string; dapodik: (d: Obj) => string }

const PILIH_SISWA = {
  id: true, nis: true, nisn: true, birthPlace: true, birthDate: true, gender: true, religion: true,
  bukuIndukData: true, studentStatus: true,
  user: { select: { name: true } }, class: { select: { id: true, name: true, grade: true } },
} as const;
type SiswaTu = Prisma.StudentGetPayload<{ select: typeof PILIH_SISWA }>;

const PILIH_GURU = {
  id: true, nip: true, position: true, birthPlace: true, birthDate: true, gender: true, religion: true,
  bukuIndukData: true, teacherStatus: true, user: { select: { name: true } },
} as const;
type GuruTu = Prisma.TeacherGetPayload<{ select: typeof PILIH_GURU }>;

const bi = (s: { bukuIndukData: unknown }, k: string) => isi(objek(s.bukuIndukData)[k]);

type Biodata = { birthPlace: string | null; birthDate: Date | null; gender: string | null; religion: string | null };

function kolomBiodata<S extends Biodata>(): Kolom<S>[] {
  return [
    { key: "tempatLahir", label: "Tempat Lahir", tu: s => isi(s.birthPlace), dapodik: d => isi(d.tempat_lahir), banding: v => kunciNama(v) },
    { key: "tanggalLahir", label: "Tanggal Lahir", tu: s => tanggalIso(s.birthDate), dapodik: d => tanggalIso(d.tanggal_lahir), tampil: tampilTanggal },
    { key: "jk", label: "Jenis Kelamin", tu: s => isi(s.gender).toUpperCase(), dapodik: d => isi(d.jenis_kelamin).toUpperCase(), tampil: tampilJk },
    { key: "agama", label: "Agama", tu: s => isi(s.religion), dapodik: d => isi(d.agama_id_str), banding: v => v.toLowerCase() },
  ];
}

const aktifSiswa = (s: SiswaTu) => (s.studentStatus ?? "AKTIF") === "AKTIF";
const ketSiswa = (s: SiswaTu) => aktifSiswa(s)
  ? (s.class?.name ?? "Tanpa kelas")
  : (STATUS_SISWA[s.studentStatus ?? ""] ?? teks(s.studentStatus));
const aktifGuru = (s: GuruTu) => (s.teacherStatus ?? "AKTIF") === "AKTIF";
const ketGuru = (s: GuruTu) => aktifGuru(s)
  ? (isi(s.position) || "Guru")
  : (STATUS_GURU[s.teacherStatus ?? ""] ?? teks(s.teacherStatus));
const minimal = (n: number, v: string) => (v.length >= n ? v : "");

function kolomSiswa(bandingkanTingkat: boolean): Kolom<SiswaTu>[] {
  const tingkat: Kolom<SiswaTu> = {
    key: "tingkat", label: "Tingkat Kelas", abaikanKosongTu: true,
    tu: s => (aktifSiswa(s) && s.class ? String(s.class.grade) : ""),
    dapodik: d => angka(d.tingkat_pendidikan_id),
    tampil: v => `Kelas ${ROMAWI[v] ?? v}`,
  };
  return [
    { key: "nama", label: "Nama", tu: s => isi(s.user.name), dapodik: d => isi(d.nama), banding: v => kunciNama(v) },
    { key: "nisn", label: "NISN", tu: s => isi(s.nisn), dapodik: d => angka(d.nisn), banding: tanpaNolDepan },
    { key: "nik", label: "NIK", tu: s => bi(s, "nik"), dapodik: d => angka(d.nik), banding: hanyaAngka },
    ...kolomBiodata<SiswaTu>(),
    { key: "ayah", label: "Nama Ayah", tu: s => bi(s, "fatherName"), dapodik: d => isi(d.nama_ayah), banding: v => kunciNama(v) },
    { key: "ibu", label: "Nama Ibu", tu: s => bi(s, "motherName"), dapodik: d => isi(d.nama_ibu), banding: v => kunciNama(v) },
    ...(bandingkanTingkat ? [tingkat] : []),
  ];
}

const KOLOM_GURU: Kolom<GuruTu>[] = [
  { key: "nama", label: "Nama", tu: s => isi(s.user.name), dapodik: d => isi(d.nama), banding: v => kunciNama(v, true) },
  { key: "nik", label: "NIK", tu: s => bi(s, "nik"), dapodik: d => angka(d.nik), banding: hanyaAngka },
  { key: "nuptk", label: "NUPTK", tu: s => bi(s, "nuptk"), dapodik: d => angka(d.nuptk), banding: hanyaAngka },
  ...kolomBiodata<GuruTu>(),
];

const TINGKAT_SISWA: Tingkat<SiswaTu>[] = [
  { dasar: "NISN", tu: s => tanpaNolDepan(angka(s.nisn)), dapodik: d => tanpaNolDepan(angka(d.nisn)) },
  { dasar: "NIK", tu: s => angka(bi(s, "nik")), dapodik: d => angka(d.nik) },
  { dasar: "NIS = NIPD", tu: s => minimal(6, angka(s.nis)), dapodik: d => minimal(6, angka(d.nipd)) },
  {
    dasar: "Nama + tanggal lahir",
    tu: s => { const t = tanggalIso(s.birthDate); return t ? `${kunciNama(s.user.name)}|${t}` : ""; },
    dapodik: d => { const t = tanggalIso(d.tanggal_lahir); return t ? `${kunciNama(d.nama)}|${t}` : ""; },
  },
  // Paling lemah: hanya siswa aktif yang tanggal lahirnya belum diisi di TU.
  { dasar: NAMA_SAJA, tu: s => (aktifSiswa(s) && !s.birthDate ? kunciNama(s.user.name) : ""), dapodik: d => kunciNama(d.nama) },
];

const TINGKAT_GURU: Tingkat<GuruTu>[] = [
  { dasar: "NIK", tu: s => angka(bi(s, "nik")), dapodik: d => angka(d.nik) },
  { dasar: "NUPTK", tu: s => angka(bi(s, "nuptk")), dapodik: d => angka(d.nuptk) },
  { dasar: "NIP", tu: s => minimal(18, angka(s.nip)), dapodik: d => minimal(18, angka(d.nip)) },
  { dasar: NAMA_TANPA_GELAR, tu: s => kunciNama(s.user.name, true), dapodik: d => kunciNama(d.nama, true) },
];

function pasangkan<S extends { id: string }>(
  tu: S[], dapodik: Obj[], tingkat: Tingkat<S>[], manual: Map<string, string>, idDapodik: (d: Obj) => string,
) {
  const pasangan = new Map<number, { s: S; dasar: string }>();
  const terpakai = new Set<string>();
  // Pasangan manual operator: kunci = id Dapodik, nilai = id data TU.
  if (manual.size) {
    const perId = new Map(tu.map(s => [s.id, s]));
    dapodik.forEach((d, i) => {
      const tuId = manual.get(idDapodik(d));
      const s = tuId ? perId.get(tuId) : undefined;
      if (!s || terpakai.has(s.id)) return;
      pasangan.set(i, { s, dasar: DICOCOKKAN_MANUAL });
      terpakai.add(s.id);
    });
  }
  for (const t of tingkat) {
    const indeks = new Map<string, S[]>();
    for (const s of tu) {
      if (terpakai.has(s.id)) continue;
      const v = t.tu(s);
      if (!v) continue;
      const ada = indeks.get(v);
      if (ada) ada.push(s); else indeks.set(v, [s]);
    }
    const jumlahDapodik = new Map<string, number>();
    dapodik.forEach((d, i) => {
      if (pasangan.has(i)) return;
      const v = t.dapodik(d);
      if (v) jumlahDapodik.set(v, (jumlahDapodik.get(v) ?? 0) + 1);
    });
    dapodik.forEach((d, i) => {
      if (pasangan.has(i)) return;
      const v = t.dapodik(d);
      const calon = v ? indeks.get(v) : undefined;
      if (!calon || calon.length !== 1 || jumlahDapodik.get(v) !== 1 || terpakai.has(calon[0].id)) return;
      pasangan.set(i, { s: calon[0], dasar: t.dasar });
      terpakai.add(calon[0].id);
    });
  }
  return { pasangan, terpakai };
}

const URUTAN: Record<StatusSinkron, number> = { perbaiki: 0, belumDiDapodik: 1, tidakAdaDiTu: 2, keluarDiTu: 3, sesuai: 4 };

function susunBaris<S extends { id: string }>(o: {
  jenis: "siswa" | "gtk";
  tu: S[]; dapodik: Obj[]; tingkat: Tingkat<S>[]; kolom: Kolom<S>[];
  nama: (s: S) => string; ketTu: (s: S) => string; aktif: (s: S) => boolean;
  identitasTu: (s: S) => string; identitasDapodik: (d: Obj) => string; ketDapodik: (d: Obj) => string;
  idDapodik: (d: Obj) => string; manual: Map<string, string>;
}) {
  const { pasangan, terpakai } = pasangkan(o.tu, o.dapodik, o.tingkat, o.manual, o.idDapodik);
  const calonDapodik: CalonPasangan[] = [];
  const sebutan = o.jenis === "siswa" ? "peserta didik" : "PTK";
  const baris: BarisSinkron[] = [];
  const berpasangan: { s: S; d: Obj }[] = [];

  o.dapodik.forEach((d, i) => {
    const p = pasangan.get(i);
    if (!p) {
      const dapodikId = o.idDapodik(d);
      if (dapodikId) calonDapodik.push({ id: dapodikId, nama: isi(d.nama) || "—", ket: [o.identitasDapodik(d), o.ketDapodik(d)].filter(Boolean).join(" · ") });
      baris.push({
        kunci: `d:${i}`, status: "tidakAdaDiTu", tuId: null, dapodikId: dapodikId || null, dasar: null, nama: isi(d.nama) || "—", identitas: o.identitasDapodik(d) || null,
        tu: null, dapodik: o.ketDapodik(d) || null, aktifDiTu: null, beda: [], kurangDiDapodik: [], kurangDiTu: [],
        tindakan: `Tidak ditemukan di data TU — tanyakan ke TU; bila memang sudah tidak di sekolah, keluarkan ${sebutan} ini dari Dapodik`,
      });
      return;
    }
    berpasangan.push({ s: p.s, d });
    const beda: TemuanBeda[] = [];
    const kurangDiDapodik: IsianKurang[] = [];
    const kurangDiTu: string[] = [];
    for (const k of o.kolom) {
      const a = k.tu(p.s), b = k.dapodik(d);
      if (!a) { if (!k.abaikanKosongTu) kurangDiTu.push(k.label); continue; }
      const tampil = k.tampil ?? ((v: string) => v);
      if (!b) { kurangDiDapodik.push({ key: k.key, label: k.label, nilai: tampil(a) }); continue; }
      const banding = k.banding ?? ((v: string) => v);
      if (banding(a) !== banding(b)) beda.push({ key: k.key, label: k.label, tu: tampil(a), dapodik: tampil(b) });
    }

    const aktif = o.aktif(p.s);
    let status: StatusSinkron = "sesuai";
    let tindakan: string | null = null;
    if (!aktif) {
      const ket = o.ketTu(p.s);
      status = "keluarDiTu";
      tindakan = `Di data TU berstatus ${ket} — proses ${o.jenis === "gtk" ? "PTK keluar" : ket === "Lulus" ? "kelulusan" : "mutasi keluar"} di Dapodik`;
    } else if (beda.length || kurangDiDapodik.length) {
      status = "perbaiki";
      const langkah = [
        beda.length ? `samakan ${beda.map(t => t.label).join(", ")} dengan data TU` : "",
        kurangDiDapodik.length ? `lengkapi ${kurangDiDapodik.map(t => t.label).join(", ")}` : "",
      ].filter(Boolean).join("; ");
      tindakan = p.dasar === NAMA_SAJA || p.dasar === NAMA_TANPA_GELAR ? `Cocok lewat nama saja — pastikan orangnya sama, lalu ${langkah}` : `Di Dapodik: ${langkah}`;
    }
    baris.push({
      kunci: p.s.id, status, tuId: p.s.id, dapodikId: o.idDapodik(d) || null, dasar: p.dasar, nama: o.nama(p.s), identitas: o.identitasTu(p.s) || null,
      tu: o.ketTu(p.s), dapodik: o.ketDapodik(d) || null, aktifDiTu: aktif, beda, kurangDiDapodik, kurangDiTu, tindakan,
    });
  });

  const calonTu: CalonPasangan[] = [];
  for (const s of o.tu) {
    if (terpakai.has(s.id)) continue;
    calonTu.push({ id: s.id, nama: o.nama(s), ket: [o.identitasTu(s), o.ketTu(s)].filter(Boolean).join(" · ") });
    if (!o.aktif(s)) continue;
    baris.push({
      kunci: s.id, status: "belumDiDapodik", tuId: s.id, dapodikId: null, dasar: null, nama: o.nama(s), identitas: o.identitasTu(s) || null, tu: o.ketTu(s),
      dapodik: null, aktifDiTu: true, beda: [], kurangDiDapodik: [], kurangDiTu: [],
      tindakan: `Belum ada di Dapodik — tambahkan ${sebutan} sesuai data TU`,
    });
  }
  baris.sort((a, b) => URUTAN[a.status] - URUTAN[b.status] || a.nama.localeCompare(b.nama, "id"));
  calonTu.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  calonDapodik.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  return { baris, berpasangan, calonTu, calonDapodik };
}

function ringkas(baris: BarisSinkron[], dapodik: number, tuAktif: number): RingkasanSinkron {
  const n = (f: (b: BarisSinkron) => boolean) => baris.filter(f).length;
  return {
    dapodik, tuAktif,
    berpasangan: n(b => b.status === "sesuai" || b.status === "perbaiki" || b.status === "keluarDiTu"),
    sesuai: n(b => b.status === "sesuai"),
    perbaiki: n(b => b.status === "perbaiki"),
    keluarDiTu: n(b => b.status === "keluarDiTu"),
    belumDiDapodik: n(b => b.status === "belumDiDapodik"),
    tidakAdaDiTu: n(b => b.status === "tidakAdaDiTu"),
    tuBelumLengkap: n(b => b.kurangDiTu.length > 0),
  };
}

/** Satu daftar dari Dapodik. Galat sesaat (halaman HTML / HTTP 5xx) dicoba lagi sekali setelah jeda; penolakan akses dan
 * komputer yang tak terjangkau tidak diulang. */
async function ambilDaftar(endpoint: string): Promise<{ ok: true; rows: Obj[] } | { ok: false; pesan: string }> {
  for (let coba = 1; ; coba++) {
    const h = await panggilDapodik<Obj>(endpoint, {}, 45_000);
    if (h.ok) {
      const rows = h.data?.rows;
      if (!Array.isArray(rows)) return { ok: false, pesan: `${endpoint}: jawaban Dapodik tidak berisi daftar.` };
      return { ok: true, rows: rows.filter((r): r is Obj => !!r && typeof r === "object" && !Array.isArray(r)) };
    }
    const sesaat = h.http >= 500 || /halaman galat/.test(h.pesan);
    if (!sesaat || coba >= 2) return { ok: false, pesan: `${endpoint}: ${h.pesan}` };
    await new Promise(selesai => setTimeout(selesai, 2000));
  }
}

const urutSebaran = (m?: Map<string, number>) =>
  [...(m ?? new Map<string, number>())].map(([label, jumlah]) => ({ label, jumlah })).sort((a, b) => b.jumlah - a.jumlah);

/** SINGGAHAN TIGA DAFTAR DAPODIK (20 September 2026).
 *
 * Satu pratinjau = tiga panggilan Dapodik yang WAJIB berurutan, dan lamanya berubah-ubah: terukur
 * 20–47 detik. Bila proxy di depan aplikasi punya batas tunggu lebih pendek, permintaan tunggal
 * yang panjang itu jadi 502 (laporan user 20 September 2026). Maka halaman kini memanggilnya PER
 * LANGKAH — tiap permintaan cuma satu daftar (±15 detik), hasilnya disinggahkan di sini, lalu
 * langkah terakhir membandingkan dari singgahan tanpa menyentuh Dapodik lagi.
 * Singgahan juga membuat buka-ulang halaman terasa seketika. */
const UMUR_SINGGAHAN_MS = 10 * 60_000;
type Singgahan = { rows: Obj[]; pada: number };
const singgahan = new Map<string, Singgahan>();

const ENDPOINT_LANGKAH: Record<string, string> = {
  pd: "getPesertaDidik", gtk: "getGtk", rombel: "getRombonganBelajar",
};

function dariSinggahan(kunci: string): Obj[] | null {
  const c = singgahan.get(kunci);
  if (!c || Date.now() - c.pada > UMUR_SINGGAHAN_MS) return null;
  return c.rows;
}

/** Ambil SATU daftar Dapodik (dipakai per langkah oleh halaman). `segar` memaksa panggil ulang. */
export async function ambilLangkahDapodik(langkah: string, segar = false): Promise<{ ok: true; jumlah: number } | { ok: false; pesan: string }> {
  const endpoint = ENDPOINT_LANGKAH[langkah];
  if (!endpoint) return { ok: false, pesan: "Langkah tidak dikenal." };
  if (!segar) {
    const ada = dariSinggahan(langkah);
    if (ada) return { ok: true, jumlah: ada.length };
  }
  const h = await ambilDaftar(endpoint);
  if (!h.ok) return h;
  singgahan.set(langkah, { rows: h.rows, pada: Date.now() });
  return { ok: true, jumlah: h.rows.length };
}

export async function bandingkanDapodik(): Promise<{ ok: false; pesan: string } | { ok: true; data: PratinjauDapodik }> {
  // BERURUTAN, bukan paralel: Web Service Dapodik membalas halaman galat HTML bila tiga daftar diminta
  // sekaligus (terbukti 15 Sep 2026). Yang sudah ada di singgahan tidak dipanggil ulang.
  const ambil = async (kunci: string) => {
    const ada = dariSinggahan(kunci);
    if (ada) return { ok: true as const, rows: ada };
    const h = await ambilDaftar(ENDPOINT_LANGKAH[kunci]);
    if (h.ok) singgahan.set(kunci, { rows: h.rows, pada: Date.now() });
    return h;
  };
  const pd = await ambil("pd");
  if (!pd.ok) return pd;
  const gtk = await ambil("gtk");
  if (!gtk.ok) return gtk;
  const rb = await ambil("rombel");
  if (!rb.ok) return rb;

  const [siswaTu, guruTu, kelas, tahun, manual] = await Promise.all([
    prisma.student.findMany({ select: PILIH_SISWA }),
    prisma.teacher.findMany({ select: PILIH_GURU }),
    prisma.class.findMany({
      select: { id: true, name: true, _count: { select: { students: { where: { studentStatus: "AKTIF" } } } } },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
    prisma.academicYear.findFirst({ where: { isActive: true }, select: { name: true } }),
    prisma.dapodikPasangan.findMany({ select: { jenis: true, tuId: true, dapodikId: true } }),
  ]);
  const manualUntuk = (jenis: string) => new Map(manual.filter(m => m.jenis === jenis).map(m => [m.dapodikId, m.tuId]));

  const semesterId = teks(pd.rows[0]?.semester_id);
  const semester = labelSemester(semesterId);
  const tahunTu = tahun?.name ?? null;
  const semesterBeda = !!(tahunTu && /^\d{5}$/.test(semesterId) && !semester.startsWith(tahunTu));

  const siswa = susunBaris<SiswaTu>({
    jenis: "siswa", tu: siswaTu, dapodik: pd.rows, tingkat: TINGKAT_SISWA, kolom: kolomSiswa(!semesterBeda),
    nama: s => isi(s.user.name) || "—", ketTu: ketSiswa, aktif: aktifSiswa,
    identitasTu: s => (isi(s.nisn) ? `NISN ${isi(s.nisn)}` : `NIS ${teks(s.nis)}`),
    identitasDapodik: d => (angka(d.nisn) ? `NISN ${angka(d.nisn)}` : isi(d.nipd) ? `NIPD ${isi(d.nipd)}` : ""),
    ketDapodik: d => isi(d.nama_rombel),
    idDapodik: d => teks(d.peserta_didik_id), manual: manualUntuk("siswa"),
  });
  const guru = susunBaris<GuruTu>({
    jenis: "gtk", tu: guruTu, dapodik: gtk.rows, tingkat: TINGKAT_GURU, kolom: KOLOM_GURU,
    nama: s => isi(s.user.name) || "—", ketTu: ketGuru, aktif: aktifGuru,
    identitasTu: s => (bi(s, "nuptk") ? `NUPTK ${bi(s, "nuptk")}` : ""),
    identitasDapodik: d => (angka(d.nuptk) ? `NUPTK ${angka(d.nuptk)}` : ""),
    ketDapodik: d => [isi(d.jenis_ptk_id_str), isi(d.status_kepegawaian_id_str)].filter(Boolean).join(" · "),
    idDapodik: d => teks(d.ptk_id), manual: manualUntuk("gtk"),
  });

  // Kelas TU (acuan) → rombel Dapodik tempat siswa aktifnya tercatat; rombel Dapodik → posisi anggotanya di TU.
  const rombelDapodik = new Map<string, string>();
  const posisiTu = new Map<string, string>();
  for (const p of siswa.berpasangan) {
    rombelDapodik.set(p.s.id, isi(p.d.nama_rombel) || "Tanpa rombel");
    posisiTu.set(teks(p.d.peserta_didik_id), ketSiswa(p.s));
  }
  const perKelas = new Map<string, Map<string, number>>();
  for (const s of siswaTu) {
    if (!aktifSiswa(s) || !s.class) continue;
    const label = rombelDapodik.get(s.id) ?? "Belum ada di Dapodik";
    const m = perKelas.get(s.class.id) ?? new Map<string, number>();
    m.set(label, (m.get(label) ?? 0) + 1);
    perKelas.set(s.class.id, m);
  }
  const kelasTu: KelasTuSinkron[] = kelas.map(k => ({
    id: k.id, nama: k.name, siswaAktif: k._count.students, sebaran: urutSebaran(perKelas.get(k.id)),
  }));

  const adaDiPd = new Set(pd.rows.map(d => teks(d.peserta_didik_id)));
  const daftar: RombelSinkron[] = rb.rows.map((r, i) => {
    const anggota = Array.isArray(r.anggota_rombel) ? r.anggota_rombel.map(objek) : [];
    const hitung = new Map<string, number>();
    for (const a of anggota) {
      const id = teks(a.peserta_didik_id);
      const label = posisiTu.get(id) ?? (adaDiPd.has(id) ? "Tidak ada di data TU" : "Tidak ada di daftar peserta didik");
      hitung.set(label, (hitung.get(label) ?? 0) + 1);
    }
    return {
      id: teks(r.rombongan_belajar_id) || `r${i}`, nama: isi(r.nama) || "—", tingkat: teks(r.tingkat_pendidikan_id),
      jurusan: isi(r.jurusan_id_str), wali: isi(r.ptk_id_str), anggota: anggota.length, sebaran: urutSebaran(hitung),
    };
  }).sort((a, b) => Number(a.tingkat) - Number(b.tingkat) || a.nama.localeCompare(b.nama, "id"));

  return {
    ok: true,
    data: {
      semester, tahunTu, semesterBeda, diambil: new Date().toISOString(),
      siswa: {
        ringkasan: ringkas(siswa.baris, pd.rows.length, siswaTu.filter(aktifSiswa).length), baris: siswa.baris,
        calonTu: siswa.calonTu, calonDapodik: siswa.calonDapodik,
      },
      gtk: {
        ringkasan: ringkas(guru.baris, gtk.rows.length, guruTu.filter(aktifGuru).length), baris: guru.baris,
        calonTu: guru.calonTu, calonDapodik: guru.calonDapodik,
      },
      rombel: { kelasTu, daftar },
    },
  };
}
