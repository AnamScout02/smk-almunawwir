import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { profilBelHariIni } from "@/lib/bel-profil";

/** Bel Sekolah Otomatis — jadwal dikelola staf TU (Tenaga Administrasi Sekolah), sama pola akses
 * dgn modul TU lain (Buku Mutasi, Persuratan, dst). GET dibuka lebih luas (ADMIN/TAS/TEACHER) krn
 * halaman Player perlu dibaca siapa pun yg buka (mis. Guru Piket kalau TU berhalangan) — TAPI
 * create/edit/hapus jadwal TETAP khusus TU lewat verifyTasAccess di POST/PUT/DELETE. */
export async function GET() {
  try {
    const [schedules, hariIni] = await Promise.all([
      prisma.bellSchedule.findMany({ orderBy: [{ time: "asc" }, { order: "asc" }] }),
      profilBelHariIni(),
    ]);
    // `berlaku` = bel ini dipakai hari ini menurut profil (Reguler / Ujian pada tanggal Kegiatan Ujian) — dihitung
    // di SERVER supaya pemutar pusat & papan TV memakai aturan yang sama (src/lib/bel-profil.ts). Respons tetap
    // berupa array seperti dulu; info profil dikirim lewat header supaya pemanggil lama tidak rusak.
    return Response.json(
      schedules.map(s => ({ ...s, berlaku: (s.profil || "REGULER") === hariIni.profil })),
      { headers: { "X-Profil-Bel": hariIni.profil, "X-Kegiatan-Ujian": encodeURIComponent(hariIni.kegiatan ?? "") } },
    );
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat jadwal bel" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await verifyTasAccess();
    const body = await req.json();
    const { label, time, days, audioUrl, profil } = body as { label: string; time: string; days: string[]; audioUrl?: string; profil?: string };
    if (!label?.trim() || !time || !Array.isArray(days) || days.length === 0) {
      return Response.json({ error: "Nama, waktu, dan minimal 1 hari wajib diisi." }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(time)) return Response.json({ error: "Format waktu tidak valid (HH:mm)." }, { status: 400 });

    const created = await prisma.bellSchedule.create({
      data: { label: label.trim(), time, days: days.join(","), audioUrl: audioUrl?.trim() || null, profil: profil === "UJIAN" ? "UJIAN" : "REGULER" },
    });
    return Response.json(created, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus staf Tata Usaha." }, { status: 403 });
    return Response.json({ error: "Gagal menyimpan jadwal bel" }, { status: 500 });
  }
}
