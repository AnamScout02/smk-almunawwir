import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { nomorSuratBerikutnya } from "@/lib/nomor-surat-berikutnya";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET(req: NextRequest) {
  try {
    await verifyTasAccess();
    const { searchParams } = new URL(req.url);
    const klasifikasi = (searchParams.get("klasifikasi") || "").trim();
    if (!klasifikasi) return NextResponse.json({ error: "Klasifikasi wajib diisi untuk membuat nomor otomatis." }, { status: 400 });

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!activeYear) return NextResponse.json({ error: "Tahun ajaran aktif belum diatur." }, { status: 400 });

    // Urutannya dipakai bersama Surat Keterangan & Surat Tugas — kalau di sini hanya menghitung
    // tabel Surat sendiri, nomor yang sudah terpakai oleh dua modul itu bisa terbit dua kali.
    const nomor = await nomorSuratBerikutnya(klasifikasi);
    return NextResponse.json({ nomor });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal membuat nomor otomatis." }, { status: 500 });
  }
}
