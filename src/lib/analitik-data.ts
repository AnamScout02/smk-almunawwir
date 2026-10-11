import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { daftarLibur } from "@/lib/hari-libur";
import { levelPoin, semesterBerjalan } from "@/lib/peringatan-dini";
import { rentangSemester } from "@/lib/rapor-verifikasi";

/** ANALITIK DATA (11 Oktober 2026) — tiga pembaca atas data yang SUDAH ADA; tidak ada isian baru dan tidak ada yang ditulis.
 *  Semuanya ATURAN yang bisa dijelaskan (bukan model terlatih): sekolah belum punya riwayat hasil (siapa akhirnya tinggal
 *  kelas / keluar) untuk melatih dan menguji prediksi, jadi yang jujur bisa dibuat adalah PROYEKSI terhadap kriteria yang
 *  ditetapkan sekolah, dengan faktor-faktornya disebut satu per satu. Hasilnya DAFTAR UNTUK DIPERIKSA, bukan vonis.
 *  Tiap pemeriksaan punya batas jumlah data minimum; di bawah itu ia diam, tidak menebak. */
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const rata = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const simpang = (a: number[]) => { const m = rata(a); return Math.sqrt(rata(a.map(x => (x - m) ** 2))); };
const bulat = (n: number) => Math.round(n * 10) / 10;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export interface Temuan { jenis: string; tingkat: "TINGGI" | "SEDANG"; subjek: string; rincian: string; keterangan: string }

/* ─────────────────────────── 1. KEJANGGALAN NILAI ─────────────────────────── */
export async function kejanggalanNilai() {
  const semester = semesterBerjalan();
  const [entri, ujian] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { journal: { semester }, OR: [{ scorePengetahuan: { not: null } }, { scoreKeterampilan: { not: null } }] },
      select: { studentId: true, scorePengetahuan: true, scoreKeterampilan: true, student: { select: { user: { select: { name: true } } } },
        journal: { select: { id: true, date: true, subject: true, urutan: true, classId: true, class: { select: { name: true } }, teacher: { select: { user: { select: { name: true } } } } } } },
    }).catch(() => []),
    prisma.examAttempt.findMany({
      where: { submittedAt: { not: null }, score: { not: null }, exam: { jenis: "REGULER" } },
      select: { studentId: true, score: true, student: { select: { classId: true, user: { select: { name: true } }, class: { select: { name: true } } } }, exam: { select: { id: true, subject: true, title: true } } },
    }).catch(() => []),
  ]);
  const nilai = (e: { scorePengetahuan: number | null; scoreKeterampilan: number | null }) => rata([e.scorePengetahuan, e.scoreKeterampilan].filter((x): x is number => x != null));
  const temuan: Temuan[] = [];

  // (a) Satu pertemuan, semua siswa nilainya sama (≥ 8 siswa bernilai).
  const perJurnal = new Map<string, typeof entri>();
  for (const e of entri) perJurnal.set(e.journal.id, [...(perJurnal.get(e.journal.id) ?? []), e]);
  for (const g of perJurnal.values()) {
    const v = g.map(nilai), j = g[0].journal;
    if (v.length < 8) continue;
    const s = simpang(v);
    if (s <= 0.5) temuan.push({ jenis: "Nilai seragam", tingkat: "SEDANG", subjek: `${j.class.name} — ${j.subject}`, rincian: `${iso(j.date)} · ${j.teacher.user.name}`, keterangan: `${v.length} siswa mendapat nilai yang sama (${bulat(v[0])}). Wajar untuk tugas kelompok; periksa bila ini penilaian perorangan.` });
    else if (rata(v) >= 98) temuan.push({ jenis: "Hampir semua sempurna", tingkat: "SEDANG", subjek: `${j.class.name} — ${j.subject}`, rincian: `${iso(j.date)} · ${j.teacher.user.name}`, keterangan: `Rata-rata ${bulat(rata(v))} dari ${v.length} siswa.` });
    const luar = v.filter(x => x < 0 || x > 100).length;
    if (luar) temuan.push({ jenis: "Di luar 0–100", tingkat: "TINGGI", subjek: `${j.class.name} — ${j.subject}`, rincian: `${iso(j.date)} · ${j.teacher.user.name}`, keterangan: `${luar} nilai di luar rentang 0–100 — kemungkinan salah ketik.` });
  }

  // (b) Lonjakan/anjlok: nilai seorang siswa menyimpang ≥ 30 dari rata-rata nilainya SEBELUMNYA di mapel itu (≥ 2 nilai sebelumnya).
  const perSiswaMapel = new Map<string, typeof entri>();
  for (const e of entri) { const k = `${e.studentId}|${e.journal.classId}|${e.journal.subject}`; perSiswaMapel.set(k, [...(perSiswaMapel.get(k) ?? []), e]); }
  for (const g of perSiswaMapel.values()) {
    const urut = [...g].sort((a, b) => a.journal.date.getTime() - b.journal.date.getTime() || a.journal.urutan - b.journal.urutan);
    for (let i = 2; i < urut.length; i++) {
      const lalu = rata(urut.slice(0, i).map(nilai)), kini = nilai(urut[i]);
      if (Math.abs(kini - lalu) >= 30) {
        const j = urut[i].journal;
        temuan.push({ jenis: kini > lalu ? "Nilai melonjak" : "Nilai anjlok", tingkat: "SEDANG", subjek: `${urut[i].student.user.name} (${j.class.name})`, rincian: `${j.subject} · ${iso(j.date)}`, keterangan: `${bulat(kini)}, padahal rata-rata ${i} nilai sebelumnya ${bulat(lalu)}.` });
        break;
      }
    }
  }

  // (c) Nilai harian vs ujian pada mapel yang sama: per kelas (selisih rata-rata ≥ 25) dan per siswa (≥ 35).
  const harian = new Map<string, number[]>();
  for (const e of entri) { const k = `${e.studentId}|${e.journal.subject}`; harian.set(k, [...(harian.get(k) ?? []), nilai(e)]); }
  const perUjianKelas = new Map<string, { ujian: number[]; harian: number[]; label: string }>();
  for (const a of ujian) {
    const h = harian.get(`${a.studentId}|${a.exam.subject}`);
    if (!h?.length || a.score == null) continue;
    const hr = rata(h);
    const k = `${a.exam.id}|${a.student.classId}`, x = perUjianKelas.get(k) ?? { ujian: [], harian: [], label: `${a.student.class?.name ?? "—"} — ${a.exam.subject}` };
    x.ujian.push(a.score); x.harian.push(hr); perUjianKelas.set(k, x);
    if (Math.abs(hr - a.score) >= 35) temuan.push({ jenis: "Harian jauh dari ujian", tingkat: "SEDANG", subjek: `${a.student.user.name} (${a.student.class?.name ?? "—"})`, rincian: `${a.exam.subject} · ${a.exam.title}`, keterangan: `Rata-rata harian ${bulat(hr)}, nilai ujian ${bulat(a.score)}.` });
  }
  for (const x of perUjianKelas.values()) {
    if (x.ujian.length < 8) continue;
    const beda = rata(x.harian) - rata(x.ujian);
    if (Math.abs(beda) >= 25) temuan.push({ jenis: "Harian jauh dari ujian (satu kelas)", tingkat: "TINGGI", subjek: x.label, rincian: `${x.ujian.length} siswa`, keterangan: `Rata-rata harian ${bulat(rata(x.harian))}, rata-rata ujian ${bulat(rata(x.ujian))} — selisih ${bulat(Math.abs(beda))}. Bisa berarti penilaian harian terlalu longgar/ketat, atau soal ujian tidak sejalan dengan materi.` });
  }
  temuan.sort((a, b) => (a.tingkat === b.tingkat ? a.jenis.localeCompare(b.jenis) : a.tingkat === "TINGGI" ? -1 : 1));
  return { semester, temuan, cakupan: { nilaiHarian: entri.length, pertemuanBernilai: perJurnal.size, hasilUjian: ujian.length } };
}

/* ─────────────────────────── 2. POLA KETIDAKHADIRAN ─────────────────────────── */
export async function polaKetidakhadiran(opsi: { guru: boolean }) {
  const semester = semesterBerjalan(), r = rentangSemester(semester);
  const rentang = r ? { gte: r.mulai, lt: r.akhir } : undefined;
  const [absensi, jurnal, piket, kegiatan] = await Promise.all([
    prisma.attendance.findMany({ where: { date: rentang, student: { studentStatus: "AKTIF" } }, select: { studentId: true, date: true, status: true, student: { select: { classId: true, user: { select: { name: true } }, class: { select: { name: true } } } } } }).catch(() => []),
    prisma.journalEntry.findMany({ where: { attendanceStatus: { not: null }, journal: { semester } }, select: { studentId: true, attendanceStatus: true, student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } }, journal: { select: { subject: true } } } }).catch(() => []),
    opsi.guru ? prisma.teacherScheduleAttendance.findMany({ where: { date: rentang }, select: { date: true, status: true, schedule: { select: { teacher: { select: { user: { select: { name: true } } } } } } } }).catch(() => []) : Promise.resolve([]),
    prisma.kegiatanUjian.findMany({ where: { tanggalMulai: { not: null } }, select: { nama: true, tanggalMulai: true } }).catch(() => []),
  ]);
  const temuan: Temuan[] = [];

  // (a) Siswa yang ketidakhadirannya menumpuk di SATU hari dalam seminggu (≥ 4 kali tidak hadir, ≥ 60% di hari itu).
  const perSiswa = new Map<string, typeof absensi>();
  for (const a of absensi) perSiswa.set(a.studentId, [...(perSiswa.get(a.studentId) ?? []), a]);
  for (const g of perSiswa.values()) {
    const tidak = g.filter(a => a.status !== "HADIR");
    if (tidak.length < 4) continue;
    const perHari = new Map<number, number>(); for (const a of tidak) perHari.set(a.date.getUTCDay(), (perHari.get(a.date.getUTCDay()) ?? 0) + 1);
    const [hari, n] = [...perHari].sort((x, y) => y[1] - x[1])[0];
    const hariItu = g.filter(a => a.date.getUTCDay() === hari).length;
    if (n >= 3 && n / tidak.length >= 0.6) temuan.push({ jenis: "Siswa: hari tertentu", tingkat: n >= 5 ? "TINGGI" : "SEDANG", subjek: `${g[0].student.user.name} (${g[0].student.class?.name ?? "—"})`, rincian: `Hari ${HARI[hari]}`, keterangan: `${n} dari ${tidak.length} ketidakhadirannya jatuh di hari ${HARI[hari]} (tidak hadir ${n} dari ${hariItu} hari ${HARI[hari]} yang tercatat).` });
  }

  // (b) Siswa yang sering tidak ada di MAPEL tertentu menurut jurnal guru mapel (≥ 3 kali dan ≥ 50% pertemuan mapel itu).
  const perMapel = new Map<string, typeof jurnal>();
  for (const e of jurnal) { const k = `${e.studentId}|${e.journal.subject}`; perMapel.set(k, [...(perMapel.get(k) ?? []), e]); }
  for (const g of perMapel.values()) {
    const tidak = g.filter(e => e.attendanceStatus !== "HADIR").length;
    if (tidak >= 3 && tidak / g.length >= 0.5) temuan.push({ jenis: "Siswa: mapel tertentu", tingkat: "SEDANG", subjek: `${g[0].student.user.name} (${g[0].student.class?.name ?? "—"})`, rincian: g[0].journal.subject, keterangan: `Tidak hadir ${tidak} dari ${g.length} pertemuan mapel ini menurut jurnal gurunya.` });
  }

  // (c) Guru yang jam tidak masuknya menumpuk di satu hari (catatan guru piket; ≥ 4 jam, ≥ 60% di hari itu).
  const perGuru = new Map<string, typeof piket>();
  for (const p of piket) { const n = p.schedule.teacher?.user.name; if (n) perGuru.set(n, [...(perGuru.get(n) ?? []), p]); }
  for (const [nama, g] of perGuru) {
    // Dihitung per TANGGAL, bukan per jam: satu hari tidak masuk dengan empat jam mengajar adalah satu kejadian, bukan pola.
    const tanggal = [...new Set(g.filter(p => ["IZIN", "SAKIT", "ALPHA"].includes(p.status)).map(p => iso(p.date)))];
    if (tanggal.length < 3) continue;
    const perHari = new Map<number, number>(); for (const t of tanggal) { const d = new Date(`${t}T00:00:00Z`).getUTCDay(); perHari.set(d, (perHari.get(d) ?? 0) + 1); }
    const [hari, n] = [...perHari].sort((x, y) => y[1] - x[1])[0];
    if (n >= 3 && n / tanggal.length >= 0.6) temuan.push({ jenis: "Guru: hari tertentu", tingkat: "SEDANG", subjek: nama, rincian: `Hari ${HARI[hari]}`, keterangan: `${n} dari ${tanggal.length} hari tidak masuk kelasnya jatuh di hari ${HARI[hari]}.` });
  }

  // (d) Kelas: ketidakhadiran 2 pekan terakhir vs 4 pekan sebelumnya, dan 7 hari menjelang kegiatan ujian vs hari biasa.
  const kini = Date.now() + 7 * 3600_000, H = 86_400_000;
  const perKelas = new Map<string, typeof absensi>();
  for (const a of absensi) if (a.student.classId) perKelas.set(a.student.classId, [...(perKelas.get(a.student.classId) ?? []), a]);
  const laju = (g: typeof absensi) => (g.length >= 60 ? g.filter(a => a.status !== "HADIR").length / g.length : null);
  for (const g of perKelas.values()) {
    const nama = g[0].student.class?.name ?? "—";
    const baru = laju(g.filter(a => kini - a.date.getTime() <= 14 * H)), lama = laju(g.filter(a => kini - a.date.getTime() > 14 * H && kini - a.date.getTime() <= 42 * H));
    if (baru != null && lama != null && baru >= lama * 1.5 && baru - lama >= 0.05) temuan.push({ jenis: "Kelas: ketidakhadiran naik", tingkat: baru >= 0.25 ? "TINGGI" : "SEDANG", subjek: nama, rincian: "2 pekan terakhir", keterangan: `Tidak hadir ${Math.round(baru * 100)}% pada 2 pekan terakhir, naik dari ${Math.round(lama * 100)}% pada 4 pekan sebelumnya.` });
    for (const k of kegiatan) {
      const mulai = k.tanggalMulai!.getTime();
      const jelang = laju(g.filter(a => a.date.getTime() < mulai && mulai - a.date.getTime() <= 7 * H)), biasa = laju(g.filter(a => a.date.getTime() < mulai - 7 * H));
      if (jelang != null && biasa != null && jelang >= biasa * 1.5 && jelang - biasa >= 0.05) temuan.push({ jenis: "Kelas: naik menjelang ujian", tingkat: "SEDANG", subjek: nama, rincian: k.nama, keterangan: `Tidak hadir ${Math.round(jelang * 100)}% pada 7 hari sebelum ${k.nama}, dibanding ${Math.round(biasa * 100)}% sebelumnya.` });
    }
  }
  temuan.sort((a, b) => a.jenis.localeCompare(b.jenis) || (a.tingkat === "TINGGI" ? -1 : 1));
  return { semester, temuan, cakupan: { absensi: absensi.length, hari: new Set(absensi.map(a => iso(a.date))).size, kelas: perKelas.size, jurnal: jurnal.length, piket: piket.length } };
}

/* ─────────────────────────── 3. PROYEKSI KENAIKAN ─────────────────────────── */
export interface KriteriaNaik { minHadir: number; maksAlpha: number; maksDibawahKkm: number }
/** Bawaan = TITIK AWAL, bukan aturan sekolah — diubah di halamannya (SiteSetting `akademik.kriteriaNaik`). */
export const KRITERIA_BAWAAN: KriteriaNaik = { minHadir: 80, maksAlpha: 12, maksDibawahKkm: 3 };
export async function bacaKriteria(): Promise<{ kriteria: KriteriaNaik; kkm: number; ditetapkan: boolean }> {
  const s = await getSettings(["akademik.kriteriaNaik", "akademik.kkmDefault"]).catch(() => ({} as Record<string, string>));
  let k = KRITERIA_BAWAAN, ditetapkan = false;
  try { const o = JSON.parse(s["akademik.kriteriaNaik"] || "null"); if (o && Number.isFinite(o.minHadir)) { k = { minHadir: +o.minHadir, maksAlpha: +o.maksAlpha, maksDibawahKkm: +o.maksDibawahKkm }; ditetapkan = true; } } catch { /* bawaan */ }
  const kkm = Number(s["akademik.kkmDefault"]);
  return { kriteria: k, kkm: Number.isFinite(kkm) && kkm > 0 ? kkm : 75, ditetapkan };
}

export async function proyeksiKenaikan(classIds?: string[]) {
  const semester = semesterBerjalan(), r = rentangSemester(semester);
  const { kriteria, kkm, ditetapkan } = await bacaKriteria();
  const hariIni = new Date(`${new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)}T00:00:00Z`);
  // Sisa hari sekolah sampai akhir semester (Senin–Sabtu, dikurangi hari libur yang sudah tercatat).
  let sisaHari = 0;
  if (r) {
    const libur = new Set((await daftarLibur(iso(hariIni), iso(new Date(r.akhir.getTime() - 86_400_000))).catch(() => [])).map(l => l.tanggal));
    for (let t = hariIni.getTime() + 86_400_000; t < r.akhir.getTime(); t += 86_400_000) { const d = new Date(t); if (d.getUTCDay() !== 0 && !libur.has(iso(d))) sisaHari++; }
  }
  const [siswa, nilai] = await Promise.all([
    prisma.student.findMany({
      where: { studentStatus: "AKTIF", ...(classIds ? { classId: { in: classIds } } : { classId: { not: null } }) },
      select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } },
        attendance: { where: r ? { date: { gte: r.mulai, lt: r.akhir } } : {}, select: { date: true, status: true } },
        pointRecords: { where: { semester }, select: { kind: true, points: true } } },
    }),
    prisma.journalEntry.findMany({ where: { journal: { semester }, OR: [{ scorePengetahuan: { not: null } }, { scoreKeterampilan: { not: null } }], ...(classIds ? { student: { classId: { in: classIds } } } : {}) }, select: { studentId: true, scorePengetahuan: true, scoreKeterampilan: true, journal: { select: { subject: true } } } }).catch(() => []),
  ]);
  const perSiswaMapel = new Map<string, Map<string, number[]>>();
  for (const e of nilai) {
    const v = rata([e.scorePengetahuan, e.scoreKeterampilan].filter((x): x is number => x != null));
    const m = perSiswaMapel.get(e.studentId) ?? new Map<string, number[]>(); m.set(e.journal.subject, [...(m.get(e.journal.subject) ?? []), v]); perSiswaMapel.set(e.studentId, m);
  }
  const batas4Pekan = hariIni.getTime() - 28 * 86_400_000;
  const baris = siswa.map(s => {
    const a = s.attendance, hadir = a.filter(x => x.status === "HADIR").length, alpha = a.filter(x => x.status === "ALPHA").length;
    const baru = a.filter(x => x.date.getTime() >= batas4Pekan), lajuBaru = baru.length >= 6 ? baru.filter(x => x.status === "HADIR").length / baru.length : a.length ? hadir / a.length : null;
    const alphaBaru = baru.length >= 6 ? baru.filter(x => x.status === "ALPHA").length / baru.length : a.length ? alpha / a.length : 0;
    const persen = a.length ? Math.round((hadir / a.length) * 100) : null;
    const proyHadir = lajuBaru == null ? null : Math.round(((hadir + lajuBaru * sisaHari) / (a.length + sisaHari)) * 100);
    const proyAlpha = Math.round(alpha + alphaBaru * sisaHari);
    const mapel = [...(perSiswaMapel.get(s.id) ?? new Map<string, number[]>())].map(([nama, v]) => ({ nama, rata: bulat(rata(v)) }));
    const dibawah = mapel.filter(m => m.rata < kkm);
    const jumlah = (k: string) => s.pointRecords.filter(p => p.kind === k).reduce((x, p) => x + p.points, 0);
    const poin = Math.max(0, jumlah("PELANGGARAN") - jumlah("PRESTASI") - jumlah("REMISI"));
    // Faktor, masing-masing dengan besar pengaruhnya — yang terbesar disebut lebih dulu.
    const faktor: { nama: string; bobot: number; ket: string }[] = [];
    if (proyHadir != null && proyHadir < kriteria.minHadir) faktor.push({ nama: "Kehadiran", bobot: Math.min(5, 1 + (kriteria.minHadir - proyHadir) / 5), ket: `diperkirakan ${proyHadir}% di akhir semester (sekarang ${persen}%), batasnya ${kriteria.minHadir}%` });
    if (proyAlpha > kriteria.maksAlpha) faktor.push({ nama: "Alpha", bobot: Math.min(5, 1 + (proyAlpha - kriteria.maksAlpha) / 4), ket: `sudah ${alpha} kali, diperkirakan ${proyAlpha} di akhir semester, batasnya ${kriteria.maksAlpha}` });
    if (dibawah.length > kriteria.maksDibawahKkm) faktor.push({ nama: "Nilai", bobot: Math.min(5, 1 + (dibawah.length - kriteria.maksDibawahKkm)), ket: `${dibawah.length} dari ${mapel.length} mapel bernilai di bawah KKM ${kkm} (batasnya ${kriteria.maksDibawahKkm}): ${dibawah.slice(0, 4).map(m => `${m.nama} ${m.rata}`).join(", ")}${dibawah.length > 4 ? "…" : ""}` });
    else if (dibawah.length > 0 && dibawah.length === kriteria.maksDibawahKkm) faktor.push({ nama: "Nilai", bobot: 1, ket: `${dibawah.length} mapel di bawah KKM ${kkm} — tepat di batas` });
    if (poin >= 50) faktor.push({ nama: "Poin", bobot: poin >= 75 ? 4 : 2, ket: `${poin} poin (${levelPoin(poin)})` });
    faktor.sort((x, y) => y.bobot - x.bobot);
    const skor = faktor.reduce((x, f) => x + f.bobot, 0);
    return { id: s.id, nama: s.user.name, nis: s.nis, kelas: s.class?.name ?? "—", persen, proyHadir, alpha, proyAlpha, mapelBernilai: mapel.length, dibawah: dibawah.length, poin, faktor: faktor.map(f => ({ nama: f.nama, ket: f.ket })), skor: bulat(skor), tingkat: skor >= 5 ? "TINGGI" as const : skor >= 2 ? "SEDANG" as const : skor > 0 ? "PANTAU" as const : null };
  });
  const berisiko = baris.filter(b => b.tingkat).sort((a, b) => b.skor - a.skor || a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
  return {
    semester, kriteria, kkm, ditetapkan, sisaHari, jumlahSiswa: siswa.length, berisiko,
    tanpaAbsensi: baris.filter(b => b.persen == null).length, tanpaNilai: baris.filter(b => b.mapelBernilai === 0).length,
  };
}
