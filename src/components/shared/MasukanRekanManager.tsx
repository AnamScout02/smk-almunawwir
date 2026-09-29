"use client";
import { useEffect, useState } from "react";
import { MessageSquareHeart, Loader2, Send, Inbox, ShieldAlert } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";

interface Masuk { id: string; jenis: string; isi: string; dibacaAt: string | null; createdAt: string }
interface Terkirim extends Masuk { penerima: { name: string } }
interface Rekan { id: string; name: string; role: string }

const LABEL: Record<string, string> = { KRITIK: "Kritik", SARAN: "Saran", APRESIASI: "Apresiasi" };
const BADGE: Record<string, string> = {
  KRITIK: "bg-amber-50 text-amber-700 border border-amber-200",
  SARAN: "bg-blue-50 text-blue-700 border border-blue-200",
  APRESIASI: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};
const tgl = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

/** Kritik & saran antar pegawai tanpa nama pengirim. Penerima tidak pernah menerima data
 *  pengirim dari server sama sekali — lihat src/lib/masukan-rekan.ts. */
export default function MasukanRekanManager() {
  const toast = useToast();
  const [tab, setTab] = useState<"masuk" | "kirim" | "terkirim">("masuk");
  const [masuk, setMasuk] = useState<Masuk[]>([]);
  const [terkirim, setTerkirim] = useState<Terkirim[]>([]);
  const [rekan, setRekan] = useState<Rekan[]>([]);
  const [loading, setLoading] = useState(true);

  const [penerimaId, setPenerimaId] = useState("");
  const [jenis, setJenis] = useState("SARAN");
  const [isi, setIsi] = useState("");
  const [kirim, setKirim] = useState(false);
  const [cari, setCari] = useState("");

  function muat() {
    setLoading(true);
    fetch("/api/masukan-rekan", { cache: "no-store" }).then(r => r.json()).then(d => {
      setMasuk(Array.isArray(d.masuk) ? d.masuk : []);
      setTerkirim(Array.isArray(d.terkirim) ? d.terkirim : []);
      setRekan(Array.isArray(d.rekan) ? d.rekan : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { muat(); }, []);

  async function handleKirim() {
    if (!penerimaId) { toast.error("Pilih rekan tujuan."); return; }
    if (isi.trim().length < 10) { toast.error("Tulis masukannya minimal 10 karakter."); return; }
    setKirim(true);
    const res = await fetch("/api/masukan-rekan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ penerimaId, jenis, isi }),
    });
    setKirim(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Gagal mengirim"); return; }
    toast.success("Masukan terkirim tanpa namamu.");
    setIsi(""); setPenerimaId("");
    muat(); setTab("terkirim");
  }

  async function tandaiDibaca(id: string) {
    await fetch("/api/masukan-rekan", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    }).catch(() => {});
    setMasuk(p => p.map(m => m.id === id ? { ...m, dibacaAt: new Date().toISOString() } : m));
  }

  const belumDibaca = masuk.filter(m => !m.dibacaAt).length;
  const tersaring = tab === "masuk"
    ? masuk.filter(m => !cari || m.isi.toLowerCase().includes(cari.toLowerCase()) || LABEL[m.jenis]?.toLowerCase().includes(cari.toLowerCase()))
    : [];
  const hal = usePaginasi(tersaring, 20, cari);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<MessageSquareHeart size={22} />} title="Masukan Rekan"
        description="Kritik, saran, dan apresiasi antar pegawai — tanpa nama pengirim" />

      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile ikon="pesan" color="primary" value={masuk.length} label="Masukan Diterima" />
        <StatTile ikon="menunggu" color={belumDibaca ? "amber" : "emerald"} value={belumDibaca} label="Belum Dibaca" sorot={belumDibaca > 0} />
        <StatTile ikon="kontak" color="blue" value={terkirim.length} label="Sudah Saya Kirim" />
      </div>

      <div className="baris-alat mb-5">
        <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
          {([["masuk", "Kotak Masuk"], ["kirim", "Tulis Masukan"], ["terkirim", "Terkirim"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === v ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
          ))}
        </div>
        {tab === "masuk" && masuk.length > 0 && (
          <div className="alat-cari">
            <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari isi masukan..." className="input-field" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : tab === "kirim" ? (
        <div className="panel p-5 max-w-2xl space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-2.5">
            <ShieldAlert size={16} className="shrink-0 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800">
              Nama pengirim <b>tidak ditampilkan kepada penerima</b> maupun rekan lain. Yang perlu kamu tahu:
              <b> Superadmin tetap dapat melihat siapa mengirim ke siapa</b> — supaya fitur ini tidak
              dipakai untuk menyerang orang tanpa tanggung jawab.
            </p>
          </div>
          <div>
            <label className="label-field">Kepada</label>
            <Select value={penerimaId} onChange={setPenerimaId} placeholder="Pilih rekan..."
              options={rekan.map(r => ({ value: r.id, label: r.name }))} />
          </div>
          <div>
            <label className="label-field">Jenis</label>
            <Select value={jenis} onChange={setJenis} options={[
              { value: "SARAN", label: "Saran" }, { value: "KRITIK", label: "Kritik" }, { value: "APRESIASI", label: "Apresiasi" },
            ]} />
          </div>
          <div>
            <label className="label-field">Isi masukan</label>
            <textarea className="input-field" rows={6} maxLength={2000} value={isi} onChange={e => setIsi(e.target.value)}
              placeholder="Sampaikan dengan jelas dan sopan — sebutkan hal konkretnya, bukan menilai orangnya." />
            <p className="mt-1 text-xs text-gray-500">{isi.length}/2000 karakter</p>
          </div>
          <div className="flex justify-end">
            <button onClick={handleKirim} disabled={kirim} className="btn-modal-save">
              {kirim ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Kirim
            </button>
          </div>
        </div>
      ) : tab === "masuk" ? (
        masuk.length === 0 ? (
          <EmptyState icon={Inbox} title="Belum Ada Masukan" description="Belum ada rekan yang mengirim masukan untukmu." />
        ) : (
          <div className="space-y-3">
            {hal.potongan.map(m => (
              <div key={m.id} className={`panel p-5 ${m.dibacaAt ? "" : "border-primary-100"}`}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${BADGE[m.jenis] ?? ""}`}>{LABEL[m.jenis] ?? m.jenis}</span>
                  <span className="text-xs text-gray-400">{tgl(m.createdAt)}</span>
                  {!m.dibacaAt && (
                    <button onClick={() => tandaiDibaca(m.id)} className="ml-auto text-xs font-semibold text-primary-700 hover:underline">
                      Tandai dibaca
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.isi}</p>
              </div>
            ))}
            <Paginasi hal={hal} satuan="masukan" />
          </div>
        )
      ) : (
        terkirim.length === 0 ? (
          <EmptyState icon={Send} title="Belum Ada yang Dikirim" description="Masukan yang kamu kirim akan tercatat di sini." />
        ) : (
          <div className="space-y-3">
            {terkirim.map(m => (
              <div key={m.id} className="panel p-5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${BADGE[m.jenis] ?? ""}`}>{LABEL[m.jenis] ?? m.jenis}</span>
                  <span className="text-sm font-semibold text-primary-900">→ {m.penerima.name}</span>
                  <span className="text-xs text-gray-400">{tgl(m.createdAt)}</span>
                  <span className={`ml-auto text-xs font-semibold ${m.dibacaAt ? "text-emerald-700" : "text-gray-400"}`}>
                    {m.dibacaAt ? "Sudah dibaca" : "Belum dibaca"}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.isi}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
