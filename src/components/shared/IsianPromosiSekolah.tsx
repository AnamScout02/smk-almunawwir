"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Loader2 } from "lucide-react";
import Modal from "@/components/admin/Modal";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";

/** Isian panitia per sekolah sasaran (kepala sekolah, nomor yang bisa dihubungi, catatan, tanggal dikunjungi). */
export default function IsianPromosiSekolah({ npsn, nama, awal }: { npsn: string; nama: string; awal: { kepala: string; kontak: string; catatan: string; dikunjungi: string } }) {
  const router = useRouter(), toast = useToast();
  const [buka, setBuka] = useState(false);
  const [f, setF] = useState(awal);
  const [simpan, setSimpan] = useState(false);
  async function kirim() {
    setSimpan(true);
    const r = await fetch(`/api/spmb/potensi/${encodeURIComponent(npsn)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).catch(() => null);
    setSimpan(false);
    if (!r?.ok) { toast.error("Gagal menyimpan"); return; }
    toast.success("Tersimpan"); setBuka(false); router.refresh();
  }
  return (
    <>
      <button type="button" onClick={() => { setF(awal); setBuka(true); }} title="Isi kepala sekolah, kontak & catatan"
        className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
      <Modal open={buka} onClose={() => setBuka(false)} title="Data persiapan promosi" description={nama}
        footer={<>
          <button type="button" onClick={() => setBuka(false)} className="btn-modal-cancel flex-1">Batal</button>
          <button type="button" onClick={kirim} disabled={simpan} className="btn-modal-save flex-1">{simpan && <Loader2 className="animate-spin" />} Simpan</button>
        </>}>
        <div className="space-y-3">
          <div><label className="label-field">Nama kepala sekolah</label><input value={f.kepala} onChange={e => setF({ ...f, kepala: e.target.value })} className="input-field" maxLength={120} /></div>
          <div><label className="label-field">Nomor yang bisa dihubungi</label><input value={f.kontak} onChange={e => setF({ ...f, kontak: e.target.value })} className="input-field" inputMode="tel" maxLength={60} placeholder="HP kepala sekolah / guru BK / humas" /></div>
          <div><label className="label-field">Tanggal dikunjungi (kosongkan bila belum)</label><DatePicker value={f.dikunjungi} onChange={v => setF({ ...f, dikunjungi: v })} /></div>
          <div><label className="label-field">Catatan</label><textarea value={f.catatan} onChange={e => setF({ ...f, catatan: e.target.value })} rows={3} maxLength={600} className="input-field resize-none" placeholder="Nama guru BK, waktu yang diizinkan untuk sosialisasi, hasil kunjungan…" /></div>
        </div>
      </Modal>
    </>
  );
}
