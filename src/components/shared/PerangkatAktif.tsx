"use client";
import { useCallback, useEffect, useState } from "react";
import { Laptop, Loader2, LogOut, MonitorSmartphone, Smartphone } from "lucide-react";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface Perangkat {
  id: string; label: string; seluler: boolean; ip: string | null;
  masuk: string; aktif: string; ingatSaya: boolean; perangkatIni: boolean;
}

const tanggal = (d: string) => new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
function lalu(d: string) {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 16) return "sedang aktif";
  if (m < 60) return `${m} menit lalu`;
  const j = Math.round(m / 60);
  return j < 24 ? `${j} jam lalu` : `${Math.round(j / 24)} hari lalu`;
}

/** PERANGKAT AKTIF — tempat akun ini sedang masuk, dipasang di halaman Profil semua portal.
 * "Sedang aktif" akurat ±15 menit (aktivitas dicatat tiap token akses diperbarui). */
export default function PerangkatAktif() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [data, setData] = useState<Perangkat[] | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);

  const muat = useCallback(() => {
    fetch("/api/profile/sesi")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setData(d); })
      .catch(() => {});
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function keluarkan(body: { id?: string; semuaLain?: boolean }, tanya: string) {
    if (!(await confirmDialog(tanya))) return;
    setSibuk(body.id ?? "semua");
    try {
      const r = await fetch("/api/profile/sesi", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) toast.error(j.error ?? "Gagal mengeluarkan perangkat.");
      else toast.success(body.semuaLain ? `${j.jumlah} perangkat lain dikeluarkan.` : "Perangkat dikeluarkan.");
      muat();
    } catch { toast.error("Gagal menghubungi server."); }
    finally { setSibuk(null); }
  }

  const lain = (data ?? []).filter(p => !p.perangkatIni).length;

  return (
    <div className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-heading font-semibold text-primary-900 flex items-center gap-2">
            <MonitorSmartphone size={18} className="text-gold-dark" /> Perangkat Aktif
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Tempat akun ini sedang masuk. Keluarkan yang tidak Anda kenali.</p>
        </div>
        {lain > 0 && (
          <button onClick={() => keluarkan({ semuaLain: true }, `Keluarkan akun ini dari ${lain} perangkat lain? Perangkat yang sedang Anda pakai tetap masuk.`)}
            disabled={!!sibuk}
            className="max-w-full inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold transition disabled:opacity-50">
            {sibuk === "semua" ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />} Keluar dari semua perangkat lain
          </button>
        )}
      </div>

      {!data ? (
        <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="divide-y divide-gray-50">
          {data.map(p => {
            const Ikon = p.seluler ? Smartphone : Laptop;
            return (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${p.perangkatIni ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-500"}`}>
                  <Ikon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 flex flex-wrap items-center gap-1.5">
                    {p.label}
                    {p.perangkatIni && <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200">Perangkat ini</span>}
                    {p.ingatSaya && <span className="status-badge bg-blue-50 text-blue-700 border-blue-200">Ingat saya</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.ip ? `IP ${p.ip} · ` : ""}masuk {tanggal(p.masuk)} · {lalu(p.aktif)}
                  </p>
                </div>
                {!p.perangkatIni && (
                  <button onClick={() => keluarkan({ id: p.id }, `Keluarkan akun ini dari ${p.label}?`)} disabled={!!sibuk}
                    title="Keluarkan perangkat ini"
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-40">
                    {sibuk === p.id ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
