"use client";
import { useEffect, useState } from "react";
import { Sliders, Save, Loader2, ChevronDown } from "lucide-react";
import EmptyState from "@/components/admin/EmptyState";
import PageHeader from "@/components/admin/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";

interface Indicator { id: string; jabatanName: string; name: string; weight: number; source: string; active: boolean; order: number }

const SOURCE_LABEL: Record<string, string> = {
  AUTO_KEHADIRAN: "Otomatis (Kehadiran)",
  AUTO_JURNAL: "Otomatis (Jurnal Mengajar)",
  AUTO_RPP: "Otomatis (Bank RPP)",
  MANUAL: "Manual (perlu verifikasi)",
};

export default function KpiIndikatorPage() {
  const toast = useToast();
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Kartu per jabatan dibuat collapsible (default tertutup) — dulu semua ~23 jabatan tampil
  // penuh sekaligus bikin halaman ini sangat panjang, harus scroll banyak cuma utk lihat satu
  // jabatan. Total bobot tetap terlihat walau tertutup, supaya jabatan yang bermasalah (≠100%)
  // tetap kelihatan tanpa perlu buka semua kartu satu-satu.
  const [openJabatan, setOpenJabatan] = useState<Set<string>>(new Set());

  function load() {
    setLoading(true);
    fetch("/api/admin/kpi/indicators").then(r => r.json()).then(d => setIndicators(Array.isArray(d) ? d : [])).finally(() => setLoading(false)).catch(() => { setLoading(false); });
  }
  useEffect(() => { load(); }, []);

  function setWeight(id: string, weight: number) {
    setIndicators(prev => prev.map(i => i.id === id ? { ...i, weight } : i));
  }

  function toggleJabatan(name: string) {
    setOpenJabatan(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  async function save(ind: Indicator) {
    setSavingId(ind.id);
    const res = await fetch("/api/admin/kpi/indicators", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ind.id, weight: ind.weight, active: ind.active }),
    });
    setSavingId(null);
    if (res.ok) toast.success("Tersimpan"); else toast.error("Gagal menyimpan");
  }

  const grouped = indicators.reduce<Record<string, Indicator[]>>((acc, i) => {
    (acc[i.jabatanName] ??= []).push(i);
    return acc;
  }, {});
  const jabatanNames = Object.keys(grouped);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Sliders size={22} />} title="Pengaturan KPI" description="Atur bobot indikator kinerja per jabatan — total bobot per jabatan idealnya 100%" />

      {jabatanNames.length > 0 && (
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => setOpenJabatan(new Set(jabatanNames))}
            className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-all whitespace-nowrap">
            Buka Semua
          </button>
          <button onClick={() => setOpenJabatan(new Set())}
            className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-all whitespace-nowrap">
            Tutup Semua
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-400" size={28} /></div>
      ) : jabatanNames.length === 0 ? (
        <EmptyState icon={Sliders} title="Belum Ada Indikator KPI" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {jabatanNames.map(jabatanName => {
            const items = grouped[jabatanName];
            const total = items.reduce((a, i) => a + (i.active ? i.weight : 0), 0);
            const isOpen = openJabatan.has(jabatanName);
            return (
              <div key={jabatanName} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => toggleJabatan(jabatanName)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-2 text-left hover:bg-gray-50/50 transition">
                  <h3 className="font-heading font-bold text-primary-900 text-sm truncate">{jabatanName}</h3>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${total === 100 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      {total}%
                    </span>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="divide-y divide-gray-50 border-t border-gray-50">
                    {items.map(ind => (
                      <div key={ind.id} className="px-5 py-3.5 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-primary-900 text-sm">{ind.name}</p>
                          <p className="text-xs text-gray-400">{SOURCE_LABEL[ind.source] ?? ind.source}</p>
                        </div>
                        <input type="number" min={0} max={100} value={ind.weight}
                          onChange={e => setWeight(ind.id, parseInt(e.target.value, 10) || 0)}
                          className="input-field w-16 text-center" />
                        <span className="text-sm text-gray-400">%</span>
                        <button onClick={() => save(ind)} disabled={savingId === ind.id}
                          className="p-2 rounded-lg hover:bg-primary-50 text-primary-600 transition disabled:opacity-40">
                          {savingId === ind.id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
