import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { siswaDariSesi } from "@/lib/ujian-server";
import { PENANDA_WINDOWS } from "@/lib/aplikasi-ujian";
import { simpanCuplikan, cuplikanUjian, JEDA_MIN_MS, UKURAN_MAKS } from "@/lib/proktor-layar";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Potret jendela ujian dari MyAlwis Ujian Windows (src/lib/proktor-layar.ts). Diterima hanya dari aplikasi itu,
 *  hanya untuk pengerjaan milik siswa yang sedang masuk dan belum dikumpulkan. Badan = JPEG mentah. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    if (!(req.headers.get("user-agent") ?? "").includes(PENANDA_WINDOWS)) return Response.json({ error: "Khusus aplikasi ujian." }, { status: 403 });
    const student = await siswaDariSesi(session);
    if (!student) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const lalu = cuplikanUjian(id).get(student.id);
    if (lalu && Date.now() - lalu.waktu < JEDA_MIN_MS) return Response.json({ ok: true, dilewati: true });
    const attempt = await prisma.examAttempt.findUnique({
      where: { examId_studentId: { examId: id, studentId: student.id } }, select: { submittedAt: true },
    });
    if (!attempt || attempt.submittedAt) return Response.json({ error: "Tidak sedang mengerjakan." }, { status: 409 });
    const isi = Buffer.from(await req.arrayBuffer());
    if (!isi.length || isi.length > UKURAN_MAKS || isi[0] !== 0xff || isi[1] !== 0xd8) return Response.json({ error: "Gambar tidak sah." }, { status: 400 });
    simpanCuplikan(id, student.id, { jpeg: isi, waktu: Date.now(), fokus: req.headers.get("x-fokus") !== "0" });
    return Response.json({ ok: true });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal." }, { status: 500 });
  }
}
