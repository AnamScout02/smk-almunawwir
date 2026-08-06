"use client";
import { useState, useEffect } from "react";
import { GraduationCap, Loader2, Save } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";

export default function AdminCekKelulusanPage() {
  const toast = useToast();
  const [tanggalBuka, setTanggalBuka] = useState("");
  const [tanggalTutup, setTanggalTutup] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/cek-kelulusan-settings").then(r => r.json()).then(d => {
      setTanggalBuka(d.tanggalBuka ?? "");
      setTanggalTutup(d.tanggalTutup ?? "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/admin/cek-kelulusan-settings", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tanggalBuka, tanggalTutup }),
    });
    setSaving(false);
    if (res.ok) toast.success("Jadwal Cek Kelulusan disimpan."); else toast.error("Gagal menyimpan jadwal.");
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<GraduationCap size={22} />}
        title="Cek Kelulusan"
        description="Atur jadwal buka/tutup halaman publik pengumuman kelulusan"
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 max-w-2xl">
          <p className="text-xs text-gray-400 mb-4">
            Kosongkan salah satu/keduanya untuk selalu terbuka. Siswa/orang tua cek status kelulusan lewat halaman publik{" "}
            <code className="font-mono">/cek-kelulusan</code>.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="label-field">Tanggal Buka</label>
              <DatePicker value={tanggalBuka} onChange={setTanggalBuka} />
            </div>
            <div>
              <label className="label-field">Tanggal Tutup</label>
              <DatePicker value={tanggalTutup} onChange={setTanggalTutup} />
            </div>
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center justify-center gap-2 bg-primary-700 hover:bg-primary-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
