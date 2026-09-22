import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { penerimaPengumuman, rapikanSasaran } from "@/lib/pengumuman";
import { hakSurvei, whereKelola, TIPE_PERTANYAAN } from "@/lib/survei";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { segarkanAntrean } from "@/lib/antrean-kerja";

export const dynamic = "force-dynamic";

async function ambil(id: string, ubah = false) {
  const session = await verifySession();
  const hak = await hakSurvei(session);
  if (!hak.boleh) return null;
  const s = await prisma.survei.findFirst({ where: { id, ...whereKelola(session, hak) }, include: { pertanyaan: { orderBy: { urutan: "asc" } }, _count: { select: { respons: true } } } });
  if (!s) return null;
  // Mengubah hanya pembuat, Admin, atau BK/Kesiswaan.
  if (ubah && !(s.pembuatId === session.userId || session.role === "ADMIN" || hak.bk)) return null;
  return { session, hak, s };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await ambil(id);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const { _count, ...s } = m.s;
  return Response.json({ survei: { ...s, jumlahRespons: _count.respons } });
}

/** Ubah isi (judul, sasaran, pertanyaan). Pertanyaan hanya bisa diubah selama belum ada jawaban. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await ambil(id, true);
  if (!m) return Response.json({ error: "Tidak berhak mengubah survei ini." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const judul = String(b.judul ?? "").trim().slice(0, 200);
  if (!judul) return Response.json({ error: "Judul wajib diisi." }, { status: 400 });
  const khusus = m.s.jenis === "AKPD" || m.s.jenis === "SOSIOMETRI";
  const r = rapikanSasaran({ ...b, targetRole: khusus ? "STUDENT" : b.targetRole }, m.hak);
  if (r.galat !== undefined) return Response.json({ error: r.galat }, { status: 400 });
  const data = {
    judul, deskripsi: String(b.deskripsi ?? "").trim().slice(0, 2000) || null, ...r.sasaran,
    anonim: khusus ? false : !!b.anonim, hasilRahasia: khusus ? true : !!b.hasilRahasia,
    selesai: b.selesai ? new Date(b.selesai) : null,
  };
  if (Array.isArray(b.pertanyaan)) {
    if (m.s._count.respons > 0) return Response.json({ error: "Pertanyaan tidak bisa diubah setelah ada yang mengisi." }, { status: 409 });
    const daftar = (b.pertanyaan as Record<string, unknown>[]).slice(0, 100).map((p, i) => {
      const tipe = (TIPE_PERTANYAAN as readonly string[]).includes(String(p.tipe)) ? String(p.tipe) : "PILIHAN";
      const opsi = Array.isArray(p.opsi) ? [...new Set(p.opsi.map(x => String(x).trim()).filter(Boolean))].slice(0, 20) : [];
      return {
        urutan: i + 1, teks: String(p.teks ?? "").trim().slice(0, 500), tipe,
        opsi: tipe === "TEKS" || tipe === "TEMAN" ? [] : opsi,
        kelompok: typeof p.kelompok === "string" && p.kelompok ? p.kelompok : null,
        wajib: p.wajib !== false, maksPilih: Math.min(Math.max(Number(p.maksPilih) || 3, 1), 10),
      };
    });
    const salah = daftar.find(p => !p.teks || ((p.tipe === "PILIHAN" || p.tipe === "CENTANG") && p.opsi.length < 2));
    if (salah) return Response.json({ error: salah.teks ? `Pertanyaan "${salah.teks.slice(0, 40)}" butuh minimal 2 pilihan.` : "Ada pertanyaan yang teksnya kosong." }, { status: 400 });
    await prisma.$transaction([
      prisma.surveiPertanyaan.deleteMany({ where: { surveiId: id } }),
      prisma.survei.update({ where: { id }, data: { ...data, pertanyaan: { create: daftar } } }),
    ]);
  } else {
    await prisma.survei.update({ where: { id }, data });
  }
  return Response.json({ ok: true });
}

/** status: DIBUKA (kirim notifikasi ke sasaran) | DITUTUP | DRAF. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await ambil(id, true);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const status = ["DRAF", "DIBUKA", "DITUTUP"].includes(b.status) ? b.status : null;
  if (!status) return Response.json({ error: "Status tidak dikenal." }, { status: 400 });
  if (status === "DIBUKA" && m.s.pertanyaan.length === 0) return Response.json({ error: "Tambahkan pertanyaan dulu." }, { status: 400 });
  if (status === "DIBUKA" && m.s.jenis === "SOSIOMETRI" && !m.s.targetKelasIds.length) return Response.json({ error: "Pilih kelas sasaran sosiometri dulu." }, { status: 400 });
  if (status === "DRAF" && m.s._count.respons > 0) return Response.json({ error: "Survei yang sudah diisi tidak bisa dikembalikan ke draf." }, { status: 409 });
  await prisma.survei.update({ where: { id }, data: { status } });
  if (status === "DIBUKA") {
    kirimLatar(async () => {
      const penerima = await penerimaPengumuman(m.s);
      await kirimNotifikasi({
        userIds: penerima.map(p => p.userId), jenis: "PENGUMUMAN", kunci: `survei-buka:${id}`,
        judul: `Mohon isi: ${m.s.judul}`, isi: `${m.s.pertanyaan.length} pertanyaan${m.s.anonim ? " · tanpa nama" : ""}${m.s.selesai ? ` · sampai ${m.s.selesai.toLocaleDateString("id-ID", { day: "numeric", month: "long", timeZone: "Asia/Jakarta" })}` : ""}`,
        url: "/survei", tag: `survei-${id}`,
      });
    });
  }
  segarkanAntrean();
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await ambil(id, true);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  await prisma.survei.delete({ where: { id } });
  segarkanAntrean();
  return Response.json({ ok: true });
}
