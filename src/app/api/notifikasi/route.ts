import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { tugasHariIni } from "@/lib/tugas-hari-ini";
import { tandaiPengingatSelesai } from "@/lib/kotak-notifikasi";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** KOTAK NOTIFIKASI akun yang sedang login — semua pengingat & kabar yang pernah dikirim ke akun ini, tersimpan di
 * server (NotifikasiPengguna) sehingga tetap sampai walau notifikasi push di perangkat belum diaktifkan.
 * `?hitung=1` → hanya jumlah belum dibaca (dipakai polling lonceng). */
export async function GET(req: NextRequest) {
  let session: Awaited<ReturnType<typeof verifySession>>;
  try {
    session = await verifySession();
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hanyaHitung = !!new URL(req.url).searchParams.get("hitung");
  if (!hanyaHitung) {
    // Saat kotak dibuka: pengingat hari ini yang tugasnya sudah selesai ditandai dibaca dulu (lihat kotak-notifikasi.ts).
    const tugas = await tugasHariIni(session.userId).catch(() => null);
    if (tugas) await tandaiPengingatSelesai(session.userId, tugas).catch(() => 0);
  }
  const belumDibaca = await prisma.notifikasiPengguna.count({ where: { userId: session.userId, dibacaAt: null } });
  if (hanyaHitung) return Response.json({ belumDibaca });
  const baris = await prisma.notifikasiPengguna.findMany({
    where: { userId: session.userId }, orderBy: { createdAt: "desc" }, take: 40,
    select: { id: true, dibacaAt: true, createdAt: true, notifikasi: { select: { jenis: true, judul: true, isi: true, url: true } } },
  });
  return Response.json({
    belumDibaca,
    item: baris.map(b => ({ id: b.id, dibaca: !!b.dibacaAt, waktu: b.createdAt, ...b.notifikasi })),
  });
}

/** Tandai dibaca: `{ id }` satu notifikasi, atau `{ semua: true }`. */
export async function PUT(req: NextRequest) {
  let session: Awaited<ReturnType<typeof verifySession>>;
  try {
    session = await verifySession();
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, semua } = (await req.json().catch(() => ({}))) as { id?: string; semua?: boolean };
  if (!id && !semua) return Response.json({ error: "Tidak ada yang ditandai." }, { status: 400 });
  const r = await prisma.notifikasiPengguna.updateMany({
    where: { userId: session.userId, dibacaAt: null, ...(semua ? {} : { id }) },
    data: { dibacaAt: new Date() },
  });
  return Response.json({ ok: true, ditandai: r.count });
}
