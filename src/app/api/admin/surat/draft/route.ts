import { NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

// Dipakai saat admin klik "Tulis Surat Baru" — langsung buat baris Surat Keluar kosong supaya
// halaman edit (dan Editor Word ONLYOFFICE) punya id nyata sejak awal, tanpa perlu isi+simpan
// field dulu. Draft yang ditinggal begitu saja tanpa diisi tetap muncul di daftar Surat Keluar
// (nomor/perihal kosong) — admin bisa hapus manual lewat daftar seperti baris surat lainnya.
export async function POST() {
  try {
    await verifyTasAccess();
    const surat = await prisma.surat.create({
      data: { tipe: "KELUAR", nomor: "", tanggal: new Date(), pihak: "", perihal: "" },
    });
    return NextResponse.json(surat, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    console.error(e);
    return NextResponse.json({ error: "Gagal membuat draft surat" }, { status: 500 });
  }
}
