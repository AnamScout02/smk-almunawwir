export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, School } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import CetakDataKelasClient from "@/components/admin/CetakDataKelasClient";
import TombolKembali from "@/components/shared/TombolKembali";

/** Cetak data kelas — admin pilih kelas mana saja yang mau dicetak (checklist per tingkat, lihat
 * CetakDataKelasClient.tsx), SATU KELAS SATU HALAMAN (page-break per kelas): info kelas (jurusan,
 * wali kelas, ketua kelas, sekretaris, jumlah siswa) diikuti daftar akun login (Nama/NIS/Username)
 * kelas itu. TIDAK menyertakan password — password di-hash (bcrypt, satu arah), sistem TIDAK BISA
 * membaca ulang nilai aslinya utk siapa pun. Landscape krn kolom tabel akun cukup banyak. */
export default async function CetakDataKelasPage() {
  await verifyTasAccess();

  const [classes, settings] = await Promise.all([
    prisma.class.findMany({
      include: {
        major: { select: { name: true, code: true } },
        homeroom: { select: { user: { select: { name: true } } } },
        ketuaKelas: { select: { user: { select: { name: true } } } },
        sekretaris: { select: { user: { select: { name: true } } } },
        students: {
          where: { studentStatus: "AKTIF" },
          select: { id: true, nis: true, user: { select: { name: true, email: true } } },
          orderBy: { user: { name: "asc" } },
        },
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
    getSettings(["logo.full_white"]),
  ]);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{"@page { size: A4 landscape; margin: 1cm; }"}</style>

      <PageHeader icon={<School size={22} />} title="Cetak Data Kelas" description="Info kelas + daftar akun login siswa, pilih kelas yang mau dicetak" printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <TombolKembali href={"/dashboard/admin/classes"} />
        <PrintButton />
      </div>

      {classes.length === 0 ? (
        <div className="panel p-16 text-center text-gray-400 text-sm print:hidden">Belum ada kelas.</div>
      ) : (
        <CetakDataKelasClient classes={classes} logoUrl={settings["logo.full_white"]} />
      )}
    </div>
  );
}
