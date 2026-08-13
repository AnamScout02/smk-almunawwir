"use client";
import { useEffect, useState } from "react";
import { Database, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";

interface ChecklistItem { label: string; count: number; href: string }
interface Summary { totalItems: number; checklist: ChecklistItem[] }

export default function OperatorDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/operator/summary").then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      setData(await r.json());
      setLoading(false);
    }).catch(() => { setError("Gagal memuat data"); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (error || !data) return <div className="p-6 lg:p-8 text-center text-gray-400 py-20">{error || "Data tidak tersedia."}</div>;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<Database size={22} />}
        title="Dashboard Operator Sekolah"
        description="Checklist kelengkapan data & tugas yang perlu diproses"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatTile color="amber" icon={AlertTriangle} label="Total Item Perlu Ditindaklanjuti" value={data.totalItems} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-heading font-semibold text-navy text-sm mb-3">Checklist Tugas Operator</h3>
        {data.checklist.length === 0 ? (
          <p className="text-sm text-emerald-600 font-medium text-center py-8">Semua beres — tidak ada tugas tertunda ✓</p>
        ) : (
          <div className="space-y-1.5">
            {data.checklist.map((c, i) => (
              <Link key={i} href={c.href}
                className="flex items-center gap-2 text-sm group hover:bg-amber-50/60 -mx-1 px-3 py-2.5 rounded-lg transition-colors">
                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                <span className="text-gray-600 flex-1 group-hover:text-navy">{c.label}</span>
                <span className="font-bold text-amber-600">{c.count}</span>
                <ArrowRight size={12} className="text-gray-300 shrink-0 group-hover:text-amber-500" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
