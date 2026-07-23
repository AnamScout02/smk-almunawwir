"use client";
import { useState } from "react";
import { Save, CheckCircle2, Loader2, Plus, Trash2, Star } from "lucide-react";

interface StructureRow {
  role: string;
  name: string;
  highlight?: boolean;
}

function parseStructure(raw: string): StructureRow[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }
  return [];
}

export default function StructureEditor({ initialValue }: { initialValue: string }) {
  const [rows, setRows] = useState<StructureRow[]>(parseStructure(initialValue));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function update(i: number, patch: Partial<StructureRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { role: "", name: "" }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function setHighlight(i: number) {
    setRows((prev) => prev.map((r, idx) => ({ ...r, highlight: idx === i })));
  }

  async function handleSave() {
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "school.structure", value: JSON.stringify(rows) }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <p className="text-gray-400 text-sm mb-6 pb-5 border-b border-gray-100">
        Nama-nama pimpinan yang tampil di halaman Tentang Kami (Struktur Pimpinan). Baris yang ditandai bintang otomatis tampil sebagai <strong>Kepala Sekolah</strong> di tanda tangan cetak Buku Induk Siswa.
      </p>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHighlight(i)}
              title="Jadikan Kepala Sekolah (tampil di tanda tangan cetak)"
              className={`shrink-0 p-2.5 rounded-xl border transition ${
                row.highlight
                  ? "bg-gold/10 border-gold text-gold"
                  : "border-gray-200 text-gray-300 hover:text-gray-400"
              }`}
            >
              <Star size={16} fill={row.highlight ? "currentColor" : "none"} />
            </button>
            <input
              className="input-field flex-1 min-w-0"
              placeholder="Jabatan (contoh: Kepala Sekolah)"
              value={row.role}
              onChange={(e) => update(i, { role: e.target.value })}
            />
            <input
              className="input-field flex-1 min-w-0"
              placeholder="Nama lengkap & gelar"
              value={row.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="shrink-0 p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-5 pt-5 border-t border-gray-100">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800"
        >
          <Plus size={16} /> Tambah Baris
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={status === "saving"}
          className={`inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-60 ${
            status === "saved" ? "bg-emerald-600 text-white" : status === "error" ? "bg-red-500 text-white" : "bg-primary-700 hover:bg-primary-800 text-white"
          }`}
        >
          {status === "saving" ? <Loader2 size={14} className="animate-spin" /> : status === "saved" ? <CheckCircle2 size={14} /> : <Save size={14} />}
          {status === "saving" ? "Menyimpan..." : status === "saved" ? "Tersimpan!" : status === "error" ? "Gagal — Coba lagi" : "Simpan Struktur"}
        </button>
      </div>
    </div>
  );
}
