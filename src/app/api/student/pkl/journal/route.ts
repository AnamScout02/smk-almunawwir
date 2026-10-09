import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { tandaFotoSah } from "@/lib/pkl-foto";

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({
      where: { user: { email: session.email } },
      select: { id: true, major: { select: { skills: true } }, internship: { select: { id: true } } },
    });
    if (!student?.internship) {
      return Response.json({ error: "Anda belum memiliki data PKL. Hubungi admin/wali kelas." }, { status: 404 });
    }

    const body = await req.json() as {
      date: string; activity: string; photoUrl?: string; lat?: number; lng?: number; akurasi?: number;
      tanda?: string; waktuFoto?: number; kompetensi?: unknown;
    };
    // Lokasi opsional (izin lokasi HP) — hanya disimpan bila koordinatnya sah.
    const lokasiSah = typeof body.lat === "number" && typeof body.lng === "number" && Math.abs(body.lat) <= 90 && Math.abs(body.lng) <= 180;
    if (!body.date || !body.activity?.trim()) {
      return Response.json({ error: "Tanggal dan kegiatan wajib diisi." }, { status: 400 });
    }
    const tanggal = new Date(body.date);
    if (Number.isNaN(+tanggal)) return Response.json({ error: "Tanggal tidak sah." }, { status: 400 });
    if (tanggal.getTime() > Date.now() + 86_400_000) return Response.json({ error: "Tanggal jurnal tidak boleh di masa depan." }, { status: 400 });

    // Foto kamera: tanda dari /api/student/pkl/foto harus sah, belum kedaluwarsa, dan jurnalnya untuk HARI ITU (WIB).
    const wib = (ms: number) => new Date(ms + 7 * 3600_000).toISOString().slice(0, 10);
    const terverifikasi = !!body.photoUrl && typeof body.waktuFoto === "number" && typeof body.tanda === "string"
      && tandaFotoSah(body.photoUrl, body.waktuFoto, student.id, body.tanda) && wib(body.waktuFoto) === String(body.date).slice(0, 10);
    // Kompetensi hanya dari daftar jurusan siswa itu — bukan teks bebas dari browser.
    const boleh = new Set(student.major?.skills ?? []);
    const kompetensi = Array.isArray(body.kompetensi) ? [...new Set(body.kompetensi.filter((x): x is string => typeof x === "string" && boleh.has(x)))].slice(0, 10) : [];

    const entry = await prisma.internshipJournal.create({
      data: {
        internshipId: student.internship.id,
        date: tanggal,
        activity: body.activity.trim().slice(0, 4000),
        photoUrl: body.photoUrl || null,
        lat: lokasiSah ? body.lat : null,
        lng: lokasiSah ? body.lng : null,
        akurasi: lokasiSah && typeof body.akurasi === "number" ? Math.round(body.akurasi) : null,
        fotoTerverifikasi: terverifikasi,
        fotoWaktu: terverifikasi ? new Date(body.waktuFoto as number) : null,
        kompetensi,
      },
    });
    return Response.json(entry, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan jurnal PKL" }, { status: 500 });
  }
}
