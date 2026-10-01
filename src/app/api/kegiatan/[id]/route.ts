import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { hakKegiatan, hariKegiatan, isoWib, kegiatanMilik, tengahMalamWib } from "@/lib/kegiatan-qr";
import { rapikanSasaran } from "@/lib/pengumuman";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const JENIS = ["RAPAT", "KEGIATAN", "UPACARA", "PELATIHAN"];

/** Ubah kegiatan yang sudah dibuat (30 September 2026). Aturan yang dijaga:
 *  - Rentang tanggal TIDAK boleh dipersempit melewati hari yang sudah punya catatan kehadiran —
 *    memotongnya akan menyisakan presensi yang tidak bisa dilihat maupun dihapus lewat layar mana pun.
 *  - Sasaran boleh diubah; kehadiran yang sudah tercatat tidak dihapus, tetapi orang yang keluar dari
 *    sasaran akan berhenti muncul di daftar "belum hadir" (itu memang yang diinginkan). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySession();
    const { id } = await params;
    const m = await kegiatanMilik(id, session);
    if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
    const hak = await hakKegiatan(session);

    const b = await req.json().catch(() => ({}));
    const judul = String(b.judul ?? "").trim().slice(0, 200);
    const mulai = new Date(b.mulai), selesai = new Date(b.selesai);
    if (!judul) return Response.json({ error: "Nama kegiatan wajib diisi." }, { status: 400 });
    if (isNaN(mulai.getTime()) || isNaN(selesai.getTime()) || selesai <= mulai) {
      return Response.json({ error: "Waktu mulai/selesai tidak valid." }, { status: 400 });
    }

    const sampaiIso = String(b.sampaiTanggal ?? "").trim();
    let sampaiTanggal: Date | null = null;
    if (sampaiIso) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sampaiIso)) return Response.json({ error: "Tanggal selesai tidak valid." }, { status: 400 });
      const awalIso = isoWib(mulai);
      if (sampaiIso < awalIso) return Response.json({ error: "Tanggal selesai tidak boleh sebelum tanggal mulai." }, { status: 400 });
      if (sampaiIso > awalIso) {
        const hari = Math.round((tengahMalamWib(sampaiIso).getTime() - tengahMalamWib(awalIso).getTime()) / 86_400_000) + 1;
        if (hari > 60) return Response.json({ error: "Kegiatan paling lama 60 hari." }, { status: 400 });
        sampaiTanggal = tengahMalamWib(sampaiIso);
      }
    }

    // Jangan sampai ada presensi yang jatuh di luar rentang baru — baris itu akan jadi yatim.
    const hariBaru = new Set(hariKegiatan({ mulai, selesai, sampaiTanggal }));
    const tercatat = await prisma.presensiKegiatan.findMany({
      where: { kegiatanId: id }, select: { tanggal: true }, distinct: ["tanggal"],
    });
    const diLuar = tercatat.map(x => isoWib(x.tanggal)).filter(t => !hariBaru.has(t)).sort();
    if (diLuar.length) {
      return Response.json({
        error: `Sudah ada kehadiran tercatat pada ${diLuar.join(", ")} — hapus catatan hari itu dulu, atau jangan persempit tanggalnya.`,
      }, { status: 409 });
    }

    const hakSasaran = hak.semua || hak.waliKelas.length ? hak : { ...hak, semua: true };
    const r = rapikanSasaran(hak.semua || hak.waliKelas.length ? b : { ...b, targetRole: "TEACHER" }, hakSasaran);
    if (r.galat !== undefined) return Response.json({ error: r.galat }, { status: 400 });

    // Daftar orang dari browser TIDAK dipercaya — disaring ulang seperti di POST.
    let targetUserIds = r.orang;
    if (targetUserIds.length && !hak.semua) {
      const idKelasWali = hak.waliKelas.map(k => k.id);
      const boleh = await prisma.user.findMany({
        where: {
          id: { in: targetUserIds },
          OR: [
            { role: { in: ["TEACHER", "TAS"] } },
            ...(idKelasWali.length ? [{ student: { classId: { in: idKelasWali }, studentStatus: "AKTIF" } }] : []),
          ],
        },
        select: { id: true },
      });
      targetUserIds = boleh.map(x => x.id);
      if (!targetUserIds.length) return Response.json({ error: "Peserta yang dipilih di luar wewenang Anda." }, { status: 403 });
    }

    await prisma.kegiatan.update({
      where: { id },
      data: {
        judul, jenis: JENIS.includes(b.jenis) ? b.jenis : "KEGIATAN",
        tempat: String(b.tempat ?? "").trim().slice(0, 150) || null,
        mulai, selesai, sampaiTanggal, targetUserIds,
        catatan: String(b.catatan ?? "").trim().slice(0, 1000) || null,
        ...r.sasaran,
      },
    });
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan perubahan." }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;
  const m = await kegiatanMilik(id, session);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  await prisma.kegiatan.delete({ where: { id } });
  return Response.json({ ok: true });
}
