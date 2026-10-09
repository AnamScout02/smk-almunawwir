import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { penerimaLaporan } from "@/lib/pkl-server";
import { JENIS_LAPORAN } from "@/lib/pkl-label";

export const dynamic = "force-dynamic";

/** Siswa melaporkan masalah di tempat PKL (sakit, kecelakaan kerja, tidak cocok, …) → Humas & guru pembimbing dikabari. */
export async function POST(req: Request) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const siswa = await prisma.student.findFirst({
      where: { user: { email: session.email } },
      select: { internship: { select: { id: true, company: true, teacher: { select: { userId: true } } } } },
    });
    if (!siswa?.internship) return Response.json({ error: "Anda belum terdaftar sebagai peserta PKL." }, { status: 404 });
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const jenis = typeof b.jenis === "string" && JENIS_LAPORAN[b.jenis] ? b.jenis : "";
    const isi = typeof b.isi === "string" ? b.isi.trim().slice(0, 2000) : "";
    if (!jenis || isi.length < 10) return Response.json({ error: "Pilih jenis masalah dan jelaskan minimal 10 huruf." }, { status: 400 });
    // Lima laporan per hari sudah jauh di atas wajar — penjaga dari tombol yang tertekan berulang.
    const hariIni = await prisma.laporanPkl.count({ where: { internshipId: siswa.internship.id, pelapor: "SISWA", createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    if (hariIni >= 5) return Response.json({ error: "Sudah 5 laporan dalam 24 jam terakhir. Hubungi guru pembimbing langsung bila mendesak." }, { status: 429 });
    const foto = typeof b.fotoUrl === "string" && b.fotoUrl.startsWith("/api/uploads/pkl-jurnal/") ? b.fotoUrl : null;
    const l = await prisma.laporanPkl.create({ data: { internshipId: siswa.internship.id, pelapor: "SISWA", pelaporNama: session.name, jenis, isi, fotoUrl: foto } });
    const pkl = siswa.internship;
    kirimLatar(async () => kirimNotifikasi({
      userIds: await penerimaLaporan(pkl.teacher?.userId), jenis: "PKL", kunci: `pkl-laporan:${l.id}`,
      judul: `Laporan PKL: ${JENIS_LAPORAN[jenis]}`, isi: `${session.name} (${pkl.company}) — ${isi.slice(0, 120)}`, url: "/pkl/laporan",
    }));
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal mengirim laporan." }, { status: 500 });
  }
}
