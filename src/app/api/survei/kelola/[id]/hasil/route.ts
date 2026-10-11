import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { penerimaPengumuman } from "@/lib/pengumuman";
import { hakSurvei, whereKelola, BIDANG_AKPD } from "@/lib/survei";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";

export const dynamic = "force-dynamic";

type Jawaban = Record<string, string | string[] | number>;

/** HASIL SURVEI — ringkasan per pertanyaan, AKPD per bidang & siswa prioritas, sosiometri per kelas. ?format=xlsx untuk unduhan. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const hak = await hakSurvei(session);
  const { id } = await params;
  const s = hak.boleh ? await prisma.survei.findFirst({ where: { id, ...whereKelola(session, hak) }, include: { pertanyaan: { orderBy: { urutan: "asc" } } } }) : null;
  if (!s) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const respons = await prisma.surveiRespons.findMany({ where: { surveiId: id }, orderBy: { createdAt: "asc" }, select: { id: true, userId: true, studentId: true, kelasId: true, peran: true, jawaban: true, createdAt: true } });
  const sasaran = (await penerimaPengumuman(s)).length;

  // Nama untuk survei bernama (bukan anonim).
  const [siswa, users, kelas] = await Promise.all([
    prisma.student.findMany({
      where: { OR: [{ id: { in: respons.map(r => r.studentId).filter((x): x is string => !!x) } }, ...(s.jenis === "SOSIOMETRI" ? [{ classId: { in: s.targetKelasIds }, studentStatus: "AKTIF" }] : [])] },
      select: { id: true, classId: true, user: { select: { name: true } } },
    }),
    s.anonim ? Promise.resolve([]) : prisma.user.findMany({ where: { id: { in: respons.map(r => r.userId).filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
    prisma.class.findMany({ where: { id: { in: [...new Set([...respons.map(r => r.kelasId), ...s.targetKelasIds].filter((x): x is string => !!x))] } }, select: { id: true, name: true } }),
  ]);
  const namaSiswa = new Map(siswa.map(x => [x.id, x.user.name]));
  const namaUser = new Map(users.map(x => [x.id, x.name]));
  const namaKelas = new Map(kelas.map(x => [x.id, x.name]));

  const pertanyaan = s.pertanyaan.map(p => {
    const nilai = respons.map(r => (r.jawaban as Jawaban)[p.id]).filter(v => v !== undefined && v !== null);
    if (p.tipe === "PILIHAN" || p.tipe === "CENTANG") {
      const hitung = new Map(p.opsi.map(o => [o, 0]));
      for (const v of nilai) for (const x of Array.isArray(v) ? v : [v]) hitung.set(String(x), (hitung.get(String(x)) ?? 0) + 1);
      return { id: p.id, teks: p.teks, tipe: p.tipe, kelompok: p.kelompok, dijawab: nilai.length, opsi: [...hitung].map(([label, jumlah]) => ({ label, jumlah })) };
    }
    if (p.tipe === "SKALA") {
      const maks = p.opsi.length || 5;
      const angka = nilai.map(Number).filter(Number.isFinite);
      const opsi = Array.from({ length: maks }, (_, i) => ({ label: p.opsi[i] ?? String(i + 1), jumlah: angka.filter(n => n === i + 1).length }));
      return { id: p.id, teks: p.teks, tipe: p.tipe, kelompok: p.kelompok, dijawab: angka.length, opsi, rata: angka.length ? Math.round((angka.reduce((a, b) => a + b, 0) / angka.length) * 100) / 100 : null, maks };
    }
    if (p.tipe === "TEKS") return { id: p.id, teks: p.teks, tipe: p.tipe, kelompok: p.kelompok, dijawab: nilai.length, isian: nilai.slice(-300).map(String) };
    return { id: p.id, teks: p.teks, tipe: p.tipe, kelompok: p.kelompok, dijawab: nilai.length };
  });

  // AKPD: persentase "Ya" per bidang & butir, siswa dengan kebutuhan terbanyak.
  let akpd = null;
  if (s.jenis === "AKPD") {
    const butir = s.pertanyaan.filter(p => p.kelompok);
    const ya = (r: typeof respons[number], pid: string) => (r.jawaban as Jawaban)[pid] === "Ya";
    const perBidang = Object.entries(BIDANG_AKPD).map(([k, label]) => {
      const b = butir.filter(p => p.kelompok === k);
      const total = b.length * respons.length;
      const jml = respons.reduce((a, r) => a + b.filter(p => ya(r, p.id)).length, 0);
      return { kunci: k, label, persen: total ? Math.round((jml / total) * 100) : 0 };
    });
    const perButir = butir.map(p => ({ teks: p.teks, bidang: BIDANG_AKPD[p.kelompok ?? ""] ?? "", persen: respons.length ? Math.round((respons.filter(r => ya(r, p.id)).length / respons.length) * 100) : 0 }))
      .sort((a, b) => b.persen - a.persen);
    const siswaPrioritas = respons.filter(r => r.studentId).map(r => {
      const per = Object.fromEntries(Object.keys(BIDANG_AKPD).map(k => [k, butir.filter(p => p.kelompok === k && ya(r, p.id)).length]));
      return { nama: namaSiswa.get(r.studentId!) ?? "-", kelas: namaKelas.get(r.kelasId ?? "") ?? "-", total: Object.values(per).reduce((a, b) => a + b, 0), per };
    }).sort((a, b) => b.total - a.total).slice(0, 50);
    akpd = { perBidang, perButir, siswaPrioritas };
  }

  // Sosiometri: berapa kali tiap siswa dipilih, pilihan timbal balik, siswa yang tidak dipilih siapa pun.
  let sosiometri = null;
  if (s.jenis === "SOSIOMETRI") {
    const qTeman = s.pertanyaan.filter(p => p.tipe === "TEMAN");
    sosiometri = s.targetKelasIds.map(kid => {
      const anggota = siswa.filter(x => x.classId === kid);
      const dariKelas = respons.filter(r => r.kelasId === kid && r.studentId);
      const hitung = new Map(anggota.map(a => [a.id, 0]));
      const pilih = new Map<string, Set<string>>();
      for (const r of dariKelas) {
        const set = new Set<string>();
        for (const q of qTeman) for (const t of ((r.jawaban as Jawaban)[q.id] as string[] | undefined) ?? []) { set.add(t); }
        pilih.set(r.studentId!, set);
        for (const t of set) if (hitung.has(t)) hitung.set(t, (hitung.get(t) ?? 0) + 1);
      }
      const timbal: [string, string][] = [];
      for (const [a, set] of pilih) for (const b of set) if (a < b && pilih.get(b)?.has(a)) timbal.push([namaSiswa.get(a) ?? "-", namaSiswa.get(b) ?? "-"]);
      const daftar = anggota.map(a => ({ id: a.id, nama: a.user.name, dipilih: hitung.get(a.id) ?? 0, mengisi: pilih.has(a.id) })).sort((x, y) => y.dipilih - x.dipilih || x.nama.localeCompare(y.nama));
      return { kelasId: kid, kelas: namaKelas.get(kid) ?? "-", responden: dariKelas.length, anggota: anggota.length, siswa: daftar, timbalBalik: timbal, terisolasi: daftar.filter(d => d.dipilih === 0 && d.mengisi).map(d => d.nama),
        // Sisi graf pertemanan: [pemilih, dipilih], hanya antar anggota kelas itu (11 Okt 2026).
        pilihan: [...pilih].flatMap(([a, set]) => [...set].filter(b => hitung.has(b) && hitung.has(a)).map(b => [a, b] as [string, string])) };
    });
  }

  if (new URL(req.url).searchParams.get("format") === "xlsx") {
    const kolom = s.pertanyaan.map((p, i) => `${i + 1}. ${p.teks.slice(0, 60)}`);
    const baris = respons.map((r, i) => {
      const j = r.jawaban as Jawaban;
      const nama = s.anonim ? "Anonim" : r.studentId ? namaSiswa.get(r.studentId) ?? "-" : namaUser.get(r.userId ?? "") ?? "-";
      return [i + 1, nama, r.peran, namaKelas.get(r.kelasId ?? "") ?? "", ...s.pertanyaan.map(p => {
        const v = j[p.id];
        if (v === undefined || v === null) return "";
        if (p.tipe === "TEMAN") return (v as string[]).map(x => namaSiswa.get(x) ?? "?").join(", ");
        return Array.isArray(v) ? v.join(", ") : typeof v === "number" ? v : String(v);
      })];
    });
    const lembar = [
      { nama: "Jawaban", headers: ["No", "Nama", "Peran", "Kelas", ...kolom], rows: baris },
      { nama: "Ringkasan", headers: ["Pertanyaan", "Pilihan", "Jumlah"], rows: pertanyaan.flatMap(p => ("opsi" in p && p.opsi ? p.opsi.map(o => [p.teks, o.label, o.jumlah]) : [[p.teks, "(dijawab)", p.dijawab]])) },
    ];
    if (sosiometri) lembar.push({ nama: "Sosiometri", headers: ["Kelas", "Siswa", "Dipilih", "Mengisi"], rows: sosiometri.flatMap(k => k.siswa.map(x => [k.kelas, x.nama, x.dipilih, x.mengisi ? "Ya" : "Belum"])) });
    if (akpd) lembar.push({ nama: "AKPD Siswa", headers: ["Nama", "Kelas", "Total", ...Object.values(BIDANG_AKPD)], rows: akpd.siswaPrioritas.map(x => [x.nama, x.kelas, x.total, ...Object.keys(BIDANG_AKPD).map(k => x.per[k])]) });
    return balasanExcelBanyakSheet(`hasil-survei-${s.createdAt.toISOString().slice(0, 10)}`, lembar);
  }

  return Response.json({
    survei: { id: s.id, judul: s.judul, jenis: s.jenis, anonim: s.anonim, status: s.status },
    total: respons.length, sasaran, pertanyaan, akpd, sosiometri,
    perKelas: s.anonim ? [] : [...respons.reduce((m, r) => m.set(r.kelasId ?? "", (m.get(r.kelasId ?? "") ?? 0) + 1), new Map<string, number>())]
      .filter(([k]) => k).map(([k, n]) => ({ kelas: namaKelas.get(k) ?? "-", jumlah: n })).sort((a, b) => a.kelas.localeCompare(b.kelas, "id", { numeric: true })),
  });
}
