"use client";
import { useEffect, useState, useCallback } from "react";
import { Heart, Loader2, KeyRound, Unlink, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";

interface ParentRow {
  id: string;
  phoneKey: string;
  user: { name: string; email: string };
  children: { id: string; student: { id: string; nis: string; user: { name: string }; class: { name: string } | null } }[];
}

export default function AdminParentsPage() {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/parents").then(r => r.json()).then(setParents).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleReset(parentId: string, name: string) {
    const ok = await confirmDialog(`Password akun Orang Tua "${name}" akan direset ke default. Lanjutkan?`);
    if (!ok) return;
    setBusyId(parentId);
    const res = await fetch(`/api/admin/parents/${parentId}/reset-password`, { method: "POST" }).catch(() => null);
    setBusyId(null);
    if (res?.ok) toast.success("Password direset ke default.");
    else toast.error("Gagal mereset password.");
  }

  async function handleUnlink(linkId: string, parentName: string, studentName: string) {
    const ok = await confirmDialog(`Akun Orang Tua "${parentName}" tidak akan lagi bisa melihat data "${studentName}". Lanjutkan?`);
    if (!ok) return;
    const res = await fetch(`/api/admin/parents/links/${linkId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) { toast.success("Hubungan diputuskan."); load(); }
    else toast.error("Gagal memutuskan hubungan.");
  }

  const filtered = parents.filter(p => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const haystack = [p.user.name, p.user.email, ...p.children.map(c => c.student.user.name), ...p.children.map(c => c.student.nis)].join(" ").toLowerCase();
    return haystack.includes(q);
  });
  const hal = usePaginasi(filtered, 50, search);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Heart size={22} />} title="Akun Orang Tua" description="Akun Portal Orang Tua dibuat otomatis dari No. HP Orang Tua saat data siswa disimpan" />

      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <div className="baris-alat">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama orang tua, email, atau nama/NIS anak..."
            className="input-field pl-10" />
        </div>
      </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Heart} title="Belum Ada Akun Orang Tua" description="Akun akan muncul otomatis begitu No. HP Orang Tua diisi di data siswa (Buku Induk)." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto scrollbar-visible">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Orang Tua</th>
                  <th>Email Login</th>
                  <th>Anak Terhubung</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {hal.potongan.map(p => (
                  <tr key={p.id}>
                    <td className="font-semibold text-gray-900">{p.user.name}</td>
                    <td className="font-mono text-xs">{p.user.email}</td>
                    <td>
                      <div className="flex flex-col gap-1.5">
                        {p.children.map(c => (
                          <div key={c.id} className="flex items-center gap-2">
                            <span className="badge badge-navy">{c.student.user.name} — {c.student.class?.name ?? "—"}</span>
                            <button onClick={() => handleUnlink(c.id, p.user.name, c.student.user.name)} title="Putuskan hubungan dari anak ini"
                              className="p-1 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                              <Unlink size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button onClick={() => handleReset(p.id, p.user.name)} disabled={busyId === p.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition disabled:opacity-50">
                        {busyId === p.id ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                        Reset Password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginasi hal={hal} satuan="akun orang tua" className="border-t border-gray-100" />
          <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">Total {filtered.length} dari {parents.length} akun orang tua</p>
        </div>
      )}
    </div>
  );
}
