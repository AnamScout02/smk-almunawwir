import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { hakTugas, penerimaTugas, PRIORITAS, untukSaya } from "@/lib/tugas-internal";

export const dynamic = "force-dynamic";

/** Daftar tugas: pemberi/pimpinan melihat semua, pegawai lain hanya tugas untuk dirinya. */
export async function GET(req: Request) {
  const session = await verifySession();
  const hak = await hakTugas(session);
  const saring = new URL(req.url).searchParams.get("cakupan"); // "saya" = paksa hanya tugas saya
  const where = hak.bolehLihatSemua && saring !== "saya" ? {} : untukSaya(session.userId, hak.jabatan);
  const [daftar, jabatan] = await Promise.all([
    prisma.tugasInternal.findMany({ where, orderBy: [{ status: "asc" }, { tenggat: "asc" }, { createdAt: "desc" }], take: 300 }),
    hak.bolehMemberi ? prisma.jabatan.findMany({ select: { name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const pegawai = hak.bolehMemberi
    ? await prisma.user.findMany({
        where: { role: { in: ["TEACHER", "TAS", "ADMIN"] } }, select: { id: true, name: true }, orderBy: { name: "asc" },
      }).catch(() => [])
    : [];
  return Response.json({
    ...hak, daftar,
    jabatan: jabatan.map(j => j.name),
    pegawai,
    saya: session.userId,
  });
}

export async function POST(req: Request) {
  const session = await verifySession();
  const hak = await hakTugas(session);
  if (!hak.bolehMemberi) return Response.json({ error: "Hanya pimpinan & Tata Usaha yang bisa memberi tugas." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const judul = String(b.judul ?? "").trim().slice(0, 200);
  if (!judul) return Response.json({ error: "Judul tugas wajib diisi." }, { status: 400 });
  const penerimaId = typeof b.penerimaId === "string" && b.penerimaId ? b.penerimaId : null;
  const targetJabatan = Array.isArray(b.targetJabatan) ? b.targetJabatan.filter((x: unknown) => typeof x === "string").slice(0, 10) : [];
  if (!penerimaId && targetJabatan.length === 0) return Response.json({ error: "Pilih penerima atau jabatan sasaran." }, { status: 400 });
  const penerima = penerimaId ? await prisma.user.findUnique({ where: { id: penerimaId }, select: { name: true } }) : null;
  if (penerimaId && !penerima) return Response.json({ error: "Penerima tidak ditemukan." }, { status: 400 });

  const tugas = await prisma.tugasInternal.create({
    data: {
      judul, rincian: String(b.rincian ?? "").trim().slice(0, 2000) || null,
      pemberiId: session.userId, pemberiNama: session.name,
      penerimaId, penerimaNama: penerima?.name ?? null, targetJabatan,
      prioritas: PRIORITAS.includes(b.prioritas) ? b.prioritas : "NORMAL",
      tenggat: b.tenggat ? new Date(b.tenggat) : null,
    },
  });

  kirimLatar(async () => {
    const tujuan = await penerimaTugas(tugas);
    for (const userId of tujuan) {
      await kirimNotifikasi({
        userIds: [userId], kunci: `tugas-internal:${tugas.id}:${userId}`, jenis: "TUGAS_INTERNAL",
        judul: `Tugas baru: ${tugas.judul}`,
        isi: `${tugas.pemberiNama}${tugas.tenggat ? ` · tenggat ${tugas.tenggat.toLocaleDateString("id-ID", { day: "numeric", month: "long", timeZone: "Asia/Jakarta" })}` : ""}`,
        url: "/dashboard/teacher/tugas",
      });
    }
  });
  return Response.json({ id: tugas.id }, { status: 201 });
}
