export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { getParentChildrenOrRedirect, resolveSelectedChild } from "@/lib/parent-guard";
import { computeStudentPointsSummary } from "@/lib/student-points";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { ShieldAlert, Award } from "lucide-react";
import StatTile from "@/components/admin/StatTile";

export const metadata = { title: "Poin Kedisiplinan — Portal Orang Tua" };

const LEVEL_COLOR: Record<string, string> = {
  "Aman": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Surat Peringatan 1": "bg-amber-50 text-amber-700 border-amber-200",
  "Surat Peringatan 2": "bg-orange-50 text-orange-700 border-orange-200",
  "Surat Peringatan 3": "bg-red-50 text-red-700 border-red-200",
  "Dikembalikan ke Orang Tua": "bg-red-100 text-red-800 border-red-300",
};

export default async function ParentPoinPage({ searchParams }: { searchParams: Promise<{ studentId?: string }> }) {
  const session = await verifyRole(["PARENT"]);
  const { studentId } = await searchParams;
  const children = await getParentChildrenOrRedirect(session);
  const child = resolveSelectedChild(children, studentId);

  const data = await computeStudentPointsSummary(child.id);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ShieldAlert size={22} />} title="Poin Kedisiplinan" description={`Poin pelanggaran & prestasi — ${child.user.name}`} />

      <p className="text-xs text-gray-400 mb-4">Semester: {data.semester} — akumulasi maksimal poin pelanggaran per tahun ajaran adalah 100.</p>

      <div className={`kisi-kartu mb-6 ${data.totalRemisi > 0 ? "kisi-kartu-4" : "kisi-kartu-3"}`}>
        <StatTile value={data.totalPelanggaran} label="Poin Pelanggaran" ikon="poin-turun" color="red" />
        <StatTile value={data.totalPrestasi} label="Poin Prestasi" ikon="tren" color="emerald" />
        {data.totalRemisi > 0 && <StatTile value={data.totalRemisi} label="Poin Remisi" ikon="prestasi" color="blue" />}
        <StatTile value={<>{data.netPoints} <span className="text-sm font-normal text-gray-400">/ 100</span></>} label="Poin Bersih" ikon="poin-bersih" color="primary" />
      </div>

      <div className={`rounded-2xl border p-5 mb-6 ${LEVEL_COLOR[data.level] ?? "bg-gray-50 text-gray-700 border-gray-200"}`}>
        <p className="font-bold text-sm">{data.level}</p>
        <p className="text-xs mt-1">{data.levelDesc}</p>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50"><h3 className="font-heading font-bold text-primary-900 text-sm">Riwayat</h3></div>
        {data.records.length === 0 ? (
          <EmptyState icon={Award} title="Belum Ada Catatan" description="Belum ada catatan poin semester ini." className="flex flex-col items-center justify-center min-h-36 py-0" />
        ) : (
          <div className="divide-y divide-gray-50">
            {data.records.map(r => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-primary-900">{r.violationType?.name ?? r.achievementType?.name ?? "Remisi Poin"}</p>
                  <p className="text-xs text-gray-400">{new Date(r.date).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}{r.note ? ` — ${r.note}` : ""}</p>
                </div>
                <span className={`font-bold text-sm shrink-0 ml-3 ${r.kind === "PELANGGARAN" ? "text-red-600" : r.kind === "REMISI" ? "text-blue-600" : "text-emerald-600"}`}>
                  {r.kind === "PELANGGARAN" ? "+" : "-"}{r.points}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
