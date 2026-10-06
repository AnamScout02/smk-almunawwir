import { ikutDinilai, hitungBelumDikoreksi, type Jawaban } from "@/lib/soal";
import { kunciKeTeks } from "@/lib/soal-kunci";

/** ANALISIS BUTIR SOAL — satu sumber hitungan (dipindah dari rute hasil ujian, 5 Okt 2026) supaya tab Hasil,
 *  unduhan Excel, dan Rekap Analisis Butir per kegiatan (/pusat-ujian/analisis-butir) selalu sama angkanya.
 *  Murni: tidak membaca DB. Masukan = baris soal & pengerjaan apa adanya dari Prisma. */

type SoalMasuk = { id: string; order: number; tipe: string; kd: string | null; skor: number; opsi: unknown; kunci: unknown };
type PengerjaanMasuk = {
  student: { id: string; nis: string | null; user: { name: string }; class: { name: string } | null };
  score: number | null; submittedAt: Date | null; startedAt: Date | null;
  pelanggaran: unknown; skorButir: unknown; answers: unknown; urutan: unknown; waktuSoal: unknown; ubahJawaban: unknown;
};

export function hitungAnalisisButir(soal: SoalMasuk[], attempts: PengerjaanMasuk[]) {
  const rekap = attempts.map(a => ({
    student: a.student, score: a.score, submittedAt: a.submittedAt, startedAt: a.startedAt,
    pelanggaran: Array.isArray(a.pelanggaran) ? (a.pelanggaran as unknown[]).length : 0,
    skorButir: (a.skorButir as Record<string, number | null>) ?? {},
    jawaban: (a.answers as Record<string, Jawaban>) ?? {},
    urutan: ((a.urutan as { urutanSoal?: string[] })?.urutanSoal ?? []),
    waktuSoal: (a.waktuSoal as Record<string, number>) ?? {},
    ubahJawaban: (a.ubahJawaban as Record<string, number>) ?? {},
  }));
  const selesai = rekap.filter(r => r.submittedAt);

  // Soal JELEK ditandai otomatis (17 Sep 2026) — hanya bila peserta cukup (≥10) supaya tidak menuduh soal dari sampel kecil.
  const tandaiKualitas = (x: { peserta: number; p: number | null; d: number | null; pengecohMati: number }) => {
    const alasan: string[] = [];
    if (x.peserta >= 10) {
      if (x.d !== null && x.d < 0) alasan.push("daya beda terbalik (siswa pintar lebih banyak salah) — periksa kunci");
      else if (x.d !== null && x.d < 0.2) alasan.push("daya beda lemah — tidak membedakan siswa paham & belum");
      if (x.p !== null && x.p < 0.1) alasan.push("terlalu sukar (< 10% benar)");
      if (x.p !== null && x.p > 0.95) alasan.push("terlalu mudah (> 95% benar)");
      if (x.pengecohMati >= 2) alasan.push(`${x.pengecohMati} pengecoh tidak dipilih siapa pun`);
    }
    return { perluRevisi: alasan.length > 0, alasanRevisi: alasan };
  };

  // Analisis butir: tingkat kesukaran (p) dan daya beda (kelompok atas vs bawah 27%).
  const bernilai = selesai.filter(r => r.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const nAtas = Math.max(1, Math.round(bernilai.length * 0.27));
  const atas = bernilai.slice(0, nAtas), bawah = bernilai.slice(-nAtas);
  const analisis = soal.filter(q => ikutDinilai(q.tipe)).map(q => {
    const peserta = selesai.filter(r => !r.urutan.length || r.urutan.includes(q.id));
    // Hanya peserta yang butir ini SUDAH bernilai (5 Okt 2026): uraian belum dikoreksi bernilai null, dan dulu
    // dihitung 0 — soalnya tampak "terlalu sukar" dan ditandai perlu revisi padahal belum dinilai sama sekali.
    const dinilai = (r: typeof rekap[number]) => typeof r.skorButir[q.id] === "number";
    const rasio = (grup: typeof rekap) => {
      const g = grup.filter(r => (!r.urutan.length || r.urutan.includes(q.id)) && dinilai(r));
      if (!g.length) return null;
      return g.reduce((s, r) => s + ((r.skorButir[q.id] ?? 0) / (q.skor || 1)), 0) / g.length;
    };
    const p = rasio(peserta);
    const pa = rasio(atas), pb = rasio(bawah);
    const d = pa !== null && pb !== null ? pa - pb : null;
    const jawab = (r: typeof rekap[number]) => (r.skorButir[q.id] ?? 0) >= q.skor ? 1 : 0;
    const benar = peserta.reduce((s, r) => s + jawab(r), 0);
    const pesertaDinilai = peserta.filter(dinilai).length;

    // Analisis PENGECOH (distraktor) untuk soal pilihan: berapa peserta memilih tiap opsi.
    // Pengecoh dianggap BERFUNGSI kalau dipilih minimal 5% peserta — opsi salah yang nyaris tak
    // pernah dipilih tidak mengecoh siapa pun dan sebaiknya diganti.
    const opsiSoal = (Array.isArray(q.opsi) ? q.opsi : []) as { kode: string; teks: string; benar?: boolean }[];
    const pakaiSebaran = q.tipe === "PG" || q.tipe === "PG_KOMPLEKS";
    const sebaran = pakaiSebaran ? opsiSoal.map(o => {
      const dipilih = peserta.filter(r => {
        const j = r.jawaban[q.id];
        return Array.isArray(j) ? j.includes(o.kode) : j === o.kode;
      }).length;
      const persen = peserta.length ? Math.round((dipilih / peserta.length) * 1000) / 10 : 0;
      return {
        kode: o.kode, teks: o.teks.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80),
        benar: !!o.benar, dipilih, persen,
        berfungsi: o.benar ? null : peserta.length ? dipilih / peserta.length >= 0.05 : null,
      };
    }) : [];
    const kosong = pakaiSebaran ? peserta.filter(r => {
      const j = r.jawaban[q.id];
      return j === undefined || j === null || j === "" || (Array.isArray(j) && !j.length);
    }).length : 0;
    const pengecohMati = sebaran.filter(o => o.berfungsi === false).length;

    // WAKTU & KERAGUAN per soal: rata-rata detik yang dihabiskan (hanya peserta yang tercatat
    // waktunya) dan rata-rata berapa kali jawabannya diganti.
    const berwaktu = peserta.filter(r => (r.waktuSoal[q.id] ?? 0) > 0);
    const rataWaktu = berwaktu.length ? Math.round(berwaktu.reduce((s, r) => s + r.waktuSoal[q.id], 0) / berwaktu.length) : null;
    const rataUbah = peserta.length ? Math.round((peserta.reduce((s, r) => s + (r.ubahJawaban[q.id] ?? 0), 0) / peserta.length) * 10) / 10 : null;
    return {
      questionId: q.id, nomor: q.order + 1, tipe: q.tipe, kd: q.kd, skor: q.skor,
      kunci: kunciKeTeks({ tipe: q.tipe, opsi: (q.opsi as { kode: string; teks: string; benar?: boolean }[]) ?? [], kunci: (q.kunci as never) ?? null }),
      peserta: peserta.length, benar,
      kesukaran: p, kategoriKesukaran: p === null ? "-" : p >= 0.7 ? "Mudah" : p >= 0.3 ? "Sedang" : "Sukar",
      dayaBeda: d, kategoriDayaBeda: d === null ? "-" : d >= 0.4 ? "Baik" : d >= 0.2 ? "Cukup" : d >= 0 ? "Lemah" : "Terbalik",
      sebaran, kosong, pengecohMati, rataWaktu, rataUbah,
      ...tandaiKualitas({ peserta: pesertaDinilai, p, d, pengecohMati }),
    };
  });
  const nilaiSah = selesai.map(r => r.score).filter((s): s is number => s !== null);
  const statistik = {
    peserta: attempts.length, selesai: selesai.length,
    rerata: nilaiSah.length ? Math.round(nilaiSah.reduce((a, b) => a + b, 0) / nilaiSah.length * 100) / 100 : null,
    tertinggi: nilaiSah.length ? Math.max(...nilaiSah) : null,
    terendah: nilaiSah.length ? Math.min(...nilaiSah) : null,
    menungguKoreksi: selesai.filter(r => hitungBelumDikoreksi(r.skorButir) > 0).length,
  };

  const butirDinilai = soal.filter(q => ikutDinilai(q.tipe));
  const reliabilitas = hitungReliabilitas(butirDinilai, selesai);
  const reliabilitasAlasan = reliabilitas ? null : alasanTanpaReliabilitas(butirDinilai, selesai);
  return { rekap, selesai, analisis, statistik: { ...statistik, reliabilitas, reliabilitasAlasan } };
}

/** Kenapa reliabilitas tidak bisa dihitung — ditampilkan apa adanya supaya guru tahu harus berbuat apa
 *  (temuan uji 5 Okt 2026: ujian uraian 37 peserta tidak terhitung karena belum dikoreksi, bukan karena soalnya). */
function alasanTanpaReliabilitas(soal: { id: string }[], selesai: { skorButir: Record<string, number | null>; urutan: string[] }[]): string {
  const ids = soal.map(q => q.id);
  if (ids.length < 3) return "butir kurang dari 3";
  if (selesai.length < 10) return "peserta kurang dari 10";
  const sama = selesai.filter(r => !r.urutan.length || ids.every(id => r.urutan.includes(id)));
  if (sama.length < 10) return "tiap siswa menerima soal berbeda";
  return "masih ada jawaban belum dikoreksi";
}

/** RELIABILITAS TES — Cronbach alpha (sama dengan KR-20 bila semua butir bernilai 0/1), 5 Okt 2026.
 *  Dihitung dari skor butir peserta yang SELESAI dan sudah dinilai penuh. Ujian yang tiap peserta menerima
 *  sebagian soal (`urutan` berbeda-beda) tidak dihitung — alpha butuh butir yang sama untuk semua peserta.
 *  Minimal 10 peserta & 3 butir; di bawah itu angkanya tidak berarti, jadi null. */
export function hitungReliabilitas(
  soal: { id: string; skor: number }[],
  selesai: { score: number | null; skorButir: Record<string, number | null>; urutan: string[] }[],
): { alpha: number; kategori: "Tinggi" | "Cukup" | "Rendah"; peserta: number; butir: number } | null {
  const ids = soal.map(q => q.id);
  if (ids.length < 3) return null;
  const sama = selesai.filter(r => r.score !== null && (!r.urutan.length || ids.every(id => r.urutan.includes(id))));
  const lengkap = sama.filter(r => ids.every(id => typeof r.skorButir[id] === "number"));
  if (lengkap.length < 10) return null;
  const varian = (xs: number[]) => {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  };
  const totalVar = varian(lengkap.map(r => ids.reduce((s, id) => s + (r.skorButir[id] as number), 0)));
  if (totalVar <= 0) return null;
  const jumlahVarButir = ids.reduce((s, id) => s + varian(lengkap.map(r => r.skorButir[id] as number)), 0);
  const k = ids.length;
  const alpha = Math.round(((k / (k - 1)) * (1 - jumlahVarButir / totalVar)) * 100) / 100;
  return { alpha, kategori: alpha >= 0.7 ? "Tinggi" : alpha >= 0.5 ? "Cukup" : "Rendah", peserta: lengkap.length, butir: k };
}
