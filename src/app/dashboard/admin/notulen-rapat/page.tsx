"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NotebookPen, Loader2, Plus, Trash2, Printer, Edit2, Users, MapPin, Calendar, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface MeetingItem {
  id: string; date: string; time: string | null; place: string | null; leader: string | null; topic: string | null;
  attendees: { id: string }[];
}

export default function NotulenRapatPage() {
  const confirmDialog = useConfirm();
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true);
    fetch("/api/admin/notulen-rapat").then(r => r.json()).then(d => { setMeetings(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => { setLoading(false); });
  }
  useEffect(() => { load(); }, []);

  async function handleDelete(id: string, topic: string | null) {
    if (!(await confirmDialog(`Hapus notulen rapat "${topic || "rapat ini"}"?`))) return;
    await fetch(`/api/admin/notulen-rapat/${id}`, { method: "DELETE" });
    load();
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<NotebookPen size={22} />}
        title="Notulen Rapat"
        description="Catatan hasil rapat — bisa dicetak lengkap dengan daftar hadir & dokumentasi"
      />

      <div className="flex justify-end mb-5">
        <Link href="/dashboard/admin/notulen-rapat/new" className="btn-gold flex items-center gap-2 text-sm">
          <Plus size={16} /> Tambah Notulen
        </Link>
      </div>

      {meetings.length > 0 && (
        <div className="relative max-w-sm mb-5">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari topik, pemimpin rapat, atau tempat..." className="input-field pl-9 text-sm" />
        </div>
      )}

      {(() => {
        const q = search.toLowerCase();
        const filtered = meetings.filter(m =>
          !q ||
          (m.topic || "").toLowerCase().includes(q) ||
          (m.leader || "").toLowerCase().includes(q) ||
          (m.place || "").toLowerCase().includes(q)
        );
        return loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : meetings.length === 0 ? (
        <EmptyState icon={NotebookPen} title="Belum Ada Notulen Rapat" description="Tambahkan catatan rapat pertama." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada notulen yang cocok dengan pencarian." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map(m => (
            <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="font-heading font-bold text-primary-900">{m.topic || "Rapat"}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <Link href={`/dashboard/admin/notulen-rapat/${m.id}/cetak`} target="_blank"
                    className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Cetak">
                    <Printer size={14} />
                  </Link>
                  <Link href={`/dashboard/admin/notulen-rapat/${m.id}`}
                    className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
                    <Edit2 size={14} />
                  </Link>
                  <button onClick={() => handleDelete(m.id, m.topic)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Calendar size={12} /> {fmt(m.date)}{m.time ? ` · ${m.time}` : ""}</span>
                {m.place && <span className="flex items-center gap-1"><MapPin size={12} /> {m.place}</span>}
                <span className="flex items-center gap-1 ml-auto text-primary-600 font-semibold"><Users size={12} /> {m.attendees.length} hadir</span>
              </div>
              {m.leader && <p className="text-xs text-gray-400 mt-1">Pemimpin Rapat: {m.leader}</p>}
            </div>
          ))}
        </div>
      );
      })()}
    </div>
  );
}
