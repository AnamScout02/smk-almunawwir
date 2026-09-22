"use client";
import { useState } from "react";
import { Loader2, CheckCircle2, Building2, Users, Truck, UserRound, Shapes } from "lucide-react";

/** Formulir Buku Tamu yang diisi TAMU SENDIRI setelah memindai QR di meja depan.
 *
 * Dirancang untuk layar ponsel dan orang yang baru pertama membukanya: kategori berupa kartu besar
 * yang ditekan (bukan dropdown), isian wajib cuma dua (nama & keperluan), dan tidak ada satu pun
 * hal yang menuntut akun. Jam datang TIDAK diisi di sini — diambil dari waktu server. */

const KATEGORI = [
  { value: "DINAS", label: "Tamu Dinas", ket: "Dinas Pendidikan, pengawas, instansi pemerintah", icon: Building2 },
  { value: "WALI_MURID", label: "Wali Murid", ket: "Orang tua / wali peserta didik", icon: Users },
  { value: "VENDOR", label: "Vendor / Rekanan", ket: "Penyedia barang & jasa, mitra kerja sama", icon: Truck },
  { value: "UMUM", label: "Tamu Umum", ket: "Kunjungan pribadi atau keperluan lain", icon: UserRound },
  { value: "LAINNYA", label: "Lainnya", ket: "Tidak termasuk kategori di atas", icon: Shapes },
];

export default function FormTamuPublik() {
  const [kategori, setKategori] = useState("");
  const [form, setForm] = useState({ guestName: "", institution: "", purpose: "", metWith: "", phone: "" });
  const [kirim, setKirim] = useState(false);
  const [selesai, setSelesai] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const ubah = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!kategori) return setErr("Pilih dulu jenis tamu di atas.");
    if (!form.guestName.trim()) return setErr("Nama wajib diisi.");
    if (!form.purpose.trim()) return setErr("Keperluan wajib diisi.");
    setKirim(true);
    const res = await fetch("/api/public/buku-tamu", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, category: kategori }),
    }).catch(() => null);
    setKirim(false);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) return setErr(data?.error ?? "Gagal menyimpan. Silakan hubungi petugas.");
    setSelesai(data?.jam ?? "");
  }

  if (selesai !== null) {
    return (
      <div className="text-center py-10">
        <CheckCircle2 size={56} className="mx-auto text-emerald-500 mb-4" />
        <h2 className="font-heading font-bold text-xl text-primary-900 mb-1">Terima kasih, kehadiran Anda tercatat</h2>
        <p className="text-sm text-gray-500">
          {form.guestName.trim()}{selesai ? ` — tercatat pukul ${selesai} WIB` : ""}.
        </p>
        <p className="text-sm text-gray-500 mt-1">Silakan menuju petugas di meja depan.</p>
        <button
          onClick={() => { setSelesai(null); setKategori(""); setForm({ guestName: "", institution: "", purpose: "", metWith: "", phone: "" }); }}
          className="btn-modal-cancel mt-6">
          Isi untuk tamu berikutnya
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={simpan} className="space-y-5">
      <div>
        <label className="label-field">Jenis Tamu <span className="text-red-500">*</span></label>
        <div className="grid gap-2 sm:grid-cols-2">
          {KATEGORI.map(k => {
            const Icon = k.icon;
            const pilih = kategori === k.value;
            return (
              <button key={k.value} type="button" onClick={() => setKategori(k.value)}
                className={`flex items-start gap-3 text-left p-3 rounded-xl border transition ${
                  pilih ? "border-primary-700 bg-primary-50 ring-2 ring-primary-500/20" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                <Icon size={20} className={pilih ? "text-primary-700 shrink-0 mt-0.5" : "text-gray-400 shrink-0 mt-0.5"} />
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${pilih ? "text-primary-900" : "text-gray-700"}`}>{k.label}</span>
                  <span className="block text-xs text-gray-400 leading-snug">{k.ket}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label-field">Nama Lengkap <span className="text-red-500">*</span></label>
        <input value={form.guestName} onChange={ubah("guestName")} className="input-field w-full" placeholder="Nama Anda" autoComplete="name" />
      </div>

      <div>
        <label className="label-field">Asal Instansi / Lembaga</label>
        <input value={form.institution} onChange={ubah("institution")} className="input-field w-full"
          placeholder={kategori === "WALI_MURID" ? "Boleh dikosongkan" : "Contoh: Dinas Pendidikan Prov. Jawa Timur"} />
      </div>

      <div>
        <label className="label-field">Keperluan <span className="text-red-500">*</span></label>
        <textarea value={form.purpose} onChange={ubah("purpose")} rows={3} className="input-field w-full"
          placeholder="Contoh: Monitoring pelaksanaan PKL" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label-field">Ingin Bertemu</label>
          <input value={form.metWith} onChange={ubah("metWith")} className="input-field w-full" placeholder="Nama / jabatan yang dituju" />
        </div>
        <div>
          <label className="label-field">Nomor WhatsApp</label>
          <input value={form.phone} onChange={ubah("phone")} className="input-field w-full" placeholder="08xxxxxxxxxx" inputMode="tel" autoComplete="tel" />
        </div>
      </div>

      {err ? <p className="error-msg">{err}</p> : null}

      <button type="submit" disabled={kirim} className="btn-modal-save w-full py-3 disabled:opacity-50">
        {kirim ? <Loader2 size={16} className="animate-spin" /> : null}
        {kirim ? "Menyimpan..." : "Kirim"}
      </button>
      <p className="text-center text-xs text-gray-400">
        Data ini hanya dipakai untuk catatan kunjungan sekolah. Jam datang tercatat otomatis.
      </p>
    </form>
  );
}
