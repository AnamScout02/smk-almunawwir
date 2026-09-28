"use client";
import { useState } from "react";
import { Save, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";

interface AchievementRow {
  event: string;
  scope: string;
  year: string;
}

function parseAchievements(raw: string): AchievementRow[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }
  return [];
}

export default function AchievementsEditor({ initialValue }: { initialValue: string }) {
  const [rows, setRows] = useState<AchievementRow[]>(parseAchievements(initialValue));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function update(i: number, patch: Partial<AchievementRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [{ event: "", scope: "", year: String(new Date().getFullYear()) }, ...prev]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "ekskul.achievements", value: JSON.stringify(rows) }),
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
        Daftar prestasi ekstrakurikuler yang tampil di halaman publik Ekstrakurikuler. Perbarui setiap ada prestasi baru — yang lama boleh dihapus supaya tidak makin basi.
      </p>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="input-field flex-[2] min-w-0"
              placeholder="Nama prestasi (contoh: Juara 1 LKS TKJ)"
              value={row.event}
              onChange={(e) => update(i, { event: e.target.value })}
            />
            <input
              className="input-field flex-[2] min-w-0"
              placeholder="Tingkat (contoh: Tingkat Kabupaten)"
              value={row.scope}
              onChange={(e) => update(i, { scope: e.target.value })}
            />
            <input
              className="input-field w-24 shrink-0"
              placeholder="Tahun"
              value={row.year}
              onChange={(e) => update(i, { year: e.target.value })}
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
        {rows.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">Belum ada prestasi. Tambahkan baris baru di bawah.</p>
        )}
      </div>

      <div className="flex items-center justify-between mt-5 pt-5 border-t border-gray-100">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-900"
        >
          <Plus size={16} /> Tambah Prestasi
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={status === "saving"}
          className={`inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-60 ${
            status === "saved" ? "bg-emerald-600 text-white" : status === "error" ? "bg-red-500 text-white" : "bg-primary-700 hover:bg-primary-900 text-white"
          }`}
        >
          {status === "saving" ? <Loader2 size={14} className="animate-spin" /> : status === "saved" ? <CheckCircle2 size={14} /> : <Save size={14} />}
          {status === "saving" ? "Menyimpan..." : status === "saved" ? "Tersimpan!" : status === "error" ? "Gagal — Coba lagi" : "Simpan Prestasi"}
        </button>
      </div>
    </div>
  );
}
