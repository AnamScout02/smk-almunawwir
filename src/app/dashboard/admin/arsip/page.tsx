"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Plus, X, Save, Trash2, Archive, Search, ExternalLink } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";

interface Arsip {
  id: string; judul: string; kategori: string; nomor?: string;
  tanggal: string; keterangan?: string; fileUrl?: string; createdAt: string;
}

const KATEGORI = ["Administrasi","Kepegawaian","Keuangan","Siswa","Sarana & Prasarana","Surat Menyurat","Lainnya"];
const EMPTY: Omit<Arsip, "id" | "createdAt"> = {
  judul: "", kategori: "", nomor: "", tanggal: "", keterangan: "", fileUrl: "",
};

const KATEGORI_COLOR: Record<string, string> = {
  "Administrasi": "bg-blue-50 text-blue-700 border border-blue-200",
  "Kepegawaian": "bg-purple-50 text-purple-700 border border-purple-200",
  "Keuangan": "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Siswa": "bg-amber-50 text-amber-700 border border-amber-200",
  "Sarana & Prasarana": "bg-teal-50 text-teal-700 border border-teal-200",
  "Surat Menyurat": "bg-pink-50 text-pink-700 border border-pink-200",
  "Lainnya": "bg-gray-50 text-gray-600 border border-gray-200",
};

function formatTgl(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export default function ArsipPage() {
  const [data, setData] = useState<Arsip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [katFilter, setKatFilter] = useState("ALL");
  const [modal, setModal] = useState<Partial<Arsip> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const q = katFilter !== "ALL" ? `?kategori=${encodeURIComponent(katFilter)}` : "";
    const res = await fetch(`/api/admin/arsip${q}`);
    const d = await res.json();
    setData(Array.isArray(d) ? d : []);
    setLoading(false);
  }, [katFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = search
    ? data.filter(a =>
        a.judul.toLowerCase().includes(search.toLowerCase()) ||
        (a.nomor ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (a.keterangan ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : data;

  function openNew() { setIsNew(true); setModal({ ...EMPTY }); setErr(""); }
  function openEdit(a: Arsip) {
    setIsNew(false);
    setModal({ ...a, tanggal: a.tanggal.slice(0, 10) });
    setErr("");
  }

  async function handleSave() {
    if (!modal?.judul || !modal.kategori || !modal.tanggal) {
      setErr("Judul, kategori, dan tanggal wajib diisi"); return;
    }
    setSaving(true);
    const url = isNew ? "/api/admin/arsip" : `/api/admin/arsip/${modal.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(modal),
    });
    setSaving(false);
    if (!res.ok) { setErr("Gagal menyimpan"); return; }
    setModal(null); fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus arsip ini?")) return;
    await fetch(`/api/admin/arsip/${id}`, { method: "DELETE" });
    fetchData();
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Archive size={22} />}
        title="Pengarsipan"
        description="Manajemen arsip dan dokumen sekolah"
        actions={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
              <input className="input-field pl-9 w-56"
                placeholder="Cari judul, nomor..." value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input-field w-auto"
              value={katFilter} onChange={e => setKatFilter(e.target.value)}>
              <option value="ALL">Semua Kategori</option>
              {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <button onClick={openNew}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-900 transition-colors shrink-0">
              <Plus size={15} /> Tambah Arsip
            </button>
          </div>
        }
      />

      {/* Kategori quick-filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {KATEGORI.map(k => {
          const count = data.filter(a => a.kategori === k).length;
          if (count === 0) return null;
          return (
            <button key={k} onClick={() => setKatFilter(katFilter === k ? "ALL" : k)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${katFilter === k ? "bg-primary-600 text-white border-primary-600" : "border-gray-200 text-gray-600 hover:border-primary-400"}`}>
              {k} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Belum ada data arsip</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => (
            <div key={a.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between"
                style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.04) 0%, rgba(27,43,107,0.02) 100%)", borderBottom: "1px solid rgba(15,26,69,0.06)" }}>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${KATEGORI_COLOR[a.kategori] ?? "bg-gray-50 text-gray-600 border border-gray-200"}`}>
                  {a.kategori}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(a)}
                    className="text-xs px-2.5 py-1 font-semibold bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 border border-primary-100 transition-colors">Edit</button>
                  <button onClick={() => handleDelete(a.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-primary-900 text-sm mb-1 line-clamp-2">{a.judul}</h3>
                {a.nomor && <p className="text-xs text-gray-500 font-mono mb-1">{a.nomor}</p>}
                <p className="text-xs text-gray-400 mb-2">{formatTgl(a.tanggal)}</p>
                {a.keterangan && <p className="text-xs text-gray-500 line-clamp-2">{a.keterangan}</p>}
                {a.fileUrl && (
                  <a href={a.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-semibold">
                    <ExternalLink size={11} /> Lihat File
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4"
              style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
              <h2 className="font-heading font-semibold text-white">{isNew ? "Tambah Arsip" : "Edit Arsip"}</h2>
              <button onClick={() => setModal(null)} className="p-2 text-white/60 hover:text-white rounded-lg transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {err && <p className="error-msg">{err}</p>}
              <div>
                <label className="label-field">Judul Arsip <span className="text-red-500">*</span></label>
                <input className="input-field" value={modal.judul ?? ""}
                  onChange={e => setModal(p => ({ ...p, judul: e.target.value }))}
                  placeholder="Nama/judul dokumen" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Kategori <span className="text-red-500">*</span></label>
                  <select className="input-field" value={modal.kategori ?? ""}
                    onChange={e => setModal(p => ({ ...p, kategori: e.target.value }))}>
                    <option value="">— Pilih —</option>
                    {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-field">Nomor Dokumen</label>
                  <input className="input-field" value={modal.nomor ?? ""}
                    onChange={e => setModal(p => ({ ...p, nomor: e.target.value }))}
                    placeholder="Opsional" />
                </div>
                <div>
                  <label className="label-field">Tanggal <span className="text-red-500">*</span></label>
                  <DatePicker value={modal.tanggal ?? ""} onChange={v => setModal(p => ({ ...p, tanggal: v }))} />
                </div>
                <div>
                  <label className="label-field">Link File</label>
                  <input className="input-field" value={modal.fileUrl ?? ""}
                    onChange={e => setModal(p => ({ ...p, fileUrl: e.target.value }))}
                    placeholder="URL dokumen" />
                </div>
              </div>
              <div>
                <label className="label-field">Keterangan</label>
                <textarea className="input-field resize-none" rows={3} value={modal.keterangan ?? ""}
                  onChange={e => setModal(p => ({ ...p, keterangan: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setModal(null)} className="btn-modal-cancel">Batal</button>
              <button onClick={handleSave} disabled={saving} className="btn-modal-save">
                <Save size={15} /> {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
