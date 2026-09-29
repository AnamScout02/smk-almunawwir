import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { PENGATURAN_NOTIFIKASI } from "@/lib/pengingat-terjadwal";
import { pushTersedia } from "@/lib/push-server";
import { logActivity } from "@/lib/activity-log";
import { bersihkanCacheLibur, daftarLibur, infoLiburNasional, perbaruiLiburNasional } from "@/lib/hari-libur";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const LABEL_PERAN: Record<string, string> = { ADMIN: "Admin", TAS: "TAS", TEACHER: "Guru", STUDENT: "Siswa", PARENT: "Orang Tua" };

/** NOTIFIKASI PUSH — khusus ADMIN: pengaturan pengingat terjadwal, jumlah perangkat berlangganan, riwayat kiriman. */
export async function GET() {
  try {
    await verifyRole(["ADMIN"]);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [s, langganan, riwayat] = await Promise.all([
    getSettings(Object.values(PENGATURAN_NOTIFIKASI)),
    prisma.pushSubscription.findMany({ select: { userId: true, user: { select: { role: true } } } }),
    prisma.notifikasiTerkirim.findMany({
      orderBy: { createdAt: "desc" }, take: 60,
      select: { id: true, jenis: true, judul: true, isi: true, jumlahPenerima: true, jumlahPerangkat: true, createdAt: true },
    }),
  ]);
  await perbaruiLiburNasional().catch(() => null);
  const hariIniWib = Date.now() + 7 * 3600_000;
  const [liburMendatang, liburNasional] = await Promise.all([
    daftarLibur(new Date(hariIniWib).toISOString().slice(0, 10), new Date(hariIniWib + 120 * 86_400_000).toISOString().slice(0, 10)),
    infoLiburNasional(),
  ]);
  const perPeran = new Map<string, { perangkat: number; pengguna: Set<string> }>();
  for (const l of langganan) {
    const p = perPeran.get(l.user.role) ?? { perangkat: 0, pengguna: new Set<string>() };
    p.perangkat++; p.pengguna.add(l.userId);
    perPeran.set(l.user.role, p);
  }
  return Response.json({
    tersedia: pushTersedia(),
    pengaturan: {
      aktif: s[PENGATURAN_NOTIFIKASI.aktif] !== "0",
      jamAbsensi: s[PENGATURAN_NOTIFIKASI.jamAbsensi] ?? "",
      jamPiket: s[PENGATURAN_NOTIFIKASI.jamPiket] ?? "",
      jamJurnal: s[PENGATURAN_NOTIFIKASI.jamJurnal] ?? "",
      jamPeringatanDini: s[PENGATURAN_NOTIFIKASI.jamPeringatanDini] ?? "",
      jamPerpustakaan: s[PENGATURAN_NOTIFIKASI.jamPerpustakaan] ?? "",
      jamRekapKelas: s[PENGATURAN_NOTIFIKASI.jamRekapKelas] ?? "",
      jamRingkasanOrtu: s[PENGATURAN_NOTIFIKASI.jamRingkasanOrtu] ?? "",
      tanggalLibur: (s[PENGATURAN_NOTIFIKASI.tanggalLibur] ?? "").split(/[\s,;]+/).filter(Boolean).sort(),
      liburNasional: s[PENGATURAN_NOTIFIKASI.liburNasional] !== "0",
    },
    libur: { mendatang: liburMendatang.filter(l => l.sumber !== "MINGGU"), nasional: liburNasional },
    perangkat: {
      total: langganan.length,
      pengguna: new Set(langganan.map(l => l.userId)).size,
      perPeran: ["TEACHER", "STUDENT", "PARENT", "ADMIN", "TAS"].map(r => ({
        peran: LABEL_PERAN[r], perangkat: perPeran.get(r)?.perangkat ?? 0, pengguna: perPeran.get(r)?.pengguna.size ?? 0,
      })),
    },
    riwayat,
  });
}

const JAM = /^([01]?\d|2[0-3])[:.][0-5]\d$/;
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

function rapikanJam(teks: unknown): string | null {
  const daftar = String(teks ?? "").split(/[\s,;]+/).filter(Boolean);
  if (daftar.some(j => !JAM.test(j))) return null;
  return [...new Set(daftar.map(j => { const [h, m] = j.split(/[:.]/); return `${h.padStart(2, "0")}:${m}`; }))].sort().join(",");
}

export async function PUT(req: Request) {
  let session: Awaited<ReturnType<typeof verifyRole>>;
  try {
    session = await verifyRole(["ADMIN"]);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as {
    aktif?: boolean; jamAbsensi?: string; jamPiket?: string; jamJurnal?: string; jamPeringatanDini?: string; jamPerpustakaan?: string; jamRekapKelas?: string; jamRingkasanOrtu?: string; tanggalLibur?: string[]; liburNasional?: boolean;
  };
  const jamAbsensi = rapikanJam(b.jamAbsensi);
  const jamPiket = rapikanJam(b.jamPiket);
  const jamJurnal = rapikanJam(b.jamJurnal);
  const jamPeringatanDini = rapikanJam(b.jamPeringatanDini);
  const jamPerpustakaan = rapikanJam(b.jamPerpustakaan);
  const jamRekapKelas = rapikanJam(b.jamRekapKelas);
  const jamRingkasanOrtu = rapikanJam(b.jamRingkasanOrtu);
  if (jamAbsensi === null || jamPiket === null || jamJurnal === null || jamPeringatanDini === null || jamPerpustakaan === null || jamRekapKelas === null || jamRingkasanOrtu === null) {
    return Response.json({ error: "Format jam harus JJ:MM (contoh 07:30), dipisah koma." }, { status: 400 });
  }
  const libur = [...new Set((b.tanggalLibur ?? []).map(String))].filter(t => TANGGAL.test(t)).sort();
  const nilai: Record<string, string> = {
    [PENGATURAN_NOTIFIKASI.aktif]: b.aktif === false ? "0" : "1",
    [PENGATURAN_NOTIFIKASI.jamAbsensi]: jamAbsensi,
    [PENGATURAN_NOTIFIKASI.jamPiket]: jamPiket,
    [PENGATURAN_NOTIFIKASI.jamJurnal]: jamJurnal,
    [PENGATURAN_NOTIFIKASI.jamPeringatanDini]: jamPeringatanDini,
    [PENGATURAN_NOTIFIKASI.jamPerpustakaan]: jamPerpustakaan,
    [PENGATURAN_NOTIFIKASI.jamRekapKelas]: jamRekapKelas,
    [PENGATURAN_NOTIFIKASI.jamRingkasanOrtu]: jamRingkasanOrtu,
    [PENGATURAN_NOTIFIKASI.tanggalLibur]: libur.join(","),
    [PENGATURAN_NOTIFIKASI.liburNasional]: b.liburNasional === false ? "0" : "1",
  };
  await prisma.$transaction(Object.entries(nilai).map(([key, value]) =>
    prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } })));
  bersihkanCacheLibur();
  await logActivity(session, {
    action: "UBAH_PENGATURAN_NOTIFIKASI", entity: "SiteSetting", entityId: "notifikasi",
    description: `${session.name} mengubah pengingat notifikasi (${nilai[PENGATURAN_NOTIFIKASI.aktif] === "1" ? "aktif" : "nonaktif"}; absensi ${jamAbsensi || "-"}; piket ${jamPiket || "-"}; jurnal ${jamJurnal || "-"}; ${libur.length} tanggal libur)`,
  });
  return Response.json({ ok: true });
}
