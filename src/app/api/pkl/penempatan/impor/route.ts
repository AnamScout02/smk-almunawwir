import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { balasTolak, muatPeserta, sesiPkl, tanggalDari, sinkronLatar, siswaDiDudi } from "@/lib/pkl-server";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";
import { selesaiDari } from "@/lib/pkl-label";

export const dynamic = "force-dynamic";

const KOLOM = ["NIS", "Nama", "Kelas", "DUDI", "Guru Pembimbing", "Mulai (TTTT-BB-HH)", "Lama (bulan)", "Posisi"];
const kunci = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** TEMPLATE impor penempatan: seluruh peserta PKL (terisi data sekarang) + sheet daftar nama DUDI & guru yang sah. */
export async function GET() {
  try {
    await sesiPkl();
    const [peserta, dudi, guru] = await Promise.all([
      muatPeserta(),
      prisma.industryPartner.findMany({ where: { aktif: true }, select: { name: true, quota: true, kecamatan: true }, orderBy: { name: "asc" } }),
      prisma.teacher.findMany({ where: { teacherStatus: "AKTIF" }, select: { user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
    ]);
    return balasanExcelBanyakSheet("template-penempatan-pkl", [
      { nama: "Penempatan", headers: KOLOM, rows: peserta.filter(p => p.status !== "CANCELLED").map(p => [p.nis, p.nama, p.kelas ?? "", p.tempat ?? "", p.guru ?? "", p.mulai, p.lamaBulan ?? "", p.posisi]) },
      { nama: "Daftar DUDI", headers: ["Nama DUDI (salin persis)", "Kuota", "Kecamatan"], rows: dudi.map(d => [d.name, d.quota ?? "", d.kecamatan ?? ""]) },
      { nama: "Daftar Guru", headers: ["Nama guru (salin persis)"], rows: guru.map(g => [g.user.name]) },
    ]);
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}

/** IMPOR PENEMPATAN DARI EXCEL (9 Okt 2026). Dua langkah: tanpa `terapkan` = PRATINJAU (tidak menulis apa pun), dengan
 *  `terapkan=1` = baris yang sah diterapkan. Aturannya sama dengan layar: DUDI harus ada di katalog (nama dicocokkan
 *  tanpa beda huruf besar/spasi, tidak pernah ditebak), sel kosong = tidak diubah, dan siswa yang PKL-nya sudah berjalan
 *  di DUDI lain DITOLAK (wajib lewat Mutasi). Hanya siswa yang SUDAH peserta PKL — memasukkan peserta tetap lewat layar. */
export async function POST(req: Request) {
  try {
    const session = await sesiPkl();
    const fd = await req.formData();
    const file = fd.get("file"), terapkan = fd.get("terapkan") === "1";
    if (!(file instanceof File) || file.size > 4 * 1024 * 1024) return Response.json({ error: "Pilih berkas .xlsx (maksimal 4 MB)." }, { status: 400 });
    let rows: Record<string, unknown>[];
    try {
      const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true });
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames.includes("Penempatan") ? "Penempatan" : wb.SheetNames[0]], { defval: "", raw: true });
    } catch { return Response.json({ error: "Berkas tidak bisa dibaca sebagai Excel." }, { status: 400 }); }
    if (!rows.length || !("NIS" in rows[0])) return Response.json({ error: "Kolom NIS tidak ditemukan. Pakai template dari tombol Unduh Template." }, { status: 400 });
    if (rows.length > 1500) return Response.json({ error: "Terlalu banyak baris (maksimal 1.500)." }, { status: 400 });

    const [pkl, dudi, guru] = await Promise.all([
      prisma.internship.findMany({ select: { id: true, mitraId: true, teacherId: true, startDate: true, endDate: true, lamaBulan: true, position: true, status: true, student: { select: { nis: true, user: { select: { name: true } } } } } }),
      prisma.industryPartner.findMany({ select: { id: true, name: true, aktif: true, quota: true } }),
      prisma.teacher.findMany({ where: { teacherStatus: "AKTIF" }, select: { id: true, user: { select: { name: true } } } }),
    ]);
    const perNis = new Map(pkl.map(p => [kunci(p.student.nis), p]));
    const kelompok = <T,>(a: T[], k: (x: T) => string) => a.reduce((m, x) => m.set(k(x), [...(m.get(k(x)) ?? []), x]), new Map<string, T[]>());
    const perDudi = kelompok(dudi, d => kunci(d.name)), perGuru = kelompok(guru, g => kunci(g.user.name));
    const kini = new Date();
    type Ubah = { mitraId?: string; company?: string; teacherId?: string; startDate?: Date; endDate?: Date; lamaBulan?: number; position?: string };
    const hasil: { baris: number; nis: string; nama: string; status: "UBAH" | "SAMA" | "GALAT"; ket: string }[] = [];
    const tulis: { id: string; data: Ubah }[] = [];
    const tambahPerDudi = new Map<string, number>();
    const sudah = new Set<string>();
    rows.forEach((r, i) => {
      const nis = String(r["NIS"] ?? "").trim();
      if (!nis) return;
      const p = perNis.get(kunci(nis)), baris = i + 2;
      const catat = (status: "UBAH" | "SAMA" | "GALAT", ket: string) => hasil.push({ baris, nis, nama: p?.student.user.name ?? String(r["Nama"] ?? ""), status, ket });
      if (!p) return catat("GALAT", "NIS ini bukan peserta PKL");
      if (sudah.has(p.id)) return catat("GALAT", "NIS muncul dua kali di berkas");
      sudah.add(p.id);
      if (p.status === "CANCELLED") return catat("GALAT", "PKL siswa ini dibatalkan");
      const data: Ubah = {}, ket: string[] = [];
      const namaDudi = kunci(r["DUDI"]);
      if (namaDudi) {
        const c = perDudi.get(namaDudi) ?? [];
        if (c.length !== 1) return catat("GALAT", c.length ? "nama DUDI dipakai lebih dari satu DUDI" : `DUDI "${String(r["DUDI"]).trim()}" tidak ada di Data DUDI`);
        if (c[0].id !== p.mitraId) {
          if (!c[0].aktif) return catat("GALAT", `${c[0].name} sedang dinonaktifkan`);
          if (p.mitraId && p.status === "ONGOING" && p.startDate <= kini) return catat("GALAT", "PKL sudah berjalan di tempat lain — pindah lewat Mutasi");
          data.mitraId = c[0].id; data.company = c[0].name; ket.push(`DUDI → ${c[0].name}`);
          tambahPerDudi.set(c[0].id, (tambahPerDudi.get(c[0].id) ?? 0) + 1);
        }
      }
      const namaGuru = kunci(r["Guru Pembimbing"]);
      if (namaGuru) {
        const c = perGuru.get(namaGuru) ?? [];
        if (c.length !== 1) return catat("GALAT", c.length ? "nama guru dimiliki lebih dari satu guru" : `guru "${String(r["Guru Pembimbing"]).trim()}" tidak ditemukan`);
        if (c[0].id !== p.teacherId) { data.teacherId = c[0].id; ket.push(`guru → ${c[0].user.name}`); }
      }
      const mentahMulai = r[KOLOM[5]] ?? r["Mulai"];
      const mulai = mentahMulai instanceof Date ? new Date(Date.UTC(mentahMulai.getFullYear(), mentahMulai.getMonth(), mentahMulai.getDate())) : tanggalDari(String(mentahMulai ?? "").trim());
      const lamaMentah = String(r[KOLOM[6]] ?? r["Lama"] ?? "").trim();
      const lama = /^\d{1,2}$/.test(lamaMentah) && +lamaMentah >= 1 && +lamaMentah <= 12 ? +lamaMentah : null;
      if (String(mentahMulai ?? "").trim() && !mulai) return catat("GALAT", "tanggal mulai tidak terbaca (pakai TTTT-BB-HH)");
      if (lamaMentah && !lama) return catat("GALAT", "lama PKL harus angka 1–12 (bulan)");
      const mulaiBaru = mulai && mulai.getTime() !== p.startDate.getTime() ? mulai : null;
      const lamaBaru = lama && lama !== p.lamaBulan ? lama : null;
      if (mulaiBaru || lamaBaru) {
        const m = mulaiBaru ?? p.startDate, l = lama ?? p.lamaBulan;
        data.startDate = m; if (l) { data.lamaBulan = l; data.endDate = utc(selesaiDari(m.toISOString().slice(0, 10), l)); }
        else data.endDate = new Date(m.getTime() + (p.endDate.getTime() - p.startDate.getTime()));
        ket.push(`masa ${m.toISOString().slice(0, 10)}${l ? `, ${l} bulan` : ""}`);
      }
      const posisi = String(r["Posisi"] ?? "").trim().slice(0, 120);
      if (posisi && posisi !== (p.position === "—" ? "" : p.position)) { data.position = posisi; ket.push("posisi"); }
      if (!ket.length) return catat("SAMA", "tidak ada perubahan");
      tulis.push({ id: p.id, data }); catat("UBAH", ket.join(" · "));
    });
    // Peringatan kuota dihitung untuk seluruh berkas (tidak menolak — sama seperti layar, keputusan di tangan panitia).
    const terisi = new Map<string, number>(); for (const p of pkl) if (p.mitraId && p.status === "ONGOING") terisi.set(p.mitraId, (terisi.get(p.mitraId) ?? 0) + 1);
    const peringatan = [...tambahPerDudi].flatMap(([id, n]) => { const d = dudi.find(x => x.id === id)!; const jadi = (terisi.get(id) ?? 0) + n; return d.quota != null && jadi > d.quota ? [`${d.name}: kuota ${d.quota}, menjadi ${jadi} siswa`] : []; });
    const ringkas = { ubah: tulis.length, sama: hasil.filter(h => h.status === "SAMA").length, galat: hasil.filter(h => h.status === "GALAT").length };
    if (!terapkan) return Response.json({ pratinjau: true, ringkas, peringatan, hasil: hasil.filter(h => h.status !== "SAMA").slice(0, 400) });
    if (!tulis.length) return Response.json({ error: "Tidak ada baris yang bisa diterapkan." }, { status: 400 });
    await prisma.$transaction(tulis.map(t => prisma.internship.update({ where: { id: t.id }, data: t.data })));
    await logActivity(session, { action: "UPDATE", entity: "Internship", description: `Impor penempatan PKL dari Excel: ${tulis.length} siswa diubah, ${ringkas.galat} baris ditolak` }).catch(() => null);
    sinkronLatar(() => prisma.internship.findMany({ where: { id: { in: tulis.map(t => t.id) } }, select: { studentId: true } }).then(x => x.map(y => y.studentId)));
    return Response.json({ ok: true, ringkas });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
function utc(s: string) { return new Date(`${s}T00:00:00Z`); }
