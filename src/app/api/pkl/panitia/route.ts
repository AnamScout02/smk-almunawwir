import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { aksesHumas, aksesPusatPkl, anggotaPanitiaPkl, lupakanPanitiaPkl } from "@/lib/pkl-humas";
import { TAS_JABATAN } from "@/lib/tas-jabatan";

export const dynamic = "force-dynamic";

/** PANITIA PKL (9 Okt 2026) — siapa saja yang bisa membuka & mengelola Pusat PKL. Otomatis: Admin, staf Tata Usaha penuh,
 *  Wakil Kepala Humas. Tambahan: guru/staf lain (SiteSetting `pkl.panitia`). Yang boleh MENGATUR daftar hanya yang
 *  otomatis (`aksesHumas`) — anggota tambahan tidak bisa menambahkan orang lain sendiri. */
async function simpan(ids: string[]) {
  await prisma.siteSetting.upsert({ where: { key: "pkl.panitia" }, update: { value: JSON.stringify(ids) }, create: { key: "pkl.panitia", value: JSON.stringify(ids) } });
  lupakanPanitiaPkl();
}

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    if (!(await aksesPusatPkl(session))) return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
    const [ids, humas, staf, bolehAtur] = await Promise.all([
      anggotaPanitiaPkl(),
      prisma.teacherJabatan.findMany({ where: { jabatan: { name: "Wakil Kepala Humas" } }, select: { jabatan: { select: { name: true } }, teacher: { select: { userId: true, user: { select: { name: true } } } } } }),
      prisma.staffJabatan.findMany({ where: { jabatan: { name: { in: TAS_JABATAN } } }, select: { jabatan: { select: { name: true } }, user: { select: { id: true, name: true } } } }),
      aksesHumas(session),
    ]);
    const otomatis = new Map<string, { userId: string; nama: string; jabatan: string[] }>();
    const catat = (userId: string, nama: string, jab: string) => { const o = otomatis.get(userId) ?? { userId, nama, jabatan: [] }; o.jabatan.push(jab); otomatis.set(userId, o); };
    for (const j of humas) catat(j.teacher.userId, j.teacher.user.name, j.jabatan.name);
    for (const j of staf) catat(j.user.id, j.user.name, j.jabatan.name);
    const [anggota, calon] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true, role: true, teacher: { select: { subject: true } } } }),
      bolehAtur ? prisma.user.findMany({
        where: { role: { in: ["TEACHER", "TAS"] }, id: { notIn: [...ids, ...otomatis.keys()] } }, orderBy: { name: "asc" },
        select: { id: true, name: true, role: true, teacher: { select: { subject: true } }, staffJabatan: { select: { jabatan: { select: { name: true } } } } },
      }) : Promise.resolve([]),
    ]);
    return NextResponse.json({
      bolehAtur,
      otomatis: [...otomatis.values()].sort((a, b) => a.nama.localeCompare(b.nama, "id")),
      anggota: anggota.map(u => ({ userId: u.id, nama: u.name, email: u.email, ket: u.role === "TAS" ? "Staf" : u.teacher?.subject ?? null })).sort((a, b) => a.nama.localeCompare(b.nama, "id")),
      calon: calon.map(u => ({ id: u.id, nama: u.name, ket: u.role === "TAS" ? `Staf${u.staffJabatan.length ? ` · ${u.staffJabatan.map(j => j.jabatan.name).join(", ")}` : ""}` : u.teacher?.subject ?? null })),
    });
  } catch (e) { lemparBilaPengalihan(e); return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 }); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    if (!(await aksesHumas(session))) return NextResponse.json({ error: "Hanya Admin, Tata Usaha, atau Wakil Kepala Humas yang bisa menambah panitia." }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    const userIds = [...new Set((Array.isArray(b?.userIds) ? b.userIds : [b?.userId]).filter(Boolean).map((x: unknown) => String(x)))].slice(0, 100) as string[];
    const akun = await prisma.user.findMany({ where: { id: { in: userIds }, role: { in: ["TEACHER", "TAS"] } }, select: { id: true, name: true } });
    if (!akun.length) return NextResponse.json({ error: "Pilih akun guru / staf yang akan ditambahkan." }, { status: 400 });
    await simpan([...new Set([...(await anggotaPanitiaPkl()), ...akun.map(g => g.id)])]);
    await logActivity(session, { action: "UPDATE", entity: "PanitiaPkl", description: `Menambah panitia PKL: ${akun.map(g => g.name).join(", ")}` }).catch(() => null);
    return NextResponse.json({ ok: true, jumlah: akun.length });
  } catch (e) { lemparBilaPengalihan(e); return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    if (!(await aksesHumas(session))) return NextResponse.json({ error: "Tidak berwenang." }, { status: 403 });
    const userId = req.nextUrl.searchParams.get("userId") ?? "";
    const ids = await anggotaPanitiaPkl();
    if (!ids.includes(userId)) return NextResponse.json({ error: "Akun ini bukan anggota tambahan." }, { status: 404 });
    await simpan(ids.filter(x => x !== userId));
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await logActivity(session, { action: "UPDATE", entity: "PanitiaPkl", description: `Mengeluarkan ${u?.name ?? userId} dari panitia PKL` }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 }); }
}
