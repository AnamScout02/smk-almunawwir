import { catatRiwayatSatuKolom } from "@/lib/riwayat-induk";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { BUKU_INDUK_FULL_JABATAN } from "@/lib/buku-induk-access";
import { bolehSpmb } from "@/lib/spmb";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { bakuNamaSekolah, kelompokkanSekolah } from "@/lib/nama-sekolah";

export const dynamic = "force-dynamic";

/** RAPIKAN NAMA SEKOLAH ASAL (6 Okt 2026) — sistem MENYARANKAN kelompok penulisan yang sama/mirip, panitia yang
 *  memutuskan & menggabungkan. Dua sumber: pendaftar SPMB (panitia SPMB) dan Buku Induk siswa (Admin & jabatan
 *  Buku Induk penuh — data resmi sekolah, jadi tidak dibuka untuk seluruh panitia). */
async function hak() {
  const s = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const spmb = await bolehSpmb(s);
  const induk = s.role === "ADMIN" || (await getJabatanNames(s.email).catch(() => [] as string[])).some(j => BUKU_INDUK_FULL_JABATAN.includes(j));
  return { s, spmb, induk };
}

async function daftarNama(sumber: string) {
  const g = sumber === "induk"
    ? await prisma.student.groupBy({ by: ["previousSchool"], where: { previousSchool: { not: null } }, _count: { _all: true } })
    : await prisma.admission.groupBy({ by: ["previousSchool"], where: { previousSchool: { not: null } }, _count: { _all: true } });
  return g.filter(x => x.previousSchool?.trim()).map(x => ({ nama: x.previousSchool!, jumlah: x._count._all }));
}

export async function GET(req: NextRequest) {
  try {
    const { s, spmb, induk } = await hak();
    const sumber = req.nextUrl.searchParams.get("sumber") === "induk" ? "induk" : "spmb";
    if (sumber === "spmb" ? !spmb : !induk) return NextResponse.json({ error: "Tidak berwenang", hak: { spmb, induk } }, { status: 403 });
    // ?nama=<penulisan persis> → SIAPA saja yang sekolah asalnya ditulis begitu (10 Okt 2026, permintaan user: tiap nama sekolah
    // diklik memunculkan anak-anaknya), masing-masing dengan tautan langsung ke isian Asal Sekolah / jendela calon.
    const satu = req.nextUrl.searchParams.get("nama");
    if (satu) {
      if (sumber === "induk") {
        const dasar = s.role === "TEACHER" ? "/dashboard/teacher/buku-induk-siswa" : "/dashboard/admin/buku-induk/siswa";
        const isian = encodeURIComponent("Asal Sekolah|Nama Sekolah|Sekolah Asal");
        const baris = await prisma.student.findMany({ where: { previousSchool: satu }, take: 500, orderBy: { user: { name: "asc" } },
          select: { id: true, nis: true, studentStatus: true, enrollYear: true, user: { select: { name: true } }, class: { select: { name: true } } } });
        return NextResponse.json({ anak: baris.map(x => ({ id: x.id, nama: x.user.name, ket: [x.nis, x.class?.name ?? (x.studentStatus && x.studentStatus !== "AKTIF" ? x.studentStatus.toLowerCase() : "belum ada kelas"), x.enrollYear ? `angkatan ${x.enrollYear}` : ""].filter(Boolean).join(" · "), href: `${dasar}?edit=${x.id}&bagian=d&isian=${isian}` })) });
      }
      const baris = await prisma.admission.findMany({ where: { previousSchool: satu }, take: 500, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, nomor: true, chosenMajor: true } });
      return NextResponse.json({ anak: baris.map(x => ({ id: x.id, nama: x.fullName, ket: [x.nomor, x.chosenMajor].filter(Boolean).join(" · "), href: `/pusat-spmb/tahapan?buka=${x.id}` })) });
    }
    const nama = await daftarNama(sumber);
    return NextResponse.json({ hak: { spmb, induk }, totalNama: nama.length, kelompok: kelompokkanSekolah(nama) });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}

/** Gabungkan: { sumber, target, varian: string[] } → semua baris bernama salah satu `varian` diganti `target`. */
export async function POST(req: NextRequest) {
  try {
    const { s, spmb, induk } = await hak();
    const b = await req.json().catch(() => ({}));
    const sumber = b?.sumber === "induk" ? "induk" : "spmb";
    if (sumber === "spmb" ? !spmb : !induk) return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
    const target = bakuNamaSekolah(String(b?.target ?? "")).slice(0, 150);
    const varian = (Array.isArray(b?.varian) ? b.varian : []).map(String).filter(Boolean).slice(0, 50);
    if (!target) return NextResponse.json({ error: "Tulis nama sekolah yang benar." }, { status: 400 });
    if (!varian.length) return NextResponse.json({ error: "Pilih penulisan yang digabung." }, { status: 400 });
    // Riwayat per siswa (bisa dikembalikan) — diambil SEBELUM diganti; hanya yang penulisannya memang berubah.
    const terkena = sumber === "induk"
      ? await prisma.student.findMany({ where: { previousSchool: { in: varian, not: target } }, select: { id: true, nis: true, previousSchool: true, user: { select: { name: true } } } })
      : [];
    const r = sumber === "induk"
      ? await prisma.student.updateMany({ where: { previousSchool: { in: varian } }, data: { previousSchool: target } })
      : await prisma.admission.updateMany({ where: { previousSchool: { in: varian } }, data: { previousSchool: target } });
    await catatRiwayatSatuKolom(s, terkena.map(x => ({ id: x.id, nama: x.user.name, nomor: x.nis, lama: x.previousSchool })),
      { kunci: "previousSchool", label: "Asal Sekolah (SMP/MTs)", grup: "D. Pendidikan Sebelumnya", baru: target, sumber: "Rapikan Nama Sekolah" }).catch(() => 0);
    await logActivity(s, {
      action: "UPDATE", entity: sumber === "induk" ? "Student" : "Admission",
      description: `Merapikan nama sekolah asal (${sumber === "induk" ? "Buku Induk" : "SPMB"}): ${varian.join(" | ")} → ${target} (${r.count} data)`,
    }).catch(() => null);
    return NextResponse.json({ ok: true, jumlah: r.count });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menggabungkan" }, { status: 500 });
  }
}
