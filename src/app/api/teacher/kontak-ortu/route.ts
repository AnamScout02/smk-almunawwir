import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import { normalizePhoneKey } from "@/lib/parent-account";

export const dynamic = "force-dynamic";

/** KONTAK ORANG TUA (17 Sep 2026) — wali kelas: kelas walinya; Guru BK & Wakasek Kesiswaan: kelas mana pun (?classId=).
 * Nomor dari data TU (Student.parentPhone + nomor ayah/ibu/wali di Buku Induk). Kirim WA tetap manual lewat wa.me. */
export async function GET(req: Request) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const url = new URL(req.url);
  const [jabatan, teacher] = await Promise.all([
    session.role === "ADMIN" ? Promise.resolve([] as string[]) : getJabatanNames(session.email),
    prisma.teacher.findFirst({ where: { userId: session.userId }, select: { homeroomOf: { select: { id: true, name: true }, orderBy: { name: "asc" } } } }),
  ]);
  const semua = session.role === "ADMIN" || KESISWAAN_BK_JABATAN.some(j => jabatan.includes(j));
  const kelas = semua
    ? await prisma.class.findMany({ select: { id: true, name: true }, orderBy: [{ grade: "asc" }, { name: "asc" }] })
    : teacher?.homeroomOf ?? [];
  if (!kelas.length) return Response.json({ error: "Menu ini untuk wali kelas." }, { status: 403 });
  const diminta = url.searchParams.get("classId");
  const classId = diminta && kelas.some(k => k.id === diminta) ? diminta : (teacher?.homeroomOf[0]?.id ?? kelas[0].id);
  const siswa = await prisma.student.findMany({
    where: { classId, studentStatus: "AKTIF" },
    orderBy: { user: { name: "asc" } },
    select: {
      id: true, nis: true, parentName: true, parentPhone: true, bukuIndukData: true,
      user: { select: { name: true } },
      parentLinks: { select: { parent: { select: { phoneKey: true, user: { select: { name: true, sessions: { select: { id: true }, take: 1 } } } } } } },
    },
  });
  const nomor = (v: unknown) => (typeof v === "string" && v.replace(/\D/g, "").length >= 9 ? v.trim() : "");
  return Response.json({
    kelas, classId, namaSaya: session.name,
    siswa: siswa.map(s => {
      const bi = (s.bukuIndukData ?? {}) as Record<string, unknown>;
      const kontak: { peran: string; nama: string; nomor: string; wa: string }[] = [];
      const tambah = (peran: string, nama: unknown, no: unknown) => {
        const n = nomor(no);
        if (!n) return;
        const wa = normalizePhoneKey(n);
        if (kontak.some(k => k.wa === wa)) return;
        kontak.push({ peran, nama: typeof nama === "string" ? nama : "", nomor: n, wa });
      };
      tambah("Orang tua", s.parentName ?? bi.fatherName ?? bi.motherName, s.parentPhone);
      tambah("Wali", bi.guardianName, bi.guardianPhone);
      const akun = s.parentLinks[0]?.parent;
      return {
        id: s.id, nama: s.user.name, nis: s.nis, kontak,
        akunOrtu: akun ? { nama: akun.user.name, pernahMasuk: akun.user.sessions.length > 0 } : null,
      };
    }),
  });
}
