import "server-only";
import { prisma } from "@/lib/prisma";

/** DENAH RUANG UJIAN — pembagian peserta satu kegiatan (mis. STS) ke ruang, sesi, dan kursi. Satu sumber untuk
 * halaman Denah Ruang, cetak denah pintu/kartu meja/rekap, serta keterangan ruang di kartu peserta, daftar
 * hadir, dan berita acara. */

export type PolaBagi = "SELANG_SELING" | "SELANG_SELING_JURUSAN" | "PER_KELAS";
export const MAKS_SESI = 6;

/** Nomor peserta — SATU-SATUNYA rumus, dipakai kartu peserta, denah, dan kartu meja: SINGKATAN-KODEKELAS-urut,
 * urut = posisi siswa dalam kelasnya menurut nama. */
export function nomorPeserta(singkatan: string | null | undefined, namaKelas: string, urut: number): string {
  return `${singkatan || "UJIAN"}-${namaKelas.replace(/\s+/g, "")}-${String(urut).padStart(2, "0")}`;
}

export interface PesertaKegiatan { id: string; nis: string; nama: string; classId: string; kelas: string; grade: number; nomor: string; majorId: string; jurusan: string }

/** Siswa aktif peserta kegiatan (tingkat kegiatan; kosong = semua tingkat), urut tingkat → kelas → nama.
 * Nomor dihitung dengan urutan yang sama dengan halaman kartu peserta (nama menaik dalam kelas). */
export async function pesertaKegiatan(kegiatan: { singkatan: string; tingkat: number[] }): Promise<PesertaKegiatan[]> {
  const siswa = await prisma.student.findMany({
    where: {
      studentStatus: "AKTIF", classId: { not: null },
      ...(kegiatan.tingkat.length ? { class: { grade: { in: kegiatan.tingkat } } } : {}),
    },
    select: { id: true, nis: true, classId: true, user: { select: { name: true } }, class: { select: { name: true, grade: true, majorId: true, major: { select: { code: true, name: true } } } } },
    orderBy: { user: { name: "asc" } },
  });
  const urutKelas = new Map<string, number>();
  const hasil: PesertaKegiatan[] = [];
  for (const s of siswa) {
    if (!s.classId || !s.class) continue;
    const n = (urutKelas.get(s.classId) ?? 0) + 1;
    urutKelas.set(s.classId, n);
    hasil.push({ id: s.id, nis: s.nis, nama: s.user.name, classId: s.classId, kelas: s.class.name, grade: s.class.grade, nomor: nomorPeserta(kegiatan.singkatan, s.class.name, n), majorId: s.class.majorId, jurusan: s.class.major?.code || s.class.major?.name || "-" });
  }
  return hasil.sort((a, b) => a.grade - b.grade || a.kelas.localeCompare(b.kelas, "id", { numeric: true }) || a.nomor.localeCompare(b.nomor, "id", { numeric: true }));
}

export interface RuangDenah { id: string; nama: string; lokasi: string | null; kapasitas: number; kolom: number; urutan: number; aktif: boolean }
export interface Penempatan { studentId: string; ruangId: string; sesi: number; kursi: number }

/** Bagi peserta ke ruang (ruang diisi berurutan kursi 1..kapasitas; bila semua ruang penuh, lanjut sesi berikutnya
 * mulai ruang pertama).
 *   SELANG_SELING         — tingkat bergantian (X, XI, XII, …) dengan sebaran rata; di dalam tingkat kelasnya juga
 *                           bergantian (`urutanSelangSeling`). Satu ruang bisa bercampur jurusan.
 *   SELANG_SELING_JURUSAN — SATU RUANG SATU JURUSAN (permintaan user 21 September 2026: "selang-seling tapi hanya
 *                           dengan jurusan yang sama saja"). Urutan di dalam jurusan sama dengan SELANG_SELING;
 *                           jurusan yang hanya satu tingkat otomatis bergantian per kelas. Jurusan berikutnya selalu
 *                           MULAI DI RUANG BARU, jadi bisa butuh ruang/sesi lebih banyak (`bagiPerJurusan`).
 *   PER_KELAS             — berurutan kelas demi kelas. */
/** Gabungkan beberapa antrean dengan SEBARAN RATA: anggota ke-j dari antrean sepanjang n diberi posisi (j + ½) / n,
 * lalu semua diurutkan menurut posisi itu. Beda dengan giliran polos (A, B, C, A, B, C, …) yang menumpukkan sisa
 * antrean terpanjang di kursi-kursi terakhir, sebaran rata menyelipkan antrean pendek di sepanjang barisan. */
function sebarRata(antrean: PesertaKegiatan[][]): PesertaKegiatan[] {
  return antrean
    .flatMap((q, iq) => q.map((p, j) => ({ p, pos: (j + 0.5) / q.length, iq })))
    .sort((a, b) => a.pos - b.pos || a.iq - b.iq)
    .map(x => x.p);
}

function kelompokkan<K extends string | number>(peserta: PesertaKegiatan[], kunci: (p: PesertaKegiatan) => K): PesertaKegiatan[][] {
  const peta = new Map<K, PesertaKegiatan[]>();
  for (const p of peserta) peta.set(kunci(p), [...(peta.get(kunci(p)) ?? []), p]);
  return [...peta.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), "id", { numeric: true })).map(([, q]) => q);
}

/** Urutan selang-seling: antar-TINGKAT disebar rata, dan di dalam satu tingkat KELASNYA juga disebar rata — jadi
 * bila satu tingkat lebih banyak (mis. kelas X dua rombel), siswa X yang terpaksa bersebelahan tetap beda kelas.
 * Hanya satu tingkat → otomatis menjadi selang-seling antar-kelas. */
function urutanSelangSeling(peserta: PesertaKegiatan[]): PesertaKegiatan[] {
  return sebarRata(kelompokkan(peserta, p => p.grade).map(tingkat => sebarRata(kelompokkan(tingkat, p => p.kelas))));
}

/** Peruntukan ruang: ruangId → majorId (pola SELANG_SELING_JURUSAN) atau classId (pola PER_KELAS). */
export type Peruntukan = Record<string, string>;
type RuangIsi = { id: string; kapasitas: number };

export function bagiPeserta(
  peserta: PesertaKegiatan[], ruang: RuangIsi[], pola: PolaBagi, peruntukan: Peruntukan = {},
): { hasil: Penempatan[]; sesi: number; galat?: string } {
  const ruangIsi = ruang.filter(r => r.kapasitas > 0);
  if (!ruangIsi.length) return { hasil: [], sesi: 0 };
  if (pola === "SELANG_SELING") return isiBerurutan(urutanSelangSeling(peserta), ruangIsi);

  // RUANG KHUSUS (permintaan user 21 September 2026): ruang yang diberi peruntukan HANYA diisi jurusan/kelas itu,
  // di semua sesi. Kelompok yang ruangnya tidak cukup berlanjut ke sesi berikutnya di ruang yang sama. Kelompok tanpa
  // ruang khusus dibagi otomatis ke ruang yang tidak diberi peruntukan. Peruntukan untuk kelompok yang tidak ikut
  // kegiatan ini (mis. kelas X pada kegiatan kelas XII) diabaikan — ruangnya kembali otomatis.
  const perKelas = pola === "PER_KELAS";
  const kunci = (p: PesertaKegiatan) => (perKelas ? p.classId : p.majorId);
  const ada = new Set(peserta.map(kunci));
  const khusus = new Map<string, RuangIsi[]>();
  for (const r of ruangIsi) {
    const k = peruntukan[r.id];
    if (k && ada.has(k)) khusus.set(k, [...(khusus.get(k) ?? []), r]);
  }
  const bebas = ruangIsi.filter(r => !khusus.has(peruntukan[r.id] ?? ""));

  const hasil: Penempatan[] = [];
  let sesi = 0;
  for (const [k, rs] of khusus) {
    const anggota = peserta.filter(p => kunci(p) === k);
    const antre = perKelas ? anggota : urutanSelangSeling(anggota);
    const jumlahSesi = Math.ceil(antre.length / rs.reduce((n, r) => n + r.kapasitas, 0));
    const slot: { r: RuangIsi; sesi: number }[] = [];
    for (let x = 1; x <= jumlahSesi; x++) for (const r of rs) slot.push({ r, sesi: x });
    isiRata(antre, slot, hasil);
    sesi = Math.max(sesi, jumlahSesi);
  }

  const sisa = peserta.filter(p => !khusus.has(kunci(p)));
  if (sisa.length) {
    if (!bebas.length) {
      const nama = [...new Set(sisa.map(p => (perKelas ? p.kelas : p.jurusan)))].slice(0, 6).join(", ");
      return { hasil: [], sesi: 0, galat: `${nama} belum mendapat ruang — semua ruang tercentang sudah diberi peruntukan. Biarkan sebagian ruang "Otomatis" atau beri ruang untuk ${perKelas ? "kelas" : "jurusan"} itu.` };
    }
    const lain = perKelas ? isiBerurutan(sisa, bebas) : bagiPerJurusan(sisa, bebas);
    hasil.push(...lain.hasil);
    sesi = Math.max(sesi, lain.sesi);
  }
  return { hasil, sesi };
}

/** Isi ruang berurutan kursi 1..kapasitas; bila semua ruang penuh, lanjut sesi berikutnya mulai ruang pertama. */
function isiBerurutan(urutan: PesertaKegiatan[], ruang: RuangIsi[]): { hasil: Penempatan[]; sesi: number } {
  const hasil: Penempatan[] = [];
  let idx = 0, sesi = 0;
  while (idx < urutan.length) {
    sesi++;
    for (const r of ruang) {
      for (let k = 1; k <= r.kapasitas && idx < urutan.length; k++) hasil.push({ studentId: urutan[idx++].id, ruangId: r.id, sesi, kursi: k });
    }
  }
  return { hasil, sesi };
}

/** Bagi antrean RATA ke daftar slot (ruang × sesi) sebanding kapasitasnya — 62 siswa di tiga ruang 20 kursi + satu
 * ruang 20 menjadi 16/16/15/15, bukan 20/20/20/2. Kapasitas slot wajib cukup untuk seluruh antrean. */
function isiRata(antre: PesertaKegiatan[], slot: { r: RuangIsi; sesi: number }[], hasil: Penempatan[]) {
  let sisa = antre.length, sisaKap = slot.reduce((n, j) => n + j.r.kapasitas, 0), idx = 0;
  for (const j of slot) {
    const kap = j.r.kapasitas;
    // Sebanding kapasitas, tidak melebihi kursi ruang, dan cukup besar supaya sisanya muat di slot berikutnya.
    const isi = Math.min(kap, Math.max(Math.round((sisa * kap) / sisaKap), sisa - (sisaKap - kap)));
    for (let k = 1; k <= isi; k++) hasil.push({ studentId: antre[idx++].id, ruangId: j.r.id, sesi: j.sesi, kursi: k });
    sisa -= isi; sisaKap -= kap;
  }
}

/** SATU RUANG SATU JURUSAN. Tiap jurusan mengambil ruang sebanyak yang ia perlukan (berlanjut ke sesi berikutnya bila
 * ruang habis), lalu siswanya dibagi rata ke ruang-ruang itu. Jurusan berikutnya selalu mulai di ruang baru. */
function bagiPerJurusan(peserta: PesertaKegiatan[], ruang: RuangIsi[]): { hasil: Penempatan[]; sesi: number } {
  const hasil: Penempatan[] = [];
  let sesi = 1, iRuang = 0;
  for (const anggota of kelompokkan(peserta, p => p.jurusan)) {
    const antre = urutanSelangSeling(anggota);
    const slot: { r: RuangIsi; sesi: number }[] = [];
    for (let kursi = 0; kursi < antre.length; iRuang++) {
      if (iRuang >= ruang.length) { sesi++; iRuang = 0; }
      slot.push({ r: ruang[iRuang], sesi });
      kursi += ruang[iRuang].kapasitas;
    }
    isiRata(antre, slot, hasil);
  }
  return { hasil, sesi: hasil.length ? sesi : 0 };
}

/** Validasi isian formulir ruang (dipakai POST & PUT). */
export function bacaRuang(b: Record<string, unknown>): Omit<RuangDenah, "id"> | { error: string } {
  const nama = String(b.nama ?? "").trim().replace(/\s+/g, " ");
  if (!nama) return { error: "Nama ruang wajib diisi." };
  if (nama.length > 60) return { error: "Nama ruang maksimal 60 karakter." };
  const kapasitas = Math.round(Number(b.kapasitas));
  if (!Number.isFinite(kapasitas) || kapasitas < 1 || kapasitas > 200) return { error: "Kapasitas harus 1–200 kursi." };
  const kolom = Math.round(Number(b.kolom ?? 4));
  if (!Number.isFinite(kolom) || kolom < 1 || kolom > 12) return { error: "Meja per baris harus 1–12." };
  const urutan = Math.round(Number(b.urutan ?? 0)) || 0;
  return { nama, lokasi: String(b.lokasi ?? "").trim() || null, kapasitas, kolom, urutan, aktif: b.aktif === undefined ? true : !!b.aktif };
}

export interface KursiDenah { kursi: number; peserta: PesertaKegiatan | null }
export interface RuangSesi {
  ruang: RuangDenah; sesi: number; jumlah: number; kursi: KursiDenah[];
  kelas: { nama: string; jumlah: number; nomorAwal: string; nomorAkhir: string }[];
}

export async function muatDenah(kegiatanId: string) {
  const kegiatan = await prisma.kegiatanUjian.findUnique({
    where: { id: kegiatanId },
    select: { id: true, nama: true, singkatan: true, tingkat: true, aturRuang: true, academicYear: { select: { name: true } } },
  });
  if (!kegiatan) return null;
  const [peserta, penempatan, ruang] = await Promise.all([
    pesertaKegiatan(kegiatan),
    prisma.penempatanRuangUjian.findMany({ where: { kegiatanId }, select: { studentId: true, ruangId: true, sesi: true, kursi: true } }),
    prisma.ruangUjian.findMany({
      orderBy: [{ urutan: "asc" }, { nama: "asc" }],
      select: { id: true, nama: true, lokasi: true, kapasitas: true, kolom: true, urutan: true, aktif: true },
    }),
  ]);
  const perSiswa = new Map(peserta.map(p => [p.id, p]));
  const perRuang = new Map(ruang.map(r => [r.id, r]));
  const grup = new Map<string, Penempatan[]>();
  const ditempatkan = new Set<string>();
  let usang = 0;
  for (const p of penempatan) {
    // Siswa yang sudah tidak aktif/pindah kelas ke tingkat lain: tempat duduknya diabaikan (dilaporkan sebagai usang).
    if (!perSiswa.has(p.studentId) || !perRuang.has(p.ruangId)) { usang++; continue; }
    ditempatkan.add(p.studentId);
    const k = `${p.ruangId}|${p.sesi}`;
    grup.set(k, [...(grup.get(k) ?? []), p]);
  }
  const ruangSesi: RuangSesi[] = [...grup.entries()].map(([k, isi]) => {
    const [ruangId, sesiTeks] = k.split("|");
    const r = perRuang.get(ruangId)!;
    const kapasitas = Math.max(r.kapasitas, ...isi.map(x => x.kursi));
    const perKursi = new Map(isi.map(x => [x.kursi, perSiswa.get(x.studentId)!]));
    const kursi = Array.from({ length: kapasitas }, (_, i) => ({ kursi: i + 1, peserta: perKursi.get(i + 1) ?? null }));
    const perKelas = new Map<string, PesertaKegiatan[]>();
    for (const x of kursi) if (x.peserta) perKelas.set(x.peserta.kelas, [...(perKelas.get(x.peserta.kelas) ?? []), x.peserta]);
    const kelas = [...perKelas.entries()].map(([nama, ps]) => {
      const urut = ps.map(p => p.nomor).sort((a, b) => a.localeCompare(b, "id", { numeric: true }));
      return { nama, jumlah: ps.length, nomorAwal: urut[0], nomorAkhir: urut[urut.length - 1] };
    }).sort((a, b) => a.nama.localeCompare(b.nama, "id", { numeric: true }));
    return { ruang: r, sesi: Number(sesiTeks), jumlah: isi.length, kursi, kelas };
  }).sort((a, b) => a.sesi - b.sesi || a.ruang.urutan - b.ruang.urutan || a.ruang.nama.localeCompare(b.ruang.nama, "id", { numeric: true }));

  return {
    kegiatan: { id: kegiatan.id, nama: kegiatan.nama, singkatan: kegiatan.singkatan, tingkat: kegiatan.tingkat, tahunAjaran: kegiatan.academicYear?.name ?? null },
    ruangSesi,
    belumDitempatkan: peserta.filter(p => !ditempatkan.has(p.id)),
    total: peserta.length,
    ditempatkan: ditempatkan.size,
    usang,
    jumlahSesi: ruangSesi.reduce((m, x) => Math.max(m, x.sesi), 0),
    aturRuang: bacaAturRuang(kegiatan.aturRuang),
    kelompok: {
      jurusan: ringkasKelompok(peserta, p => p.majorId, p => p.jurusan),
      kelas: ringkasKelompok(peserta, p => p.classId, p => p.kelas),
    },
  };
}

/** Pilihan peruntukan ruang: jurusan/kelas yang benar-benar ikut kegiatan ini + jumlah pesertanya. */
function ringkasKelompok(peserta: PesertaKegiatan[], id: (p: PesertaKegiatan) => string, label: (p: PesertaKegiatan) => string) {
  const peta = new Map<string, { id: string; label: string; jumlah: number }>();
  for (const p of peserta) {
    const x = peta.get(id(p)) ?? { id: id(p), label: label(p), jumlah: 0 };
    x.jumlah++;
    peta.set(id(p), x);
  }
  return [...peta.values()].sort((a, b) => a.label.localeCompare(b.label, "id", { numeric: true }));
}

export interface AturRuang { pola: PolaBagi; jurusan: Peruntukan; kelas: Peruntukan }

/** Baca/rapikan `KegiatanUjian.aturRuang` (JSON) — isian rusak jadi kosong, bukan galat. */
export function bacaAturRuang(v: unknown): AturRuang {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const peta = (x: unknown): Peruntukan => {
    const hasil: Peruntukan = {};
    if (x && typeof x === "object") for (const [k, val] of Object.entries(x as Record<string, unknown>)) if (typeof val === "string" && val) hasil[k] = val;
    return hasil;
  };
  const pola: PolaBagi = o.pola === "PER_KELAS" || o.pola === "SELANG_SELING_JURUSAN" ? o.pola : "SELANG_SELING";
  return { pola, jurusan: peta(o.jurusan), kelas: peta(o.kelas) };
}

export interface TempatDuduk { ruang: string; sesi: number; kursi: number; label: string }

/** Tempat duduk sejumlah siswa pada satu kegiatan — untuk kartu peserta, daftar hadir, dan berita acara. */
export async function ruangUntukSiswa(kegiatanId: string, studentIds: string[]): Promise<Map<string, TempatDuduk>> {
  if (!studentIds.length) return new Map();
  const [baris, adaSesiLanjut] = await Promise.all([
    prisma.penempatanRuangUjian.findMany({
      where: { kegiatanId, studentId: { in: studentIds } },
      select: { studentId: true, sesi: true, kursi: true, ruang: { select: { nama: true } } },
    }).catch(() => []),
    prisma.penempatanRuangUjian.count({ where: { kegiatanId, sesi: { gt: 1 } } }).catch(() => 0),
  ]);
  return new Map(baris.map(b => [b.studentId, {
    ruang: b.ruang.nama, sesi: b.sesi, kursi: b.kursi,
    label: `${b.ruang.nama}${adaSesiLanjut ? ` · Sesi ${b.sesi}` : ""} · Kursi ${b.kursi}`,
  }]));
}

/** "Lab 1, Lab 2 (sesi 2)" untuk sekelompok siswa; null bila belum ada pembagian ruang. */
export function teksRuang(tempat: Map<string, TempatDuduk> | null, studentIds: string[]): string | null {
  if (!tempat?.size) return null;
  const adaSesiLanjut = [...tempat.values()].some(t => t.sesi > 1);
  const nama = new Set<string>();
  for (const id of studentIds) {
    const t = tempat.get(id);
    if (t) nama.add(adaSesiLanjut ? `${t.ruang} (sesi ${t.sesi})` : t.ruang);
  }
  return nama.size ? [...nama].join(", ") : null;
}
