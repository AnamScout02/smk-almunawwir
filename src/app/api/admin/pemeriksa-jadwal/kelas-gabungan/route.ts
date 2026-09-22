import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Tandai satu MATA PELAJARAN boleh diajarkan ke beberapa rombel sekaligus (kelas gabungan).
 *
 * Menulis ke `Subject.maxSharedTeacher` — kolom yang SUDAH dipakai penyusun jadwal otomatis, jadi
 * penandaan di sini sekaligus membuat hasil Generate berikutnya tidak lagi menghindari penggabungan
 * itu. Diterapkan ke SEMUA baris Subject bernama sama (satu nama mapel punya baris terpisah per
 * tingkat & jurusan), karena jadwal menyimpan mapel sebagai nama, bukan id.
 */
export async function PATCH(req: Request) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { subject, maksimal } = await req.json();
    const nama = String(subject ?? "").trim();
    if (!nama) return NextResponse.json({ error: "Nama mata pelajaran wajib diisi." }, { status: 400 });

    // 1 = kembali ke "tidak boleh digabung"; selebihnya dibatasi 2-6 rombel agar tidak salah ketik.
    const batas = Math.min(6, Math.max(1, Number(maksimal) || 2));
    const hasil = await prisma.subject.updateMany({ where: { name: nama }, data: { maxSharedTeacher: batas } });
    if (hasil.count === 0) {
      return NextResponse.json({ error: `Mata pelajaran "${nama}" tidak ditemukan.` }, { status: 404 });
    }
    return NextResponse.json({ subject: nama, maksimal: batas, barisDiperbarui: hasil.count });
  } catch {
    return NextResponse.json({ error: "Gagal menandai mata pelajaran." }, { status: 500 });
  }
}
