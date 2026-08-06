import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertJabatan } from "@/lib/jabatan-guard";
import { computeFinalScore, getRawJabatanNamesFor, resolveJabatanName } from "@/lib/kpi-engine";

type Row = { userId: string; name: string; nip: string; finalScore: number; breakdown: Awaited<ReturnType<typeof computeFinalScore>>["breakdown"] };

export const dynamic = "force-dynamic";

function defaultPeriod() {
  return new Date().toISOString().slice(0, 7);
}

// Dashboard pimpinan — ADMIN atau jabatan struktural yang lazim berwenang menilai kinerja guru.
// Fase 2+ akan lebih spesifik per-jabatan (Wakasek tertentu cuma lihat cakupannya sendiri).
async function assertKpiLeadershipAccess(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return;
  await assertJabatan(session, [
    "Kepala Sekolah", "Wakil Kepala Kurikulum", "Wakil Kepala Kesiswaan",
    "Wakil Kepala Humas", "Wakil Kepala Sarana Prasarana", "Wakil Kepala Bidang Penjamin Mutu",
  ]);
}

async function fetchByJabatan(jabatanName: string, period: string): Promise<Row[]> {
  if (jabatanName === "GURU" || jabatanName === "WALI KELAS") {
    const teachers = await prisma.teacher.findMany({
      where: { teacherStatus: "AKTIF", ...(jabatanName === "WALI KELAS" ? { homeroomOf: { some: {} } } : {}) },
      select: { userId: true, nip: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    });
    return Promise.all(teachers.map(async t => {
      const { finalScore, breakdown } = await computeFinalScore(t.userId, jabatanName, period);
      return { userId: t.userId, name: t.user.name, nip: t.nip, finalScore, breakdown };
    }));
  }
  const rawNames = getRawJabatanNamesFor(jabatanName);
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { teacher: { jabatan: { some: { jabatan: { name: { in: rawNames } } } } } },
        { staffJabatan: { some: { jabatan: { name: { in: rawNames } } } } },
      ],
    },
    select: { id: true, name: true, teacher: { select: { nip: true } } },
    orderBy: { name: "asc" },
  });
  return Promise.all(users.map(async u => {
    const { finalScore, breakdown } = await computeFinalScore(u.id, jabatanName, period);
    return { userId: u.id, name: u.name, nip: u.teacher?.nip ?? "-", finalScore, breakdown };
  }));
}

// Mode "Semua Jabatan (Gabungan)" — bukan sekadar concat semua jabatan (itu bisa bikin 1 orang
// muncul 2x kalau dia py >1 jabatan, mis. Waka Kurikulum yang juga guru), tapi 1 baris per ORANG
// pakai jabatanName HASIL RESOLVE-nya masing2 (sama seperti yang dipakai "Kinerja Saya") — supaya
// skor yang tampil konsisten dgn apa yang orang itu lihat sendiri, bukan skor versi jabatan lain.
async function fetchAllCombined(period: string): Promise<Row[]> {
  const [teachers, staffUsers] = await Promise.all([
    prisma.teacher.findMany({ where: { teacherStatus: "AKTIF" }, select: { userId: true, nip: true, user: { select: { name: true } } } }),
    prisma.user.findMany({ where: { staffJabatan: { some: {} } }, select: { id: true, name: true, teacher: { select: { nip: true } } } }),
  ]);
  const candidates = new Map<string, { name: string; nip: string }>();
  for (const t of teachers) candidates.set(t.userId, { name: t.user.name, nip: t.nip });
  for (const u of staffUsers) if (!candidates.has(u.id)) candidates.set(u.id, { name: u.name, nip: u.teacher?.nip ?? "-" });

  const rows = await Promise.all([...candidates.entries()].map(async ([userId, info]) => {
    const jn = await resolveJabatanName(userId);
    if (!jn) return null;
    const { finalScore, breakdown } = await computeFinalScore(userId, jn, period);
    return { userId, name: info.name, nip: info.nip, finalScore, breakdown };
  }));
  return rows.filter((r): r is Row => r !== null);
}

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertKpiLeadershipAccess(session);

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || defaultPeriod();
    const jabatanName = searchParams.get("jabatanName") || "GURU";
    // "final" (default) urut skor akhir; kalau diisi nama indikator (mis. "Kehadiran"), urut
    // berdasarkan skor indikator ITU SAJA — supaya pimpinan bisa lihat ranking per-aspek, bukan
    // cuma skor gabungan (mis. "siapa paling rajin hadir" tanpa terpengaruh indikator lain).
    const sortBy = searchParams.get("sortBy") || "final";

    // Cakupan pegawai yang disertakan HARUS cocok dengan jabatanName yang diminta — yang bukan
    // pemegang jabatan itu tidak ikut disertakan, supaya tidak muncul skor 0 palsu utk indikator
    // yang memang bukan tanggung jawabnya. "GURU"/"WALI KELAS" masih berbasis Teacher (guru selalu
    // py Teacher record); jabatan struktural lain (Wakasek/TU/Operator/Bendahara) berbasis User
    // langsung — sebagian pemegangnya staf TAS TANPA Teacher record sama sekali.
    const list: Row[] = jabatanName === "ALL" ? await fetchAllCombined(period) : await fetchByJabatan(jabatanName, period);

    if (sortBy === "final") {
      list.sort((a, b) => b.finalScore - a.finalScore);
    } else {
      const scoreOf = (row: (typeof list)[number]) => row.breakdown.find(b => b.name === sortBy)?.score ?? 0;
      list.sort((a, b) => scoreOf(b) - scoreOf(a));
    }

    return NextResponse.json({ period, jabatanName, sortBy, list });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus pimpinan/wakasek." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
