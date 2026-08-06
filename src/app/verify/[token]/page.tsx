export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { getSession } from "@/lib/session";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, XCircle, GraduationCap, FileText, LogIn } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  AKTIF: "Aktif", LULUS: "Lulus", KELUAR: "Keluar", PINDAH: "Pindah",
};

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [student, settings, session] = await Promise.all([
    prisma.student.findUnique({
      where: { verificationToken: token },
      select: {
        id: true, userId: true, nis: true, nisn: true, enrollYear: true, studentStatus: true,
        user: { select: { name: true } },
        class: { select: { name: true } },
        major: { select: { name: true } },
      },
    }),
    getSettings(["school.name", "logo.full_white"]),
    getSession(),
  ]);

  const isAdmin = session?.role === "ADMIN" || session?.role === "TAS";
  const isOwnStudent = session?.role === "STUDENT" && session.userId === student?.userId;

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "140px 140px", backgroundRepeat: "repeat", filter: "invert(1)" }} />

      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-6">
          {settings["logo.full_white"] && (
            <Image src={settings["logo.full_white"]} alt={settings["school.name"] || "SMK Al Munawwir IIBS"} width={200} height={48} className="h-10 w-auto object-contain" unoptimized />
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {student ? (
            <>
              <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4 flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="font-heading font-bold text-emerald-700">Dokumen Terverifikasi</p>
                  <p className="text-emerald-600 text-xs">Data ini sesuai basis data resmi {settings["school.name"] || "SMK Al Munawwir IIBS"}</p>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                    <GraduationCap size={22} className="text-primary-700" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="font-heading text-lg font-bold text-primary-900 truncate">{student.user.name}</h1>
                    <p className="text-gray-400 text-sm">Peserta Didik</p>
                  </div>
                </div>
                <div className="space-y-2.5 text-sm">
                  <Row label="NIS" value={student.nis} mono />
                  {student.nisn && <Row label="NISN" value={student.nisn} mono />}
                  <Row label="Kelas" value={student.class?.name ?? "—"} />
                  <Row label="Jurusan" value={student.major.name} />
                  {student.enrollYear && <Row label="Tahun Masuk" value={String(student.enrollYear)} />}
                  <Row label="Status" value={STATUS_LABEL[student.studentStatus ?? "AKTIF"] ?? student.studentStatus ?? "—"} />
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100">
                  {isAdmin ? (
                    <Link href={`/dashboard/admin/buku-induk/siswa/${student.id}/cetak`}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold transition">
                      <FileText size={16} /> Lihat Buku Induk Lengkap
                    </Link>
                  ) : isOwnStudent ? (
                    <Link href="/dashboard/student/rapor"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold transition">
                      <FileText size={16} /> Lihat Rapor Lengkap
                    </Link>
                  ) : (
                    <Link href="/login"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 text-sm font-medium transition">
                      <LogIn size={15} /> Login untuk melihat dokumen lengkap
                    </Link>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <XCircle size={24} className="text-red-500 shrink-0" />
                <div>
                  <p className="font-heading font-bold text-red-600">Kode Tidak Ditemukan</p>
                  <p className="text-gray-400 text-xs">Kode verifikasi ini tidak cocok dengan data manapun di sistem kami.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-5">
          <Link href="/" className="text-white/50 text-xs hover:text-white/80 transition-colors">
            {settings["school.name"] || "SMK Al Munawwir IIBS"} — kembali ke beranda
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-400">{label}</span>
      <span className={`font-semibold text-primary-900 text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
