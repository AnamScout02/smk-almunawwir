"use client";

import React, { useEffect, useState } from "react";
import { Database, Pencil, X, Plus, Save, Loader2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";

interface MasterDataItem {
  id: string;
  category: string;
  label: string;
  items: string[];
  updatedAt: string;
}

export default function MasterDataPage() {
  const [masterData, setMasterData] = useState<MasterDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<MasterDataItem | null>(null);
  const [editItems, setEditItems] = useState<string[]>([]);
  const [editLabel, setEditLabel] = useState("");
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/master-data");
      const data = await res.json();
      if (Array.isArray(data)) setMasterData(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  function openEdit(item: MasterDataItem) {
    setEditTarget(item);
    setEditLabel(item.label);
    setEditItems([...item.items]);
    setNewItem("");
    setSuccessMsg("");
  }

  function closeModal() {
    setEditTarget(null);
    setNewItem("");
    setSuccessMsg("");
  }

  function removeItem(index: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addItem() {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (editItems.includes(trimmed)) return;
    setEditItems((prev) => [...prev, trimmed]);
    setNewItem("");
  }

  function handleNewItemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  }

  async function handleSave() {
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/master-data/${editTarget.category}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: editItems, label: editLabel }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      const updated = await res.json();
      setMasterData((prev) =>
        prev.map((d) => (d.category === updated.category ? updated : d))
      );
      setSuccessMsg("Berhasil disimpan!");
      setTimeout(() => {
        closeModal();
      }, 800);
    } catch {
      alert("Terjadi kesalahan saat menyimpan. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 space-y-6">
      <PageHeader
        icon={<Database size={22} />}
        title="Master Data Dropdown"
        description="Kelola daftar pilihan untuk dropdown pada formulir Buku Induk siswa dan guru."
      />

      {/* Grid kartu */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary-700" size={32} />
          <span className="ml-3 text-gray-500">Memuat data...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {masterData.map((item) => (
            <div
              key={item.category}
              className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4 flex flex-col gap-3"
            >
              {/* Kartu header */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-800 text-sm leading-tight">
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">
                    {item.category}
                  </p>
                </div>
                <button
                  onClick={() => openEdit(item)}
                  className="shrink-0 p-1.5 rounded-lg bg-primary-700/10 text-primary-700 hover:bg-primary-700 hover:text-white transition-colors"
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
              </div>

              {/* Daftar item */}
              <div className="flex flex-wrap gap-1.5">
                {(item.items as string[]).slice(0, 6).map((val, i) => (
                  <span
                    key={i}
                    className="text-xs bg-primary-50 text-primary-600 border border-primary-100 rounded-md px-2 py-0.5"
                  >
                    {val}
                  </span>
                ))}
                {(item.items as string[]).length > 6 && (
                  <span className="text-xs bg-gold/20 text-yellow-700 rounded-md px-2 py-0.5 font-medium">
                    +{(item.items as string[]).length - 6} lainnya
                  </span>
                )}
              </div>

              {/* Footer jumlah */}
              <p className="text-xs text-gray-400 mt-auto">
                {(item.items as string[]).length} pilihan
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Modal Edit */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4"
              style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
              <div>
                <h2 className="font-heading font-bold text-white">
                  Edit: {editLabel}
                </h2>
                <p className="text-xs text-white/40 font-mono mt-0.5">
                  {editTarget.category}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl text-white/60 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Edit label */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Nama Label
                </label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Daftar item yang bisa dihapus */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Daftar Pilihan ({editItems.length})
                </label>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {editItems.map((val, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 group"
                    >
                      <span className="flex-1 text-sm text-gray-700">{val}</span>
                      <button
                        onClick={() => removeItem(i)}
                        className="shrink-0 p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Hapus item ini"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {editItems.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      Belum ada pilihan
                    </p>
                  )}
                </div>
              </div>

              {/* Input tambah item baru */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Tambah Pilihan Baru
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={handleNewItemKeyDown}
                    placeholder="Ketik lalu tekan Enter..."
                    className="input-field flex-1"
                  />
                  <button
                    onClick={addItem}
                    disabled={!newItem.trim()}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus size={15} />
                    Tambah
                  </button>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-50 flex items-center justify-between gap-3">
              {successMsg ? (
                <p className="text-sm text-emerald-600 font-semibold">{successMsg}</p>
              ) : (
                <p className="text-xs text-gray-400">
                  Perubahan akan langsung tersimpan ke database.
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={closeModal} className="btn-modal-cancel">Batal</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-modal-save flex items-center gap-2"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
