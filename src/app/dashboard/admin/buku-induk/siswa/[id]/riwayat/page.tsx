export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, User, Printer } from "lucide-react";
import { assertBukuIndukSiswaScope } from "@/lib/buku-induk-access";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import type { Perubahan } from "@/lib/buku-induk-diff";
import TombolKembali from "@/components/shared/TombolKembali";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator", TAS: "Tata Usaha", TEACHER: "Guru", STUDENT: "Siswa",
  PARENT: "Orang Tua", SYSTEM: "Sistem",
};

/** Riwayat perubahan data satu siswa — dibaca dari ActivityLog (action UPDATE_BUKU_INDUK dst),
 * termasuk rincian kolom mana yang berubah beserta nilai sebelum & sesudahnya. */
export default async function RiwayatSiswaPage({ params }: { params: Promise<{ id: string }> }) {
  const scope = await assertBukuIndukSiswaScope();
  const { id } = await params;

  const siswa = await prisma.student.findUnique({
    where: { id },
    select: { id: true, nis: true, classId: true, user: { select: { name: true } }, class: { select: { name: true } } },
  });
  if (!siswa) notFound();
  // Wali kelas hanya boleh melihat riwayat siswa di kelas walinya sendiri.
  if (scope.scope === "CLASS" && !scope.classIds.includes(siswa.classId ?? "")) notFound();

  const logs = await prisma.activityLog.findMany({
    where: { entity: "Student", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<History size={22} />} title="Riwayat Perubahan Data"
        description={`${siswa.user.name} — ${siswa.nis}${siswa.class ? ` · ${siswa.class.name}` : ""}`} />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <TombolKembali href={"/dashboard/admin/buku-induk/siswa"} />
        <div className="flex-1" />
        <Link href={`/dashboard/admin/buku-induk/siswa/${siswa.id}/cetak`}
          className="btn-modal-cancel">
          <Printer size={16} /> Buku Induk Siswa
        </Link>
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={History} title="Belum Ada Riwayat"
          description="Belum ada perubahan data yang tercatat untuk siswa ini. Riwayat mulai terkumpul setiap kali data Buku Induk-nya disimpan." />
      ) : (
        <div className="space-y-3">
          {logs.map(log => {
            const meta = log.metadata as { perubahan?: Perubahan[] } | null;
            const perubahan = Array.isArray(meta?.perubahan) ? meta!.perubahan! : [];
            return (
              <div key={log.id} className="page-card overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100">
                  <span className="w-8 h-8 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
                    <User size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-700">{log.description}</span>
                    <span className="block text-xs text-gray-400">
                      {log.userName} · {ROLE_LABEL[log.userRole] ?? log.userRole} ·{" "}
                      {new Date(log.createdAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
                    </span>
                  </span>
                </div>

                {perubahan.length > 0 && (
                  <div className="overflow-x-auto scrollbar-visible">
                    <table className="data-table">
                      <thead>
                        <tr><th>Kolom</th><th>Sebelum</th><th>Sesudah</th></tr>
                      </thead>
                      <tbody>
                        {perubahan.map((p, i) => (
                          <tr key={`${log.id}-${p.key}-${i}`}>
                            <td className="font-medium whitespace-nowrap">
                              {p.label}
                              <span className="block text-xs font-normal text-gray-400">{p.group}</span>
                            </td>
                            <td className="text-red-600 line-through decoration-red-300">{p.sebelum || <span className="text-gray-300 no-underline">(kosong)</span>}</td>
                            <td className="text-emerald-700 font-medium">{p.sesudah || <span className="text-gray-300 font-normal">(kosong)</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Menampilkan {logs.length} catatan terakhir. Rincian kolom sebelum/sesudah tercatat untuk
        perubahan sejak fitur ini aktif (12 September 2026); catatan yang lebih lama hanya berisi keterangan singkat.
      </p>
    </div>
  );
}
