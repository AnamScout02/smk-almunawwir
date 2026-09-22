import * as XLSX from "xlsx";

/** Satu agenda hasil pembacaan berkas Excel kalender pendidikan. */
export interface AgendaImpor {
  judul: string;
  tanggalMulai: string;   // "YYYY-MM-DD"
  tanggalSelesai: string;
  jenis: string;
  hariEfektif: boolean;
  keterangan: string | null;
}

const BULAN: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

/** Kolom "Bulan" pada berkas sekolah kadang berisi teks ("Juli 2026"), kadang sudah terlanjur
 * dibaca Excel sebagai tanggal sehingga tersimpan sebagai angka seri (mis. 46266). Dua-duanya
 * harus dimengerti — kalau tidak, separuh agenda hilang tanpa pesan apa pun. */
function bacaBulan(v: unknown): { bulan: number; tahun: number } | null {
  const s = String(v ?? "").trim();
  if (/^\d{5}$/.test(s)) {
    const p = XLSX.SSF.parse_date_code(Number(s));
    return p ? { bulan: p.m, tahun: p.y } : null;
  }
  const m = s.toLowerCase().match(/([a-z']+)\s*(\d{4})/);
  if (m && BULAN[m[1]]) return { bulan: BULAN[m[1]], tahun: Number(m[2]) };
  return null;
}

/** "13 - 18" -> rentang; "14" -> satu hari; "….." / kosong -> null (dilewati & dilaporkan). */
function bacaTanggal(v: unknown, bulan: number, tahun: number): [string, string] | null {
  const s = String(v ?? "").trim().replace(/\s/g, "");
  if (!/\d/.test(s)) return null;
  const pad = (d: number) => `${tahun}-${String(bulan).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const r = s.match(/^(\d{1,2})[-–—](\d{1,2})$/);
  if (r) {
    const a = Number(r[1]), b = Number(r[2]);
    if (a < 1 || a > 31 || b < 1 || b > 31) return null;
    return a <= b ? [pad(a), pad(b)] : [pad(b), pad(a)];
  }
  const d = s.match(/^(\d{1,2})$/);
  if (!d) return null;
  const n = Number(d[1]);
  return n >= 1 && n <= 31 ? [pad(n), pad(n)] : null;
}

/** Jenis agenda ditebak dari kata-kata di judulnya — sekolah menulis agenda dalam kalimat bebas,
 * tidak ada kolom jenis di berkasnya. Yang meleset tetap bisa diperbaiki manual setelah impor. */
function tebakJenis(judul: string): { jenis: string; hariEfektif: boolean } {
  const s = judul.toLowerCase();
  if (/libur|cuti bersama|tahun baru|idul|waisak|imlek|isra|wafat|kenaikan isa|hari buruh|hari lahir pancasila|hut republik|maulid|nyepi|natal/.test(s))
    return { jenis: "LIBUR", hariEfektif: false };
  if (/sumatif|ujian|ukk|anbk|penilaian|nominatif|simulasi|asesmen/.test(s))
    return { jenis: "UJIAN", hariEfektif: true };
  if (/pembelajaran|pembelajran|kbm/.test(s))
    return { jenis: "KBM", hariEfektif: true };
  if (/rapat|pleno/.test(s)) return { jenis: "RAPAT", hariEfektif: true };
  if (/ppdb|spmb|mpls/.test(s)) return { jenis: "PPDB", hariEfektif: true };
  return { jenis: "KEGIATAN", hariEfektif: true };
}

const JUDUL_KOLOM = ["bulan", "tanggal", "agenda", "pelaksana"];

/** Baca seluruh agenda dari berkas kalender pendidikan.
 *
 * Lembar yang dipakai: yang namanya mengandung "JADWAL" / "AGENDA" / "KEGIATAN"; kalau tidak ada,
 * lembar mana pun yang barisnya berjudul Bulan/Tanggal/Agenda. Jadi berkas kalender sekolah yang
 * memuat banyak lembar lain (RPE, kalender bulanan, perhitungan hari efektif) tetap bisa dipakai
 * apa adanya tanpa perlu dipisah dulu. */
export function bacaKalender(buf: Buffer): { agenda: AgendaImpor[]; dilewati: string[]; lembar: string | null } {
  const wb = XLSX.read(buf, { type: "buffer" });
  const kandidat = [
    ...wb.SheetNames.filter(n => /jadwal|agenda|kegiatan/i.test(n)),
    ...wb.SheetNames,
  ];

  for (const nama of kandidat) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nama], { header: 1, blankrows: false, defval: "" });
    const iJudul = rows.findIndex(r =>
      JUDUL_KOLOM.every(k => r.some(c => String(c).trim().toLowerCase() === k)));
    if (iJudul < 0) continue;

    const kepala = (rows[iJudul] as unknown[]).map(c => String(c).trim().toLowerCase());
    const kol = Object.fromEntries(JUDUL_KOLOM.map(k => [k, kepala.indexOf(k)]));

    const agenda: AgendaImpor[] = [];
    const dilewati: string[] = [];
    let bulanTerakhir: { bulan: number; tahun: number } | null = null;

    for (const r of rows.slice(iJudul + 1)) {
      const judul = String(r[kol.agenda] ?? "").trim();
      if (!judul) continue;
      // Kolom bulan sering hanya diisi di baris pertama tiap bulan (sel gabungan) — baris
      // berikutnya dibiarkan kosong dan mewarisi bulan di atasnya.
      const bt: { bulan: number; tahun: number } | null = bacaBulan(r[kol.bulan]) ?? bulanTerakhir;
      if (!bt) { dilewati.push(`${judul} (bulan tidak terbaca)`); continue; }
      bulanTerakhir = bt;
      const rg = bacaTanggal(r[kol.tanggal], bt.bulan, bt.tahun);
      if (!rg) { dilewati.push(`${judul} (tanggal tidak terbaca: "${String(r[kol.tanggal] ?? "").trim()}")`); continue; }
      const t = tebakJenis(judul);
      const pelaksana = String(r[kol.pelaksana] ?? "").trim();
      agenda.push({
        judul, tanggalMulai: rg[0], tanggalSelesai: rg[1],
        jenis: t.jenis, hariEfektif: t.hariEfektif,
        keterangan: pelaksana || null,
      });
    }
    if (agenda.length > 0) return { agenda, dilewati, lembar: nama };
  }
  return { agenda: [], dilewati: [], lembar: null };
}
