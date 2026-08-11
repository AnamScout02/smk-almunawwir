"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, Loader2, TrendingDown, TrendingUp, Award, BookOpenCheck } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";

interface PointRecord {
  id: string; kind: string; points: number; note: string | null; date: string;
  violationType: { name: string; category: string } | null;
  achievementType: { name: string } | null;
}
interface Summary {
  semester: string; totalPelanggaran: number; totalPrestasi: number; totalRemisi: number; netPoints: number;
  level: string; levelDesc: string; records: PointRecord[];
}

const LEVEL_COLOR: Record<string, string> = {
  "Aman": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Surat Peringatan 1": "bg-amber-50 text-amber-700 border-amber-200",
  "Surat Peringatan 2": "bg-orange-50 text-orange-700 border-orange-200",
  "Surat Peringatan 3": "bg-red-50 text-red-700 border-red-200",
  "Dikembalikan ke Orang Tua": "bg-red-100 text-red-800 border-red-300",
};

export default function PoinSayaPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/points").then(r => r.json())
      .then(d => setData(d.error ? null : d))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ShieldAlert size={22} />} title="Poin Saya" description="Poin pelanggaran & prestasi sesuai Tata Tertib Peserta Didik" />

      <div className="flex justify-end mb-5">
        <Link href="/dashboard/student/tata-tertib" className="flex items-center gap-1.5 text-sm font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 px-4 py-2.5 rounded-xl transition">
          <BookOpenCheck size={15} /> Baca Tata Tertib Lengkap
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
      ) : !data ? (
        <EmptyState icon={ShieldAlert} title="Data Tidak Ditemukan" description="Gagal memuat data poin." />
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-4">Semester: {data.semester} — akumulasi maksimal poin pelanggaran per tahun ajaran adalah 100.</p>

          <div className={`grid grid-cols-2 gap-4 mb-6 ${data.totalRemisi > 0 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 text-red-500 mb-1"><TrendingDown size={16} /><span className="text-xs font-semibold">Poin Pelanggaran</span></div>
              <p className="font-heading font-bold text-2xl text-primary-900">{data.totalPelanggaran}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 text-emerald-500 mb-1"><TrendingUp size={16} /><span className="text-xs font-semibold">Poin Prestasi</span></div>
              <p className="font-heading font-bold text-2xl text-primary-900">{data.totalPrestasi}</p>
            </div>
            {data.totalRemisi > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 text-blue-500 mb-1"><Award size={16} /><span className="text-xs font-semibold">Poin Remisi</span></div>
                <p className="font-heading font-bold text-2xl text-primary-900">{data.totalRemisi}</p>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 text-primary-700 mb-1"><ShieldAlert size={16} /><span className="text-xs font-semibold">Poin Bersih</span></div>
              <p className="font-heading font-bold text-2xl text-primary-900">{data.netPoints} <span className="text-sm font-normal text-gray-400">/ 100</span></p>
            </div>
          </div>

          <div className={`rounded-2xl border p-5 mb-6 ${LEVEL_COLOR[data.level] ?? "bg-gray-50 text-gray-700 border-gray-200"}`}>
            <p className="font-bold text-sm">{data.level}</p>
            <p className="text-xs mt-1">{data.levelDesc}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50"><h3 className="font-heading font-bold text-primary-900 text-sm">Riwayat</h3></div>
            {data.records.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Award size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada catatan poin semester ini.</p>
              </div>
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
        </>
      )}
    </div>
  );
}
