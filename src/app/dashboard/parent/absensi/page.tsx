export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getParentChildrenOrRedirect, resolveSelectedChild } from "@/lib/parent-guard";
import { computeAttendancePct } from "@/lib/attendance-summary";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import { CalendarDays, Inbox } from "lucide-react";
import type { NamaIkon } from "@/components/shared/IkonNama";

export const metadata = { title: "Absensi — Portal Orang Tua" };

const STATUS_COLOR: Record<string, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border-emerald-200",
  IZIN: "bg-blue-50 text-blue-700 border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border-amber-200",
  ALPHA: "bg-red-50 text-red-600 border-red-200",
};

export default async function ParentAbsensiPage({ searchParams }: { searchParams: Promise<{ studentId?: string }> }) {
  const session = await verifyRole(["PARENT"]);
  const { studentId } = await searchParams;
  const children = await getParentChildrenOrRedirect(session);
  const child = resolveSelectedChild(children, studentId);

  const attendance = await prisma.attendance.findMany({ where: { studentId: child.id }, orderBy: { date: "desc" } });
  const pct = computeAttendancePct(attendance);
  const STATUS_COLOR_TILE: Record<string, "emerald" | "blue" | "amber" | "red"> = { HADIR: "emerald", IZIN: "blue", SAKIT: "amber", ALPHA: "red" };
  const summary = ["HADIR", "IZIN", "SAKIT", "ALPHA"].map(s => ({
    status: s,
    count: attendance.filter(a => a.status === s).length,
    color: STATUS_COLOR_TILE[s],
    ikon: (s === "HADIR" ? "hadir" : s === "IZIN" ? "izin" : s === "SAKIT" ? "sakit" : "alpha") as NamaIkon,
  }));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CalendarDays size={22} />} title="Absensi" description={`Rekap kehadiran — ${child.user.name}`} />

      <div className="kisi-kartu kisi-kartu-5 mb-5">
        <StatTile value={`${pct}%`} label="Persentase Hadir" ikon="persen" color="primary" />
        {summary.map(({ status, count, color, ikon }) => (
          <StatTile key={status} value={count} label={status} ikon={ikon} color={color} />
        ))}
      </div>

      {attendance.length === 0 ? (
        <EmptyState icon={Inbox} title="Belum Ada Catatan Absensi" description="Rekap kehadiran akan muncul di sini setelah wali kelas mencatat absensi." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto scrollbar-visible max-h-[65vh]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map(a => (
                  <tr key={a.id}>
                    <td>{new Date(a.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</td>
                    <td>
                      <span className={`status-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLOR[a.status] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
