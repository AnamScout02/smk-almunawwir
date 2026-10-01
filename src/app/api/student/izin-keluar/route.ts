import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { qrIzinKeluar, statusIzinKeluar, bolehUnggahBukti } from "@/lib/izin-keluar";
import { getSettings } from "@/lib/site-settings";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Surat izin keluar milik siswa sendiri — 14 hari terakhir, terbaru di atas. */
export async function GET() {
  try {
    const session = await verifyRole(["STUDENT"]);
    const siswa = await prisma.student.findFirst({
      where: { user: { email: session.email } },
      select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { name: true } } },
    });
    if (!siswa) return Response.json({ error: "Data siswa tidak ditemukan" }, { status: 404 });

    const baris = await prisma.izinKeluarSiswa.findMany({
      where: { studentId: siswa.id, keluarPada: { gte: new Date(Date.now() - 14 * 86400_000) } },
      orderBy: { keluarPada: "desc" },
      select: {
        id: true, alasan: true, keluarPada: true, kembaliRencana: true, kembaliPada: true,
        dicatatOleh: true, perluFoto: true, buktiFoto: true, buktiPada: true,
      },
    });
    const [qr, setelan] = await Promise.all([
      qrIzinKeluar(baris.map(b => b.id)).catch(() => ({} as Record<string, string>)),
      getSettings(["school.name", "logo.emblem"]),
    ]);

    return Response.json({
      sekolah: setelan["school.name"] || "SMK Al-Munawwir IIBS",
      logo: setelan["logo.emblem"] || "/images/logo-emblem.png",
      siswa: {
        nama: siswa.user.name, nis: siswa.nis,
        kelas: siswa.class?.name ?? "—", jurusan: siswa.major?.name ?? "—",
      },
      izin: baris.map(b => ({
        id: b.id, alasan: b.alasan, keluarPada: b.keluarPada, kembaliRencana: b.kembaliRencana,
        kembaliPada: b.kembaliPada, dicatatOleh: b.dicatatOleh, perluFoto: b.perluFoto,
        adaBukti: !!b.buktiFoto, buktiPada: b.buktiPada,
        status: statusIzinKeluar(b),
        bolehUnggah: bolehUnggahBukti(b),
        qr: qr[b.id] ?? null,
      })),
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat surat izin keluar" }, { status: 500 });
  }
}
