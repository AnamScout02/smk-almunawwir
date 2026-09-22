"use client";
import { useCallback, useEffect, useState } from "react";
import { BriefcaseBusiness, CheckCircle2, ExternalLink, Heart, Loader2, MapPin, X } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import { useToast } from "@/components/shared/ToastProvider";

interface Lowongan { id: string; judul: string; perusahaan: string; lokasi: string | null; jenis: string; kualifikasi: string; deskripsi: string | null; gaji: string | null; batas: string | null; kontak: string | null; tautanLamar: string | null; posterUrl: string | null; minatSaya: { status: string; catatan: string | null } | null }
const STATUS: Record<string, string> = { BERMINAT: "Kamu berminat — BKK akan menghubungi", DIKIRIM: "Berkas dikirim ke perusahaan", PANGGILAN: "Dipanggil tes/wawancara", DITERIMA: "Diterima 🎉", TIDAK_LOLOS: "Belum lolos — tetap semangat" };

/** LOWONGAN KERJA untuk siswa kelas XII (17 Sep 2026). */
export default function LowonganSiswa() {
  const toast = useToast();
  const [d, setD] = useState<{ jenis: Record<string, string>; daftar: Lowongan[] } | null>(null);
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState<Lowongan | null>(null);
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback(() => {
    fetch("/api/bkk/lowongan", { cache: "no-store" }).then(async r => {
      const x = await r.json().catch(() => null);
      if (!r.ok) setGalat(x?.error ?? "Gagal memuat."); else setD(x);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);
  async function minat(batal = false) {
    if (!buka) return;
    setSibuk(true);
    const r = await fetch(`/api/bkk/lowongan/${buka.id}/minat`, { method: batal ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: batal ? undefined : JSON.stringify({ catatan }) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal."); return; }
    toast.success(batal ? "Minat dibatalkan." : "Tercatat — Koordinator BKK akan menindaklanjuti.");
    setBuka(null); muat();
  }
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<BriefcaseBusiness size={22} />} title="Lowongan Kerja" description="Informasi kerja dari Bursa Kerja Khusus (BKK) sekolah" />
      {galat ? <EmptyState icon={BriefcaseBusiness} title="Tidak tersedia" description={galat} />
        : !d ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        : d.daftar.length === 0 ? <EmptyState icon={BriefcaseBusiness} title="Belum ada lowongan" description="Lowongan yang sesuai jurusanmu akan tampil di sini dan dikabarkan lewat notifikasi." />
        : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {d.daftar.map(l => (
              <button key={l.id} type="button" onClick={() => { setBuka(l); setCatatan(l.minatSaya?.catatan ?? ""); }} className="panel panel-interaktif flex flex-col gap-2 p-4 text-left min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.posterUrl && <img src={l.posterUrl} alt="" className="h-36 w-full rounded-xl object-cover" />}
                <p className="font-heading font-semibold text-primary-900">{l.judul}</p>
                <p className="text-sm text-gray-700">{l.perusahaan}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>{d.jenis[l.jenis]}</span>
                  {l.lokasi && <span className="inline-flex items-center gap-1"><MapPin size={12} />{l.lokasi}</span>}
                  {l.batas && <span>Sampai {new Date(l.batas).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })}</span>}
                </p>
                {l.minatSaya && <span className="status-badge w-fit bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 size={12} className="mr-1 inline" />{STATUS[l.minatSaya.status]}</span>}
              </button>
            ))}
          </div>
        )}
      <Modal open={!!buka} onClose={() => !sibuk && setBuka(null)} title={buka?.judul ?? ""} description={buka?.perusahaan} size="lg" scrollBody
        footer={buka && <>
          {buka.minatSaya?.status === "BERMINAT" && <button type="button" disabled={sibuk} onClick={() => minat(true)} className="btn-modal-cancel"><X /> Batalkan Minat</button>}
          {buka.tautanLamar && <a href={buka.tautanLamar} target="_blank" rel="noopener noreferrer" className="btn-modal-cancel"><ExternalLink /> Lamar di Situs Perusahaan</a>}
          {(!buka.minatSaya || buka.minatSaya.status === "BERMINAT") && <button type="button" disabled={sibuk} onClick={() => minat()} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Heart />} {buka.minatSaya ? "Perbarui Catatan" : "Saya Berminat"}</button>}
        </>}>
        {buka && (
          <div className="space-y-4 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {buka.posterUrl && <img src={buka.posterUrl} alt="Poster lowongan" className="w-full rounded-xl" />}
            {buka.deskripsi && <div><p className="label-kecil mb-1">Pekerjaan</p><p className="whitespace-pre-line text-gray-700">{buka.deskripsi}</p></div>}
            <div><p className="label-kecil mb-1">Kualifikasi</p><p className="whitespace-pre-line text-gray-700">{buka.kualifikasi}</p></div>
            {(buka.gaji || buka.kontak) && <p className="text-gray-700">{buka.gaji && <>Gaji/fasilitas: {buka.gaji}<br /></>}{buka.kontak && <>Kontak: {buka.kontak}</>}</p>}
            {buka.minatSaya && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800">{STATUS[buka.minatSaya.status]}</p>}
            {(!buka.minatSaya || buka.minatSaya.status === "BERMINAT") && (
              <div><label htmlFor="catatan-minat" className="label-field">Pesan untuk BKK (opsional)</label><textarea id="catatan-minat" rows={3} maxLength={1000} className="input-field" value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="mis. sertifikat yang kamu punya, pengalaman PKL" /></div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
