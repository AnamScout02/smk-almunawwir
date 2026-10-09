import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { balasTolak, sesiPkl, sinkronLatar, siswaDiDudi } from "@/lib/pkl-server";
import { getSettings } from "@/lib/site-settings";
import { balasanExcel } from "@/lib/ekspor-excel";
import { hariPkl } from "@/lib/pkl-harian";
import { predikatPkl } from "@/lib/pkl-label";
import { KOMPONEN_NILAI, bacaBobot, hitungNilaiPkl } from "@/lib/pkl-nilai";

export const dynamic = "force-dynamic";

async function susun() {
  const [s, pkl] = await Promise.all([
    getSettings(["pkl.bobotNilai"]),
    prisma.internship.findMany({
      where: { mitraId: { not: null }, status: { not: "CANCELLED" }, student: { studentStatus: "AKTIF" } },
      orderBy: [{ student: { class: { name: "asc" } } }, { student: { user: { name: "asc" } } }],
      select: {
        id: true, studentId: true, company: true, startDate: true, endDate: true, status: true, nilaiIndustriRata: true, laporanAkhirStatus: true, nilaiAkhirRata: true,
        student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
        presensi: { select: { status: true } },
        _count: { select: { journal: true } },
      },
    }),
  ]);
  const bobot = bacaBobot(s["pkl.bobotNilai"]);
  const guru = await prisma.grade.findMany({ where: { studentId: { in: pkl.map(p => p.studentId) }, subject: "PKL", type: "Nilai PKL" }, orderBy: { createdAt: "desc" }, select: { studentId: true, score: true } });
  const nilaiGuru = new Map<string, number>(); for (const g of guru) if (!nilaiGuru.has(g.studentId)) nilaiGuru.set(g.studentId, g.score);
  const hari = hariPkl();
  const baris = pkl.map(p => {
    const h = hitungNilaiPkl({
      nilaiIndustri: p.nilaiIndustriRata, nilaiGuru: nilaiGuru.get(p.studentId) ?? null, jumlahJurnal: p._count.journal, mulai: p.startDate, selesai: p.endDate,
      presensi: { hadir: p.presensi.filter(x => x.status === "HADIR").length, total: p.presensi.length }, laporanStatus: p.laporanAkhirStatus,
    }, bobot, hari);
    return { id: p.id, nama: p.student.user.name, nis: p.student.nis, kelas: p.student.class?.name ?? null, tempat: p.company, status: p.status, ...h, ditetapkan: p.nilaiAkhirRata };
  });
  return { bobot, baris };
}

/** Nilai akhir PKL berbobot seluruh siswa yang sudah ditempatkan. `?excel=1` = unduhan. */
export async function GET(req: NextRequest) {
  try {
    await sesiPkl();
    const { bobot, baris } = await susun();
    if (req.nextUrl.searchParams.get("excel") !== "1") return Response.json({ bobot, baris, komponen: KOMPONEN_NILAI });
    return balasanExcel({
      namaFile: `nilai-akhir-pkl-${new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)}`, namaSheet: "Nilai Akhir PKL",
      headers: ["No", "NIS", "Nama", "Kelas", "Tempat PKL", ...KOMPONEN_NILAI.map(k => `${k.label} (${bobot[k.kunci]}%)`), "Nilai akhir (hitungan)", "Predikat", "Nilai ditetapkan", "Komponen belum ada"],
      rows: baris.map((b, i) => [i + 1, b.nis, b.nama, b.kelas ?? "", b.tempat, ...KOMPONEN_NILAI.map(k => b.komponen[k.kunci] ?? ""), b.akhir ?? "", b.akhir != null ? predikatPkl(b.akhir) : "", b.ditetapkan ?? "", b.kosong.join(", ")]),
    });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}

/** Ubah bobot (jumlahnya tidak harus 100 — dinormalkan saat menghitung). */
export async function PUT(req: Request) {
  try {
    const session = await sesiPkl();
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const bobot = bacaBobot(JSON.stringify(b.bobot ?? {}));
    await prisma.siteSetting.upsert({ where: { key: "pkl.bobotNilai" }, create: { key: "pkl.bobotNilai", value: JSON.stringify(bobot) }, update: { value: JSON.stringify(bobot) } });
    await logActivity(session, { action: "UPDATE", entity: "SiteSetting", description: `Bobot nilai akhir PKL diubah: ${KOMPONEN_NILAI.map(k => `${k.kunci} ${bobot[k.kunci]}`).join(", ")}` }).catch(() => null);
    return Response.json({ ok: true, bobot });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}

/** TETAPKAN: simpan nilai hitungan sebagai nilai akhir (`Internship.nilaiAkhir*`) supaya arsip & sertifikat tidak berubah
 *  lagi walau bobot diubah kemudian. Hanya siswa yang dikirim, dan hanya yang hitungannya ada. */
export async function POST(req: Request) {
  try {
    const session = await sesiPkl();
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const ids = new Set(Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string").slice(0, 600) : []);
    if (!ids.size) return Response.json({ error: "Pilih siswa yang nilainya ditetapkan." }, { status: 400 });
    const { bobot, baris } = await susun();
    const kena = baris.filter(x => ids.has(x.id) && x.akhir != null && (b.hanyaLengkap !== true || x.lengkap));
    await prisma.$transaction(kena.map(x => prisma.internship.update({ where: { id: x.id }, data: { nilaiAkhir: { komponen: x.komponen, bobot, pada: new Date().toISOString() }, nilaiAkhirRata: x.akhir } })));
    await logActivity(session, { action: "UPDATE", entity: "Internship", description: `Nilai akhir PKL ditetapkan untuk ${kena.length} siswa` }).catch(() => null);
    sinkronLatar(() => prisma.internship.findMany({ where: { id: { in: kena.map(x => x.id) } }, select: { studentId: true } }).then(x => x.map(y => y.studentId)));
    return Response.json({ ok: true, ditetapkan: kena.length, dilewati: ids.size - kena.length });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
