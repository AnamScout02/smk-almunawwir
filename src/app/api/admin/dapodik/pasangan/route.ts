import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { verifyDapodikAccess } from "@/lib/dapodik-guard";

export const dynamic = "force-dynamic";

/** COCOKKAN MANUAL data TU ↔ Dapodik (17 Sep 2026 — permintaan user). Hanya menyimpan pasangan di tabel DapodikPasangan;
 * data TU maupun Dapodik tidak diubah. Perbandingan berikutnya (src/lib/dapodik-sinkron.ts) memakai pasangan ini paling dulu.
 * Administrator & Operator Sekolah. */

type Jenis = "siswa" | "gtk";
const jenisSah = (v: unknown): v is Jenis => v === "siswa" || v === "gtk";
const idSah = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{8,64}$/.test(v);

async function namaTu(jenis: Jenis, id: string) {
  const r = jenis === "siswa"
    ? await prisma.student.findUnique({ where: { id }, select: { user: { select: { name: true } } } })
    : await prisma.teacher.findUnique({ where: { id }, select: { user: { select: { name: true } } } });
  return r?.user.name ?? null;
}

export async function POST(req: Request) {
  const { session, bolehUbah } = await verifyDapodikAccess();
  if (!bolehUbah) return Response.json({ error: "Mencocokkan data hanya bisa dilakukan Administrator atau Operator Sekolah." }, { status: 403 });
  const b = await req.json().catch(() => null) as { jenis?: unknown; tuId?: unknown; dapodikId?: unknown; namaDapodik?: unknown } | null;
  if (!b || !jenisSah(b.jenis) || !idSah(b.tuId) || !idSah(b.dapodikId)) {
    return Response.json({ error: "Data pasangan tidak lengkap." }, { status: 400 });
  }
  const nama = await namaTu(b.jenis, b.tuId);
  if (!nama) return Response.json({ error: "Data TU yang dipilih tidak ditemukan." }, { status: 404 });
  const namaDapodik = typeof b.namaDapodik === "string" ? b.namaDapodik.trim().slice(0, 150) : "";

  // Satu data TU hanya punya satu pasangan, dan satu data Dapodik hanya satu pasangan — pasangan lama keduanya diganti.
  await prisma.$transaction([
    prisma.dapodikPasangan.deleteMany({ where: { jenis: b.jenis, OR: [{ tuId: b.tuId }, { dapodikId: b.dapodikId }] } }),
    prisma.dapodikPasangan.create({
      data: { jenis: b.jenis, tuId: b.tuId, dapodikId: b.dapodikId, namaTu: nama, namaDapodik, dibuatOleh: session.name },
    }),
  ]);
  await logActivity(session, {
    action: "COCOKKAN_DAPODIK", entity: "DapodikPasangan", entityId: b.tuId,
    description: `Mencocokkan ${b.jenis === "siswa" ? "siswa" : "GTK"} TU "${nama}" dengan data Dapodik "${namaDapodik || "—"}"`,
  }).catch(() => {});
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { session, bolehUbah } = await verifyDapodikAccess();
  if (!bolehUbah) return Response.json({ error: "Melepas pasangan hanya bisa dilakukan Administrator atau Operator Sekolah." }, { status: 403 });
  const u = new URL(req.url);
  const jenis = u.searchParams.get("jenis"), tuId = u.searchParams.get("tuId");
  if (!jenisSah(jenis) || !idSah(tuId)) return Response.json({ error: "Data pasangan tidak lengkap." }, { status: 400 });
  const lama = await prisma.dapodikPasangan.findUnique({ where: { jenis_tuId: { jenis, tuId } } });
  if (!lama) return Response.json({ error: "Pasangan manual ini sudah tidak ada." }, { status: 404 });
  await prisma.dapodikPasangan.delete({ where: { id: lama.id } });
  await logActivity(session, {
    action: "LEPAS_PASANGAN_DAPODIK", entity: "DapodikPasangan", entityId: tuId,
    description: `Melepas pasangan manual ${jenis === "siswa" ? "siswa" : "GTK"} TU "${lama.namaTu}" ↔ Dapodik "${lama.namaDapodik || "—"}"`,
  }).catch(() => {});
  return Response.json({ ok: true });
}
