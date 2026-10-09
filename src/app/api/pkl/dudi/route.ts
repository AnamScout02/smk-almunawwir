import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { balasTolak, sesiPkl, terisiPerDudi } from "@/lib/pkl-server";
import { isianDudi } from "@/lib/pkl-dudi";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await sesiPkl();
    const [dudi, terisi, selesai, jurusan] = await Promise.all([
      prisma.industryPartner.findMany({ orderBy: { name: "asc" } }),
      terisiPerDudi(),
      prisma.internship.groupBy({ by: ["mitraId"], where: { status: "COMPLETED", mitraId: { not: null } }, _count: { _all: true }, _avg: { nilaiIndustriRata: true } }),
      prisma.major.findMany({ select: { id: true, code: true, name: true, skills: true }, orderBy: { name: "asc" } }),
    ]);
    const petaSelesai = new Map(selesai.map(x => [x.mitraId as string, x]));
    // SAMBUNGAN BKK & TRACER: alumni yang menurut tracer BEKERJA di DUDI ini (nama tempat kerja = nama DUDI, tanpa
    // peduli kapital/tanda baca), dan berapa di antaranya dulu PKL di sana.
    const tracer = await prisma.alumniTracer.findMany({
      where: { status: "BEKERJA", institutionName: { not: null } },
      select: { institutionName: true, student: { select: { internship: { select: { mitraId: true } } } } },
    }).catch(() => []);
    const kunci = (v: string) => v.toUpperCase().replace(/\b(PT|CV|UD|TBK|PERSERO)\b\.?/g, " ").replace(/[^A-Z0-9]+/g, " ").trim();
    const alumni = new Map<string, { bekerja: number; eksPkl: number }>();
    for (const d of dudi) {
      const k = kunci(d.name);
      if (k.length < 3) continue;
      const cocok = tracer.filter(t => kunci(t.institutionName as string) === k);
      if (cocok.length) alumni.set(d.id, { bekerja: cocok.length, eksPkl: cocok.filter(t => t.student.internship?.mitraId === d.id).length });
    }
    return Response.json({
      jurusan,
      dudi: dudi.map(({ tokenPortalHash, ...d }) => ({
        ...d, adaPortal: !!tokenPortalHash, terisi: terisi.get(d.id) ?? 0,
        selesai: petaSelesai.get(d.id)?._count._all ?? 0, rataNilai: petaSelesai.get(d.id)?._avg.nilaiIndustriRata ?? null,
        alumniBekerja: alumni.get(d.id)?.bekerja ?? 0, alumniEksPkl: alumni.get(d.id)?.eksPkl ?? 0,
      })),
    });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await sesiPkl();
    const data = isianDudi(await req.json().catch(() => ({})));
    if (!data.name) return Response.json({ error: "Nama DUDI wajib diisi." }, { status: 400 });
    // Nama yang sama (beda kapital/spasi) hampir pasti DUDI yang sama — dua baris membuat kuota & rekapnya terbelah.
    const kembar = await prisma.industryPartner.findFirst({ where: { name: { equals: data.name, mode: "insensitive" } }, select: { id: true } });
    if (kembar) return Response.json({ error: `"${data.name}" sudah ada di daftar DUDI.` }, { status: 409 });
    const d = await prisma.industryPartner.create({ data });
    await logActivity(session, { action: "CREATE", entity: "IndustryPartner", entityId: d.id, description: `Menambah DUDI ${d.name}` }).catch(() => null);
    return Response.json({ id: d.id, name: d.name });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
