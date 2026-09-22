import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { rentangSemester } from "@/lib/rapor-verifikasi";
import { kelompokMapel } from "@/lib/rapor-form-server";
import { gabungForm, hitungSiswa, hitungSiswaGabungan, peringkat, catatanPeringkat, type FormGabungan, type NilaiSiswaForm, type PengaturanForm, type HasilSiswa } from "@/lib/rapor-form";
import { grupMapel } from "@/lib/mapel-gabungan";
import { kalimatSosial, kalimatSpiritual, type PilihanSikap } from "@/lib/rapor-sikap";

/** DATA CETAK RAPOR SATU KELAS (22 September 2026) — format makro rapor sekolah (Rapor Akhir, Rapor Tengah Semester, Rapor
 * Diniyah). SEMUA dari data yang sudah ada (keputusan user: jangan membuat aturan baru):
 *   nilai & deskripsi  ← Form Nilai Rapor yang DIKIRIM guru mapel (src/lib/rapor-form.ts)
 *   sikap & keputusan  ← isian wali kelas (CatatanWaliKelas)      catatan wali ← CatatanWaliKelas
 *   ketidakhadiran     ← Absensi resmi dalam rentang semester        ekstrakurikuler ← Nilai Ekstra
 *   PKL                ← data PKL siswa                              prestasi ← poin prestasi semester itu
 *   identitas          ← Buku Induk, kelas, pengaturan sekolah (nominatif.*, school.structure, contact.address) */

export interface BarisNilai {
  mapel: string; hasil: HasilSiswa | null; pengetahuan?: number | null; penerapan?: number | null; namaArab?: string | null; kkm?: number | null;
  /** Mapel gabungan (DPK/KK, src/lib/mapel-gabungan.ts): nama bagian-bagiannya di Penugasan Mengajar. */
  anggota?: string[];
}
export interface SiswaRapor {
  id: string; nama: string; nis: string; nisn: string | null;
  umum: BarisNilai[]; kejuruan: BarisNilai[]; diniyah: BarisNilai[];
  sikapSpiritual: string | null; deskSpiritual: string; sikapSosial: string | null; deskSosial: string;
  akhlak: string | null; kerajinan: string | null; kerapian: string | null;
  keputusan: string | null; catatan: string;
  absen: { S: number; I: number; A: number };
  ekstra: { nama: string; predikat: string; keterangan: string | null }[];
  pkl: { mitra: string; lokasi: string; lama: string; keterangan: string }[];
  prestasi: { jenis: string; keterangan: string }[];
  rata: number | null; peringkat: number | null;
  jumlahDiniyah: { pengetahuan: number; penerapan: number }; peringkatDiniyah: number | null; catatanDiniyah: string;
}

const bulanAntara = (a: Date, b: Date) => Math.max(0, Math.round(((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44)) * 10) / 10);

export async function susunRaporKelas(classId: string, semester: string) {
  const kelas = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true, name: true, grade: true, majorId: true, major: { select: { name: true } },
      homeroom: { select: { nip: true, user: { select: { name: true } } } },
      teachingAssignments: { select: { subject: { select: { name: true, category: true, order: true, namaArab: true } } } },
      raporApprovals: { where: { semester }, select: { approvedAt: true, approvedBy: true } },
    },
  });
  if (!kelas) return null;
  const rentang = rentangSemester(semester);
  const [st, siswa, forms, catatan] = await Promise.all([
    getSettings(["nominatif.npsn", "nominatif.nss", "nominatif.kabKota", "school.structure", "contact.address", "logo.emblem", "letterhead.ttdKepalaSekolah"]),
    prisma.student.findMany({
      where: { classId, studentStatus: "AKTIF" },
      select: { id: true, nis: true, nisn: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.formNilaiRapor.findMany({ where: { classId, semester, status: "DIKIRIM" } }),
    prisma.catatanWaliKelas.findMany({ where: { semester, student: { classId } } }),
  ]);
  const ids = siswa.map(s => s.id);
  const [absensi, ekstra, pkl, prestasi] = await Promise.all([
    rentang ? prisma.attendance.findMany({ where: { studentId: { in: ids }, date: { gte: rentang.mulai, lt: rentang.akhir }, status: { in: ["SAKIT", "IZIN", "ALPHA"] } }, select: { studentId: true, status: true } }) : Promise.resolve([]),
    prisma.nilaiEkstra.findMany({ where: { studentId: { in: ids }, semester }, select: { studentId: true, predikat: true, keterangan: true, extracurricularId: true } }),
    prisma.internship.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, company: true, position: true, startDate: true, endDate: true, status: true, catatanIndustri: true, nilaiIndustriRata: true } }),
    prisma.studentPointRecord.findMany({ where: { studentId: { in: ids }, semester, kind: "PRESTASI" }, select: { studentId: true, note: true, achievementType: { select: { name: true } } }, orderBy: { date: "asc" } }),
  ]);
  // Lokasi PKL = alamat Mitra Industri yang namanya sama dengan tempat PKL siswa.
  const mitra = await prisma.industryPartner.findMany({ where: { name: { in: [...new Set(pkl.map(p => p.company))] } }, select: { name: true, address: true } }).catch(() => []);
  const alamatMitra = new Map(mitra.map(x => [x.name, x.address ?? ""]));
  const namaEkskul = new Map((await prisma.extracurricular.findMany({ where: { id: { in: [...new Set(ekstra.map(e => e.extracurricularId))] } }, select: { id: true, name: true } })).map(e => [e.id, e.name]));

  // Mapel kelas → kelompok & urutan (Penugasan Mengajar).
  const mapel = [...new Map(kelas.teachingAssignments.map(a => [a.subject.name, a.subject])).values()]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const formPeta = new Map(forms.map(f => [f.subject, f]));
  const pengaturanDari = (f: (typeof forms)[number]): PengaturanForm => ({
    jenis: f.jenis, kkm: f.kkm ?? 75, katrol: f.katrol, bobot: f.bobot as unknown as PengaturanForm["bobot"],
    tp: f.tp as unknown as PengaturanForm["tp"], lm: f.lm as unknown as PengaturanForm["lm"],
  });

  // Unit rapor: mapel biasa satu-satu; bagian DPK 1–4 / KK 1–4 menjadi SATU mapel di posisi bagian pertamanya, nilainya dari
  // form-form bagian yang sudah DIKIRIM yang digabung (`gabungForm`, keputusan user 22 Sep 2026: "Gabung LM & TP").
  type Unit = { nama: string; kelompok: "UMUM" | "KEJURUAN" | "DINIYAH"; anggota: typeof mapel; gabungan: FormGabungan | null; namaArab: string | null };
  const unit: Unit[] = [];
  for (const m of mapel) {
    const g = kelompokMapel(m.category) === "DINIYAH" ? null : grupMapel(m.name);
    const ada = g ? unit.find(u => u.nama === g.nama) : null;
    if (ada) ada.anggota.push(m);
    else unit.push({ nama: g?.nama ?? m.name, kelompok: kelompokMapel(m.category), anggota: [m], gabungan: null, namaArab: m.namaArab });
  }
  for (const u of unit) {
    if (u.anggota.length === 1 && u.nama === u.anggota[0].name) continue;
    const bagian = u.anggota.map(m => formPeta.get(m.name)).filter((f): f is (typeof forms)[number] => !!f)
      .map(f => ({ pengaturan: pengaturanDari(f), nilai: (f.nilai ?? {}) as Record<string, NilaiSiswaForm> }));
    u.gabungan = bagian.length ? gabungForm(bagian) : null;
  }

  const hasil: SiswaRapor[] = siswa.map(s => {
    const baris = (kel: "UMUM" | "KEJURUAN" | "DINIYAH"): BarisNilai[] => unit.filter(u => u.kelompok === kel).map(u => {
      if (u.anggota.length > 1 || u.nama !== u.anggota[0].name) {
        return {
          mapel: u.nama, anggota: u.anggota.map(m => m.name), kkm: u.gabungan?.pengaturan.kkm ?? null,
          hasil: u.gabungan ? hitungSiswaGabungan(u.gabungan, s.id, s.user.name) : null,
        };
      }
      const m = u.anggota[0];
      const f = formPeta.get(m.name);
      const v = ((f?.nilai ?? {}) as Record<string, NilaiSiswaForm>)[s.id] ?? {};
      if (kel === "DINIYAH") return { mapel: m.name, namaArab: m.namaArab, hasil: null, pengetahuan: f ? v.pengetahuan ?? null : null, penerapan: f ? v.penerapan ?? null : null, kkm: f?.kkm ?? null };
      return { mapel: m.name, hasil: f ? hitungSiswa(pengaturanDari(f), v, s.user.name) : null, kkm: f?.kkm ?? null };
    });
    const c = catatan.find(x => x.studentId === s.id);
    const pil = (c?.sikapPilihan ?? {}) as PilihanSikap;
    const umum = baris("UMUM"), kejuruan = baris("KEJURUAN"), diniyah = baris("DINIYAH");
    const nilaiAkhir = [...umum, ...kejuruan].map(b => b.hasil?.hpa).filter((n): n is number => typeof n === "number");
    const hitungAbsen = (st: string) => absensi.filter(a => a.studentId === s.id && a.status === st).length;
    return {
      id: s.id, nama: s.user.name, nis: s.nis, nisn: s.nisn,
      umum, kejuruan, diniyah,
      sikapSpiritual: c?.sikapSpiritual ?? null, deskSpiritual: kalimatSpiritual(pil.spiritual),
      sikapSosial: c?.sikapSosial ?? null, deskSosial: kalimatSosial(pil.sosial),
      akhlak: c?.akhlak ?? null, kerajinan: c?.kerajinan ?? null, kerapian: c?.kerapian ?? null,
      keputusan: c?.keputusan ?? null, catatan: c?.catatan ?? "",
      absen: { S: hitungAbsen("SAKIT"), I: hitungAbsen("IZIN"), A: hitungAbsen("ALPHA") },
      ekstra: ekstra.filter(e => e.studentId === s.id).map(e => ({ nama: namaEkskul.get(e.extracurricularId) ?? "Ekstrakurikuler", predikat: e.predikat, keterangan: e.keterangan })),
      pkl: pkl.filter(p => p.studentId === s.id).map(p => ({
        mitra: p.company, lokasi: alamatMitra.get(p.company) ?? "", lama: `${bulanAntara(p.startDate, p.endDate).toString().replace(".", ",")} bulan`,
        keterangan: p.catatanIndustri ?? (p.nilaiIndustriRata ? `Nilai industri ${Math.round(p.nilaiIndustriRata)}` : p.status),
      })),
      prestasi: prestasi.filter(p => p.studentId === s.id).map(p => ({ jenis: p.achievementType?.name ?? "Prestasi", keterangan: p.note ?? "" })),
      rata: nilaiAkhir.length ? Math.round((nilaiAkhir.reduce((a, b) => a + b, 0) / nilaiAkhir.length) * 100) / 100 : null,
      peringkat: null,
      jumlahDiniyah: {
        pengetahuan: diniyah.reduce((a, b) => a + (b.pengetahuan ?? 0), 0),
        penerapan: diniyah.reduce((a, b) => a + (b.penerapan ?? 0), 0),
      },
      peringkatDiniyah: null, catatanDiniyah: "",
    };
  });
  // Peringkat: nilai akhir rata-rata (tanpa Diniyah, #67) & jumlah nilai Diniyah (RANK makro lembar D1).
  const rUmum = peringkat(new Map(hasil.map(h => [h.id, h.rata])));
  const rDin = peringkat(new Map(hasil.map(h => [h.id, h.jumlahDiniyah.pengetahuan + h.jumlahDiniyah.penerapan])));
  for (const h of hasil) {
    h.peringkat = rUmum.get(h.id) ?? null;
    h.peringkatDiniyah = rDin.get(h.id) ?? null;
    h.catatanDiniyah = catatanPeringkat(h.peringkatDiniyah);
  }

  const m = /^(Ganjil|Genap)\s+(\d{4})\/(\d{4})$/.exec(semester);
  const genap = m?.[1] === "Genap";
  const sah = kelas.raporApprovals[0];
  return {
    sekolah: {
      // Penulisan nama & alamat Arab mengikuti lembar rapor makro sekolah (DASHBOARD G14, RAPORT D baris 6).
      nama: "SMK Al MUNAWWIR IIBS", alamat: st["contact.address"] ?? "", npsn: st["nominatif.npsn"] ?? "", nss: st["nominatif.nss"] ?? "",
      kota: st["nominatif.kabKota"] ?? "", kepala: getPrincipalName(st["school.structure"] ?? ""),
      logo: st["logo.emblem"] || "/images/logo-emblem.png",
      /** Tanda tangan Kepala Sekolah (Pengaturan Logo) — dicetak hanya bila rapor sudah disahkan. */
      ttdKepala: st["letterhead.ttdKepalaSekolah"] ?? "",
      alamatArab: "شَارِعُ كِيدُوعْ لِيُوعْ نِمْرَةَ ٣٥، كِمِيرِي، سِيْعُو جُورُوهْ، بَنْيُوَانْجِي، جَاوَةُ ٱلشَّرْقِيَّةِ ٦٨٤٦٤",
    },
    kelas: { id: kelas.id, nama: kelas.name, grade: kelas.grade, jurusan: kelas.major?.name ?? "", wali: kelas.homeroom?.user.name ?? "", nipWali: kelas.homeroom?.nip ?? "" },
    semester, genap, tahun: m ? `${m[2]} / ${m[3]}` : "", labelSemester: genap ? "2 (Dua)" : "1 (Satu)",
    fase: kelas.grade <= 10 ? "Fase ( E )" : "Fase ( F )",
    /** Halaman awal rapor akhir (4 halaman per semester, seperti makro): X-1→1, X-2→5, XI-1→9, XI-2→13, XII-1→17, XII-2→21. */
    halamanAwal: ((Math.min(12, Math.max(10, kelas.grade)) - 10) * 2 + (genap ? 1 : 0)) * 4 + 1,
    tanggal: (sah?.approvedAt ?? new Date()).toISOString(), disahkan: !!sah,
    mapelTanpaForm: mapel.filter(x => !formPeta.has(x.name)).map(x => ({ nama: x.name, kelompok: kelompokMapel(x.category) })),
    jumlahSiswa: hasil.length,
    siswa: hasil,
  };
}
export type DataRaporKelas = NonNullable<Awaited<ReturnType<typeof susunRaporKelas>>>;
