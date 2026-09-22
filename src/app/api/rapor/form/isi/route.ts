import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import { pesanNilaiTerkunci, semesterRapor } from "@/lib/rapor-verifikasi";
import { aksesForm, muatForm, rapikanNilaiSiswa } from "@/lib/rapor-form-server";
import { MAKS_LM, MAKS_TP, bedaForm, tambahRiwayat, type EntriRiwayatWali, type PengaturanForm } from "@/lib/rapor-form";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** ISI SATU FORM NILAI RAPOR (kelas × mapel × semester) — src/lib/rapor-form-server.ts.
 *  GET  ?classId&subject&semester → isi form + hak akses
 *  PUT  { classId, subject, semester, pengaturan, nilai } → simpan (guru selama DRAF; Admin/TAS kapan pun)
 *  POST { classId, subject, semester, aksi: kirim | tarik | kembalikan, alasan? } */
function param(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  return { classId: sp.get("classId") ?? "", subject: sp.get("subject") ?? "", semester: sp.get("semester") ?? "" };
}
const semesterSah = (s: string) => semesterRapor().includes(s);

export async function GET(req: NextRequest) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const { classId, subject, semester } = param(req);
  if (!semesterSah(semester)) return Response.json({ error: "Semester tidak dikenal." }, { status: 400 });
  const akses = await aksesForm(session, classId, subject);
  if (!akses) return Response.json({ error: "Anda tidak berhak membuka form ini." }, { status: 403 });
  const data = await muatForm(classId, subject, semester);
  if (!data) return Response.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  const terkunci = await pesanNilaiTerkunci(classId, [semester]);
  return Response.json({ ...data, terkunci, akses: terkunci ? { ...akses, bolehUbah: false, bolehKembalikan: false } : akses });
}

export async function PUT(req: NextRequest) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const b = await req.json().catch(() => ({})) as { classId?: string; subject?: string; semester?: string; pengaturan?: Partial<PengaturanForm>; nilai?: unknown };
  const classId = String(b.classId ?? ""), subject = String(b.subject ?? ""), semester = String(b.semester ?? "");
  if (!semesterSah(semester)) return Response.json({ error: "Semester tidak dikenal." }, { status: 400 });
  const akses = await aksesForm(session, classId, subject);
  if (!akses?.bolehUbah) return Response.json({ error: "Anda tidak berhak mengubah form ini." }, { status: 403 });
  // Selama wali kelas mengunci nilai kelas (tahap verifikasi rapor, CLAUDE.md #43), form ikut terkunci.
  const terkunci = await pesanNilaiTerkunci(classId, [semester]);
  if (terkunci) return Response.json({ error: terkunci }, { status: 409 });
  const ada = await prisma.formNilaiRapor.findUnique({ where: { classId_subject_semester: { classId, subject, semester } }, select: { status: true } });
  if (ada?.status === "DIKIRIM" && akses.peran === "GURU") {
    return Response.json({ error: "Form sudah dikirim ke wali kelas. Tarik kembali dulu untuk mengubah." }, { status: 409 });
  }
  if (akses.peran === "WALI" && ada?.status !== "DIKIRIM") {
    return Response.json({ error: "Wali kelas bisa mengubah form setelah guru mapel mengirimnya." }, { status: 409 });
  }
  const dasar = await muatForm(classId, subject, semester);
  if (!dasar) return Response.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  const p = b.pengaturan ?? {};
  const pengaturan: PengaturanForm = {
    jenis: dasar.pengaturan.jenis,
    kkm: Math.max(0, Math.min(100, Math.round(Number(p.kkm) || dasar.pengaturan.kkm))),
    katrol: !!p.katrol,
    bobot: {
      rph: Math.max(0, Math.min(100, Number(p.bobot?.rph ?? 50) || 0)), sts: Math.max(0, Math.min(100, Number(p.bobot?.sts ?? 20) || 0)),
      sasTes: Math.max(0, Math.min(100, Number(p.bobot?.sasTes ?? 30) || 0)), sasNonTes: Math.max(0, Math.min(100, Number(p.bobot?.sasNonTes ?? 0) || 0)),
    },
    tp: Array.from({ length: MAKS_TP }, (_, i) => ({ kode: `TP-${i + 1}`, teks: String(p.tp?.[i]?.teks ?? "").trim().slice(0, 300) })),
    lm: Array.from({ length: MAKS_LM }, (_, i) => ({ kode: `LM-${i + 1}`, teks: String(p.lm?.[i]?.teks ?? "").trim().slice(0, 300) })),
  };
  const nilai = rapikanNilaiSiswa(b.nilai, new Set(dasar.siswa.map(s => s.id)), pengaturan);
  // Perubahan pada form yang SUDAH DIKIRIM oleh selain guru pengampu (wali kelas/Admin) dicatat per sel — terlihat oleh guru.
  let riwayatWali: EntriRiwayatWali[] | undefined;
  if (ada?.status === "DIKIRIM" && akses.peran !== "GURU") {
    const ubah = bedaForm({ pengaturan: dasar.pengaturan, nilai: dasar.nilai }, { pengaturan, nilai }, new Map(dasar.siswa.map(s => [s.id, s.nama])));
    if (Object.keys(ubah).length) {
      const oleh = `${session.name} (${akses.peran === "WALI" ? "wali kelas" : "admin"})`;
      riwayatWali = tambahRiwayat(dasar.riwayatWali, oleh, ubah);
    }
  }
  const data = {
    jenis: pengaturan.jenis, tp: pengaturan.tp as object, lm: pengaturan.lm as object, bobot: pengaturan.bobot as object,
    kkm: pengaturan.kkm, katrol: pengaturan.katrol, nilai: nilai as object, diubahOleh: session.name,
    ...(akses.teacherId && akses.peran === "GURU" ? { teacherId: akses.teacherId } : {}),
    ...(riwayatWali ? { riwayatWali: riwayatWali as unknown as object } : {}),
  };
  await prisma.formNilaiRapor.upsert({
    where: { classId_subject_semester: { classId, subject, semester } },
    create: { classId, subject, semester, ...data },
    update: data,
  });
  if (riwayatWali) {
    await logActivity(session, { action: "UBAH_FORM_NILAI_RAPOR", entity: "FormNilaiRapor", entityId: `${classId}|${subject}|${semester}`, description: `Mengubah nilai rapor ${subject} ${dasar.kelas.nama} (${semester}) yang sudah dikirim guru mapel` }).catch(() => {});
  }
  return Response.json({ ok: true, disimpan: new Date().toISOString(), ...(riwayatWali ? { riwayatWali } : {}) });
}

export async function POST(req: NextRequest) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const b = await req.json().catch(() => ({})) as { classId?: string; subject?: string; semester?: string; aksi?: string; alasan?: string };
  const classId = String(b.classId ?? ""), subject = String(b.subject ?? ""), semester = String(b.semester ?? "");
  const akses = await aksesForm(session, classId, subject);
  if (!akses) return Response.json({ error: "Anda tidak berhak." }, { status: 403 });
  const form = await prisma.formNilaiRapor.findUnique({ where: { classId_subject_semester: { classId, subject, semester } }, select: { id: true, status: true } });
  if (!form) return Response.json({ error: "Form belum pernah disimpan." }, { status: 404 });
  const terkunci = await pesanNilaiTerkunci(classId, [semester]);
  if (terkunci) return Response.json({ error: terkunci }, { status: 409 });
  const kelas = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });

  if (b.aksi === "kirim") {
    if (!akses.bolehUbah) return Response.json({ error: "Anda tidak berhak mengirim form ini." }, { status: 403 });
    await prisma.formNilaiRapor.update({ where: { id: form.id }, data: { status: "DIKIRIM", dikirimAt: new Date(), dikirimOleh: session.name, catatanWali: null } });
    await logActivity(session, { action: "KIRIM_FORM_NILAI_RAPOR", entity: "FormNilaiRapor", entityId: form.id, description: `Mengirim nilai rapor ${subject} ${kelas?.name ?? ""} (${semester}) ke wali kelas` }).catch(() => {});
    return Response.json({ ok: true, pesan: "Form terkirim ke wali kelas." });
  }
  if (b.aksi === "tarik") {
    if (!akses.bolehUbah) return Response.json({ error: "Anda tidak berhak." }, { status: 403 });
    await prisma.formNilaiRapor.update({ where: { id: form.id }, data: { status: "DRAF" } });
    return Response.json({ ok: true, pesan: "Form ditarik — bisa diubah lagi. Jangan lupa kirim ulang." });
  }
  if (b.aksi === "kembalikan") {
    if (!akses.bolehKembalikan) return Response.json({ error: "Hanya wali kelas yang bisa mengembalikan form." }, { status: 403 });
    const alasan = String(b.alasan ?? "").trim().slice(0, 500) || "Mohon diperiksa kembali.";
    await prisma.formNilaiRapor.update({ where: { id: form.id }, data: { status: "DRAF", catatanWali: alasan } });
    await logActivity(session, { action: "KEMBALIKAN_FORM_NILAI_RAPOR", entity: "FormNilaiRapor", entityId: form.id, description: `Mengembalikan nilai rapor ${subject} ${kelas?.name ?? ""}: ${alasan}` }).catch(() => {});
    return Response.json({ ok: true, pesan: "Form dikembalikan ke guru mapel." });
  }
  return Response.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
