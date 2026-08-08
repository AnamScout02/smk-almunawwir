"use client";
import { useEffect, useState } from "react";
import { Activity, Cpu, HardDrive, MemoryStick, Clock, Loader2, RefreshCw } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";

interface Stats {
  memory: { totalGb: number; usedGb: number; freeGb: number; pct: number };
  cpu: { cores: number; model: string; loadAvg: number[]; loadPct1: number };
  disk: { sizeGb: number; usedGb: number; availGb: number; pct: number } | null;
  uptimeHours: number;
  timestamp: string;
}

function barColor(pct: number) {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

function Gauge({ icon: Icon, label, pct, sub, accent }: {
  icon: React.ElementType; label: string; pct: number; sub: string; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={17} className="text-white" />
        </div>
        <div>
          <p className="font-heading font-bold text-navy text-sm">{label}</p>
          <p className="text-gray-400 text-xs">{sub}</p>
        </div>
        <span className="ml-auto font-heading font-bold text-2xl text-navy">{pct}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export default function PerformaServerPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    fetch("/api/admin/system/stats")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else { setStats(d); setError(""); } })
      .catch(() => setError("Gagal memuat data server"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<Activity size={22} />}
        title="Performa Server"
        description="Pemantauan RAM, CPU, dan disk server secara real-time"
      />

      <div className="flex justify-end mb-5">
        <button onClick={() => { setLoading(true); load(); }}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition">
          <RefreshCw size={15} /> Segarkan
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400"><Loader2 size={28} className="animate-spin" /></div>
      ) : error || !stats ? (
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 text-sm">{error || "Data tidak tersedia"}</div>
      ) : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Gauge icon={MemoryStick} label="RAM" pct={stats.memory.pct}
              sub={`${stats.memory.usedGb} / ${stats.memory.totalGb} GB terpakai`} accent="bg-gradient-to-br from-blue-500 to-blue-700" />
            <Gauge icon={Cpu} label="CPU" pct={Math.min(stats.cpu.loadPct1, 999)}
              sub={`${stats.cpu.cores} core — load ${stats.cpu.loadAvg[0]}`} accent="bg-gradient-to-br from-purple-500 to-purple-700" />
            {stats.disk && (
              <Gauge icon={HardDrive} label="Disk" pct={stats.disk.pct}
                sub={`${stats.disk.usedGb} / ${stats.disk.sizeGb} GB terpakai`} accent="bg-gradient-to-br from-amber-500 to-amber-700" />
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-heading font-semibold text-navy text-sm mb-3 flex items-center gap-2"><Cpu size={15} className="text-primary-500" /> Detail CPU</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Model</dt><dd className="text-navy font-medium text-right">{stats.cpu.model}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Jumlah Core</dt><dd className="text-navy font-medium">{stats.cpu.cores}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Load Average (1/5/15 menit)</dt><dd className="text-navy font-medium">{stats.cpu.loadAvg.join(" / ")}</dd></div>
              </dl>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-heading font-semibold text-navy text-sm mb-3 flex items-center gap-2"><Clock size={15} className="text-primary-500" /> Status</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Uptime Server</dt><dd className="text-navy font-medium">{stats.uptimeHours} jam</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">RAM Bebas</dt><dd className="text-navy font-medium">{stats.memory.freeGb} GB</dd></div>
                {stats.disk && <div className="flex justify-between"><dt className="text-gray-500">Disk Bebas</dt><dd className="text-navy font-medium">{stats.disk.availGb} GB</dd></div>}
                <div className="flex justify-between"><dt className="text-gray-500">Diperbarui</dt><dd className="text-navy font-medium">{new Date(stats.timestamp).toLocaleTimeString("id-ID")}</dd></div>
              </dl>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">Data diperbarui otomatis tiap 15 detik.</p>
        </div>
      )}
    </div>
  );
}
