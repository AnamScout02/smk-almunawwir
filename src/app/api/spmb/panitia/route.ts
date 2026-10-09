import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { JABATAN_SPMB, anggotaPanitia, assertSpmb, bolehAturPanitia, lupakanPanitia } from "@/lib/spmb";
import { TAS_JABATAN } from "@/lib/tas-jabatan";

export const dynamic = "force-dynamic";

/** PANITIA SPMB (7 Okt 2026) — siapa saja yang bisa membuka & mengelola Pusat SPMB.
 *  Otomatis: Admin, staf Tata Usaha penuh (TAS_JABATAN), guru pemegang JABATAN_SPMB. Tambahan: guru ATAU staf lain
 *  yang ditambahkan di sini (SiteSetting `spmb.panitia`). Mengatur daftar: Admin, staf TU penuh, pemegang jabatan panitia. */
async function simpan(ids: string[]) {
  await prisma.siteSetting.upsert({
    where: { key: "spmb.panitia" }, update: { value: JSON.stringify(ids) }, create: { key: "spmb.panitia", value: JSON.stringify(ids) },
  });
  lupakanPanitia();
}

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const [ids, jabatan, staf, bolehAtur] = await Promise.all([anggotaPanitia(), prisma.teacherJabatan.findMany({
      where: { jabatan: { name: { in: JABATAN_SPMB } } },
      select: { jabatan: { select: { name: true } }, teacher: { select: { userId: true, user: { select: { name: true } } } } },
    }), prisma.staffJabatan.findMany({
      where: { jabatan: { name: { in: TAS_JABATAN } }, user: { role: "TAS" } },
      select: { jabatan: { select: { name: true } }, user: { select: { id: true, name: true } } },
    }), bolehAturPanitia(session)]);
    const otomatis = new Map<string, { userId: string; nama: string; jabatan: string[] }>();
    const catat = (userId: string, nama: string, jab: string) => {
      const o = otomatis.get(userId) ?? { userId, nama, jabatan: [] };
      o.jabatan.push(jab);
      otomatis.set(userId, o);
    };
    for (const j of jabatan) catat(j.teacher.userId, j.teacher.user.name, j.jabatan.name);
    for (const j of staf) catat(j.user.id, j.user.name, j.jabatan.name);
    const [anggota, guru] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true, role: true, teacher: { select: { subject: true } } } }),
      bolehAtur
        ? prisma.user.findMany({
            where: { role: { in: ["TEACHER", "TAS"] }, id: { notIn: [...ids, ...otomatis.keys()] } }, orderBy: { name: "asc" },
            select: { id: true, name: true, role: true, teacher: { select: { subject: true } }, staffJabatan: { select: { jabatan: { select: { name: true } } } } },
          })
        : Promise.resolve([]),
    ]);
    return NextResponse.json({
      bolehAtur,
      otomatis: [...otomatis.values()].sort((a, b) => a.nama.localeCompare(b.nama, "id")),
      anggota: anggota.map(u => ({ userId: u.id, nama: u.name, email: u.email, ket: u.role === "TAS" ? "Staf" : u.teacher?.subject ?? null })).sort((a, b) => a.nama.localeCompare(b.nama, "id")),
      calon: guru.map(u => ({
        id: u.id, nama: u.name,
        ket: u.role === "TAS" ? `Staf${u.staffJabatan.length ? ` · ${u.staffJabatan.map(j => j.jabatan.name).join(", ")}` : ""}` : u.teacher?.subject ?? null,
      })),
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    if (!(await bolehAturPanitia(session))) return NextResponse.json({ error: "Hanya Admin, Tata Usaha, atau pemegang jabatan panitia yang bisa menambah anggota." }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    const userIds = [...new Set((Array.isArray(b?.userIds) ? b.userIds : [b?.userId]).filter(Boolean).map((x: unknown) => String(x)))].slice(0, 100) as string[];
    const guru = await prisma.user.findMany({ where: { id: { in: userIds }, role: { in: ["TEACHER", "TAS"] } }, select: { id: true, name: true } });
    if (!guru.length) return NextResponse.json({ error: "Pilih akun guru / staf yang akan ditambahkan." }, { status: 400 });
    const ids = await anggotaPanitia();
    await simpan([...new Set([...ids, ...guru.map(g => g.id)])]);
    await logActivity(session, { action: "UPDATE", entity: "PanitiaSpmb", description: `Menambah panitia SPMB: ${guru.map(g => g.name).join(", ")}` }).catch(() => null);
    return NextResponse.json({ ok: true, jumlah: guru.length });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    if (!(await bolehAturPanitia(session))) return NextResponse.json({ error: "Tidak berwenang." }, { status: 403 });
    const userId = req.nextUrl.searchParams.get("userId") ?? "";
    const ids = await anggotaPanitia();
    if (!ids.includes(userId)) return NextResponse.json({ error: "Akun ini bukan anggota tambahan." }, { status: 404 });
    await simpan(ids.filter(x => x !== userId));
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await logActivity(session, { action: "UPDATE", entity: "PanitiaSpmb", description: `Mengeluarkan ${u?.name ?? userId} dari panitia SPMB` }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
