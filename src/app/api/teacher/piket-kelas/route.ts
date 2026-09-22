import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export const dynamic = "force-dynamic";

const HARI = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

async function kelasWali(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return null;
  const t = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { homeroomOf: { select: { id: true } } } });
  return t?.homeroomOf.map(c => c.id) ?? [];
}

/** JADWAL PIKET KELAS (17 Sep 2026). Wali kelas mengatur kelas walinya; Admin semua kelas. */
export async function GET(req: Request) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const boleh = await kelasWali(session);
  const kelasList = await prisma.class.findMany({
    where: boleh ? { id: { in: boleh } } : undefined, select: { id: true, name: true }, orderBy: [{ grade: "asc" }, { name: "asc" }],
  });
  const classId = new URL(req.url).searchParams.get("classId") || kelasList[0]?.id || "";
  if (!classId || (boleh && !boleh.includes(classId))) return Response.json({ kelas: kelasList, siswa: [], classId: "" });
  const siswa = await prisma.student.findMany({
    where: { classId, studentStatus: "AKTIF" },
    select: { id: true, nis: true, user: { select: { name: true } }, piketKelas: { where: { classId }, select: { hari: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return Response.json({
    kelas: kelasList, classId, hari: HARI,
    siswa: siswa.map(s => ({ id: s.id, nis: s.nis, nama: s.user.name, hari: s.piketKelas[0]?.hari ?? "" })),
  });
}

export async function PUT(req: Request) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const boleh = await kelasWali(session);
  const b = await req.json().catch(() => null) as { classId?: string; jadwal?: Record<string, string> } | null;
  const classId = b?.classId ?? "";
  if (!classId || (boleh && !boleh.includes(classId))) return Response.json({ error: "Khusus wali kelas ini." }, { status: 403 });
  const siswa = new Set((await prisma.student.findMany({ where: { classId, studentStatus: "AKTIF" }, select: { id: true } })).map(s => s.id));
  const entri = Object.entries(b?.jadwal ?? {}).filter(([id]) => siswa.has(id));
  await prisma.$transaction([
    prisma.piketKelas.deleteMany({ where: { classId } }),
    prisma.piketKelas.createMany({ data: entri.filter(([, h]) => HARI.includes(h)).map(([studentId, hari]) => ({ classId, studentId, hari })) }),
  ]);
  return Response.json({ ok: true });
}
