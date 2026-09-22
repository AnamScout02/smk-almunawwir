"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Save, Trash2, Archive, Search, ExternalLink, Pencil, Loader2 } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import GroupedSection from "@/components/admin/GroupedSection";
import Modal from "@/components/admin/Modal";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Arsip {
  id: string; judul: string; kategori: string; nomor?: string;
  tanggal: string; keterangan?: string; fileUrl?: string; berlakuSampai?: string | null; createdAt: string;
}

const KATEGORI = ["Administrasi","Kepegawaian","Keuangan","Siswa","Sarana & Prasarana","Surat Menyurat","Lainnya"];
const EMPTY: Omit<Arsip, "id" | "createdAt"> = {
  judul: "", kategori: "", nomor: "", tanggal: "", keterangan: "", fileUrl: "", berlakuSampai: "",
};

function formatTgl(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export default function ArsipPage() {
  const confirmDialog = useConfirm();
  const [data, setData] = useState<Arsip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<Partial<Arsip> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/arsip");
    const d = await res.json();
    setData(Array.isArray(d) ? d : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = search
    ? data.filter(a =>
        a.judul.toLowerCase().includes(search.toLowerCase()) ||
        (a.nomor ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (a.keterangan ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : data;

  const grouped = KATEGORI
    .map(k => ({ kategori: k, items: filtered.filter(a => a.kategori === k) }))
    .filter(g => g.items.length > 0);

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
    if (!await confirmDialog("Hapus arsip ini?")) return;
    await fetch(`/api/admin/arsip/${id}`, { method: "DELETE" });
    fetchData();
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Archive size={22} />}
        title="Pengarsipan"
        description="Manajemen arsip dan dokumen sekolah"
      />

      {/* Baris alat: kotak cari & tombol aksi bersanding (permintaan user 15 Sep 2026); di HP tombol turun ke kanan bawah. */}
      <div className="baris-alat mb-5">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-10"
            placeholder="Cari judul, nomor, atau keterangan..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="alat-aksi">
          <button onClick={openNew} className="btn-modal-save">
            <Plus size={15} /> Tambah Arsip
          </button>
        </div>
      </div>

      {/* Tabel */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><Loader2 size={18} className="animate-spin" /> Memuat...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Archive} description="Belum ada data arsip" />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ kategori, items }) => (
            <GroupedSection key={kategori} title={kategori} count={items.length} icon={Archive}>
              <ArsipTable items={items} onEdit={openEdit} onDelete={handleDelete} />
            </GroupedSection>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal scrollBody
        open={modal !== null}
        onClose={() => setModal(null)}
        title={isNew ? "Tambah Arsip" : "Edit Arsip"}
        footer={
          <>
            <button onClick={() => setModal(null)} className="btn-modal-cancel flex-1">Batal</button>
            <button onClick={handleSave} disabled={saving} className="btn-modal-save flex-1">
              <Save size={15} /> {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {err && <p className="error-msg">{err}</p>}
          <div>
            <label className="label-field">Judul Arsip <span className="text-red-500">*</span></label>
            <input className="input-field" value={modal?.judul ?? ""}
              onChange={e => setModal(p => ({ ...p, judul: e.target.value }))}
              placeholder="Nama/judul dokumen" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Kategori <span className="text-red-500">*</span></label>
              <Select
                value={modal?.kategori ?? ""}
                onChange={v => setModal(p => ({ ...p, kategori: v }))}
                options={KATEGORI.map(k => ({ value: k, label: k }))}
                placeholder="— Pilih —"
              />
            </div>
            <div>
              <label className="label-field">Nomor Dokumen</label>
              <input className="input-field" value={modal?.nomor ?? ""}
                onChange={e => setModal(p => ({ ...p, nomor: e.target.value }))}
                placeholder="Opsional" />
            </div>
            <div>
              <label className="label-field">Tanggal <span className="text-red-500">*</span></label>
              <DatePicker value={modal?.tanggal ?? ""} onChange={v => setModal(p => ({ ...p, tanggal: v }))} />
            </div>
            <div>
              <label className="label-field">Berlaku sampai</label>
              <DatePicker value={modal?.berlakuSampai ?? ""} onChange={v => setModal(p => ({ ...p, berlakuSampai: v }))} placeholder="Tanpa batas" />
            </div>
            <div>
              <label className="label-field">Link File</label>
              <input className="input-field" value={modal?.fileUrl ?? ""}
                onChange={e => setModal(p => ({ ...p, fileUrl: e.target.value }))}
                placeholder="URL dokumen" />
            </div>
          </div>
          <div>
            <label className="label-field">Keterangan</label>
            <textarea className="input-field resize-none" rows={3} value={modal?.keterangan ?? ""}
              onChange={e => setModal(p => ({ ...p, keterangan: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ArsipTable({ items, onEdit, onDelete }: {
  items: Arsip[]; onEdit: (a: Arsip) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Judul</th>
            <th>Nomor</th>
            <th>Tanggal</th>
            <th>Berlaku s/d</th>
            <th>Keterangan</th>
            <th>File</th>
            <th className="text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map(a => (
            <tr key={a.id}>
              <td className="font-semibold text-primary-900 max-w-xs truncate">{a.judul}</td>
              <td className="text-gray-500 font-mono">{a.nomor || "-"}</td>
              <td className="text-gray-500">{formatTgl(a.tanggal)}</td>
              <td className={`text-xs whitespace-nowrap ${a.berlakuSampai && new Date(a.berlakuSampai).getTime() <= Date.now() + 60 * 86400000 ? "font-semibold text-red-600" : "text-gray-500"}`}>{a.berlakuSampai ? formatTgl(a.berlakuSampai) : "-"}</td>
              <td className="text-gray-500 max-w-xs truncate">{a.keterangan || "-"}</td>
              <td>
                {a.fileUrl ? (
                  <a href={a.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary-700 hover:text-primary-900 font-semibold">
                    <ExternalLink size={11} /> Lihat
                  </a>
                ) : (
                  <span className="text-gray-300">-</span>
                )}
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={() => onEdit(a)} className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => onDelete(a.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
