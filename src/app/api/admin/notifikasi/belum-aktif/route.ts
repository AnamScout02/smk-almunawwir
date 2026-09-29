import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { userKesiswaanBk } from "@/lib/peringatan-dini";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

type Orang = { nama: string; keterangan: string };

/** Siapa yang BELUM mengaktifkan notifikasi push di perangkat mana pun — supaya superadmin bisa mengingatkan
 * langsung (mis. salin daftar ke grup WA). Pengingat tetap masuk kotak notifikasi & pita dashboard mereka. */
export async function GET() {
  try {
    await verifyRole(["ADMIN"]);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const aktif = new Set((await prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ["userId"] })).map(x => x.userId));

  const [kelas, roster, bk, guru, siswa, ortu] = await Promise.all([
    prisma.class.findMany({
      orderBy: { name: "asc" },
      select: {
        name: true,
        homeroom: { select: { user: { select: { id: true, name: true } } } },
        ketuaKelas: { select: { user: { select: { id: true, name: true } } } },
        sekretaris: { select: { user: { select: { id: true, name: true } } } },
      },
    }),
    prisma.dutyRoster.findMany({ select: { day: true, weekType: true, user: { select: { id: true, name: true } } } }),
    userKesiswaanBk(),
    prisma.user.findMany({ where: { role: "TEACHER" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.student.findMany({ where: { studentStatus: "AKTIF" }, select: { userId: true } }),
    prisma.parent.findMany({ select: { userId: true } }),
  ]);

  const wali: Orang[] = [], pengurus: Orang[] = [];
  const idWali = new Set<string>(), idPengurus = new Set<string>();
  for (const k of kelas) {
    const w = k.homeroom?.user;
    if (w) { idWali.add(w.id); if (!aktif.has(w.id)) wali.push({ nama: w.name, keterangan: `Wali kelas ${k.name}` }); }
    for (const [p, peran] of [[k.ketuaKelas?.user, "Ketua kelas"], [k.sekretaris?.user, "Sekretaris"]] as const) {
      if (p) { idPengurus.add(p.id); if (!aktif.has(p.id)) pengurus.push({ nama: p.name, keterangan: `${peran} ${k.name}` }); }
    }
  }
  const perPetugas = new Map<string, { nama: string; hari: string[] }>();
  for (const r of roster) {
    const x = perPetugas.get(r.user.id) ?? { nama: r.user.name, hari: [] };
    x.hari.push(r.weekType === "SEMUA" ? r.day : `${r.day} (${r.weekType})`);
    perPetugas.set(r.user.id, x);
  }
  const piket: Orang[] = [...perPetugas].filter(([id]) => !aktif.has(id)).map(([, x]) => ({ nama: x.nama, keterangan: `Piket ${x.hari.join(", ")}` }));
  const namaBk = new Map(guru.map(g => [g.id, g.name]));
  const bkBelum: Orang[] = bk.filter(id => !aktif.has(id)).map(id => ({ nama: namaBk.get(id) ?? "(staf)", keterangan: "Guru BK / Wakasek Kesiswaan" }));
  const guruBelum: Orang[] = guru.filter(g => !aktif.has(g.id)).map(g => ({ nama: g.name, keterangan: idWali.has(g.id) ? "Guru · wali kelas" : "Guru" }));

  const hitung = (ids: string[]) => ({ total: ids.length, belum: ids.filter(id => !aktif.has(id)).length });
  return Response.json({
    kelompok: [
      { kunci: "wali", label: "Wali kelas", ...hitung([...idWali]), daftar: wali },
      { kunci: "pengurus", label: "Ketua & sekretaris kelas", ...hitung([...idPengurus]), daftar: pengurus },
      { kunci: "piket", label: "Petugas piket", ...hitung([...perPetugas.keys()]), daftar: piket },
      { kunci: "bk", label: "Guru BK & Wakasek Kesiswaan", ...hitung(bk), daftar: bkBelum },
      { kunci: "guru", label: "Semua guru", ...hitung(guru.map(g => g.id)), daftar: guruBelum },
    ],
    // Siswa & orang tua terlalu banyak untuk didaftar satu per satu — cukup angkanya.
    jumlah: { siswa: hitung(siswa.map(s => s.userId)), orangTua: hitung(ortu.map(o => o.userId)) },
  });
}
