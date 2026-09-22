"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, BookMarked, Camera, CameraOff, CheckCircle2, CornerDownLeft, IdCard, Loader2, RotateCcw, ScanLine, User, X, XCircle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { usePindaiKamera } from "@/lib/pindai-kamera";
import { unlockScanAudio, playScanError, playScanInfo, playScanSuccess } from "@/lib/scan-beep";

interface Anggota { id: string; nama: string; jenis: string; identitas: string; kelas: string | null; foto: string | null; aktif: boolean }
interface Pinjaman { id: string; buku: { id: string; title: string; author: string | null; barcode: string | null }; tanggalPinjam: string; jatuhTempo: string; terlambat: boolean; hariTerlambat: number; denda: number }
interface Ringkas {
  anggota: Anggota; aktif: Pinjaman[]; reservasi: { id: string; status: string; buku: { id: string; title: string } }[];
  totalTunggakan: number; aturan: { maksPinjam: number; masaHari: number; dendaPerHari: number };
}
type Log = { id: string; jam: string; jenis: "PINJAM" | "KEMBALI" | "GAGAL"; teks: string };

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
const tgl = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

/** MEJA SIRKULASI — alur dua pindaian: kartu anggota → buku. Scanner USB mengetik ke kotak yang selalu fokus
 * (Enter), atau kamera HP/laptop. Pindai buku yang sedang dipinjam anggota itu = pengembalian; selain itu =
 * peminjaman. Semua aturan (stok, batas pinjam, keterlambatan, jatah pemesan) diperiksa di server. */
export default function MejaSirkulasi() {
  const [data, setData] = useState<Ringkas | null>(null);
  const [kode, setKode] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [kamera, setKamera] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: "sukses" | "info" | "galat"; judul: string; isi?: string; bisaPaksa?: boolean; kodePaksa?: string } | null>(null);
  const [log, setLog] = useState<Log[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef<Ringkas | null>(null);
  dataRef.current = data;

  useEffect(() => { inputRef.current?.focus(); }, [data]);

  const catat = (jenis: Log["jenis"], teks: string) =>
    setLog(l => [{ id: crypto.randomUUID(), jam: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }), jenis, teks }, ...l].slice(0, 20));

  const kirim = useCallback(async (raw: string, paksa = false) => {
    const k = raw.trim();
    setKode("");
    if (!k || sibuk) return;
    setSibuk(true);
    const anggota = dataRef.current?.anggota;
    try {
      if (!anggota) {
        const r = await fetch("/api/perpustakaan/sirkulasi/anggota", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kode: k }) });
        const d = await r.json();
        if (!r.ok) { playScanError(); setPesan({ jenis: "galat", judul: d.error ?? "Kartu tidak dikenali" }); return; }
        playScanInfo();
        setData(d);
        setPesan({ jenis: "info", judul: `Melayani ${d.anggota.nama}`, isi: "Pindai barcode buku untuk meminjam atau mengembalikan." });
        return;
      }
      const r = await fetch("/api/perpustakaan/sirkulasi/buku", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kode: k, anggotaId: anggota.id, paksa }) });
      const d = await r.json();
      if (!r.ok) {
        playScanError();
        setPesan({ jenis: "galat", judul: d.error ?? "Gagal memproses buku", bisaPaksa: !!d.bisaPaksa, kodePaksa: k });
        catat("GAGAL", d.error ?? k);
        return;
      }
      playScanSuccess();
      setData(d);
      if (d.hasil === "PINJAM") {
        setPesan({ jenis: "sukses", judul: `Dipinjam: ${d.buku.title}`, isi: `Kembalikan paling lambat ${tgl(d.jatuhTempo)}.${d.reservasiSelesai ? " Pesanan anggota ini untuk buku tersebut ditandai selesai." : ""}` });
        catat("PINJAM", `${d.buku.title} → ${anggota.nama}`);
      } else {
        setPesan({ jenis: d.denda ? "info" : "sukses", judul: `Dikembalikan: ${d.buku.title}`, isi: d.denda ? `Terlambat ${d.hariTerlambat} hari — denda ${rupiah(d.denda)}.` : `Tepat waktu.${d.reservasiDisiapkan ? " Pemesan berikutnya sudah diberi tahu." : ""}` });
        catat("KEMBALI", `${d.buku.title} ← ${anggota.nama}${d.denda ? ` (denda ${rupiah(d.denda)})` : ""}`);
      }
    } catch {
      playScanError();
      setPesan({ jenis: "galat", judul: "Koneksi terputus. Coba pindai lagi." });
    } finally {
      setSibuk(false);
      inputRef.current?.focus();
    }
  }, [sibuk]);

  const { videoRef, status: statusKamera } = usePindaiKamera({ aktif: kamera, onKode: k => kirim(k) });

  function selesai() { setData(null); setPesan(null); inputRef.current?.focus(); }

  const gaya = {
    sukses: "bg-emerald-50 border-emerald-200 text-emerald-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
    galat: "bg-red-50 border-red-200 text-red-800",
  };

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8" onClick={() => unlockScanAudio()}>
      <PageHeader icon={<ScanLine size={22} />} title="Meja Sirkulasi" description="Pindai kartu anggota, lalu pindai buku — peminjaman dan pengembalian dalam satu layar" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <div className="page-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${data ? "bg-gold/15 text-gold-dark" : "bg-primary-50 text-primary-700"}`}>{data ? <BookMarked size={18} /> : <IdCard size={18} />}</span>
              <div>
                <p className="font-heading font-bold text-primary-900">{data ? "Langkah 2 — Pindai buku" : "Langkah 1 — Pindai kartu anggota"}</p>
                <p className="text-xs text-gray-500">{data ? "Buku yang sedang dipinjam anggota ini otomatis dikembalikan." : "Kartu pelajar / kartu tanda guru & pegawai, atau kartu anggota digital di HP."}</p>
              </div>
            </div>
            <button type="button" onClick={() => setKamera(k => !k)} className="btn-modal-cancel">
              {kamera ? <><CameraOff size={15} /> Matikan kamera</> : <><Camera size={15} /> Pakai kamera</>}
            </button>
          </div>
          {kamera && (
            <div className="relative mb-3 rounded-2xl overflow-hidden bg-black aspect-video max-h-72">
              <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-[18%] border-2 border-gold/80 rounded-2xl pointer-events-none" />
              {statusKamera !== "aktif" && <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm p-4 text-center">{statusKamera === "perlu-https" ? "Kamera hanya bisa dibuka lewat alamat HTTPS." : statusKamera === "ditolak" ? "Izin kamera ditolak." : "Membuka kamera…"}</div>}
            </div>
          )}
          <div className="relative">
            <ScanLine size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input ref={inputRef} value={kode} onChange={e => setKode(e.target.value)} disabled={sibuk}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); kirim(kode); } }}
              placeholder={data ? "Pindai barcode buku, atau ketik kode lalu Enter" : "Pindai kartu anggota, atau ketik NIS/NIP lalu Enter"}
              className="input-field pl-11 pr-12 py-3.5 text-base font-mono" autoFocus />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300">{sibuk ? <Loader2 size={18} className="animate-spin" /> : <CornerDownLeft size={18} />}</span>
          </div>
          {pesan && (
            <div className={`mt-3 rounded-xl border p-3 flex items-start gap-2 ${gaya[pesan.jenis]}`}>
              {pesan.jenis === "galat" ? <XCircle size={18} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={18} className="shrink-0 mt-0.5" />}
              <div className="flex-1 text-sm">
                <p className="font-semibold">{pesan.judul}</p>
                {pesan.isi && <p className="opacity-80">{pesan.isi}</p>}
                {pesan.bisaPaksa && pesan.kodePaksa && (
                  <button type="button" onClick={() => kirim(pesan.kodePaksa!, true)} className="mt-2 text-xs font-semibold underline">Tetap pinjamkan (disetujui petugas)</button>
                )}
              </div>
            </div>
          )}
        </div>

        {data && (
          <div className="page-card overflow-hidden">
            <div className="p-5 flex flex-wrap items-center gap-4 border-b border-gray-100">
              {data.anggota.foto ? (
                <Image src={data.anggota.foto} alt="" width={64} height={64} className="w-16 h-16 rounded-2xl object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center"><User size={28} /></div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-heading text-lg font-bold text-primary-900 truncate">{data.anggota.nama}</p>
                <p className="text-sm text-gray-500">{data.anggota.jenis === "SISWA" ? `Siswa · ${data.anggota.kelas ?? "-"}` : data.anggota.jenis === "GURU" ? "Guru" : "Pegawai"} · <span className="font-mono">{data.anggota.identitas}</span></p>
                {!data.anggota.aktif && <p className="text-xs font-semibold text-red-600">Bukan siswa aktif — tidak bisa meminjam.</p>}
              </div>
              <div className="flex gap-2 text-center">
                <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100"><p className="font-heading font-bold text-primary-900">{data.aktif.length}/{data.aturan.maksPinjam}</p><p className="text-xs text-gray-400 uppercase">dipinjam</p></div>
                <div className={`px-3 py-2 rounded-xl border ${data.totalTunggakan ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-100"}`}><p className={`font-heading font-bold ${data.totalTunggakan ? "text-red-600" : "text-primary-900"}`}>{rupiah(data.totalTunggakan)}</p><p className="text-xs text-gray-400 uppercase">denda</p></div>
              </div>
              <button type="button" onClick={selesai} className="btn-modal-cancel"><X size={15} /> Selesai</button>
            </div>
            {data.aktif.length === 0 ? (
              <p className="p-5 text-sm text-gray-400">Tidak ada buku yang sedang dipinjam.</p>
            ) : (
              <div className="overflow-x-auto"><table className="data-table">
                <thead><tr><th>Buku dipinjam</th><th>Dipinjam</th><th>Batas</th><th className="text-right">Keterangan</th></tr></thead>
                <tbody>
                  {data.aktif.map(p => (
                    <tr key={p.id} className={p.terlambat ? "bg-red-50/40" : ""}>
                      <td><span className="font-medium">{p.buku.title}</span><span className="block text-xs text-gray-400 font-mono">{p.buku.barcode}</span></td>
                      <td className="text-xs whitespace-nowrap">{tgl(p.tanggalPinjam)}</td>
                      <td className="text-xs whitespace-nowrap">{tgl(p.jatuhTempo)}</td>
                      <td className="text-right">
                        {p.terlambat ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle size={12} /> {p.hariTerlambat} hari · {rupiah(p.denda)}</span> : <span className="text-xs text-emerald-700">Tepat waktu</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
            {data.reservasi.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 text-sm">
                <span className="font-semibold text-primary-900">Pesanan: </span>
                {data.reservasi.map(r => <span key={r.id} className={`inline-block mr-2 mt-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${r.status === "TERSEDIA" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{r.buku.title} · {r.status === "TERSEDIA" ? "siap diambil" : "menunggu"}</span>)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="page-card overflow-hidden h-fit">
        <div className="page-card-header">
          <h3 className="font-heading font-semibold text-primary-900">Transaksi Sesi Ini</h3>
          {log.length > 0 && <button type="button" onClick={() => setLog([])} className="text-xs text-gray-400 hover:text-primary-700 inline-flex items-center gap-1"><RotateCcw size={12} /> bersihkan</button>}
        </div>
        {log.length === 0 ? (
          <p className="p-5 text-sm text-gray-400">Belum ada transaksi.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {log.map(l => (
              <li key={l.id} className="px-5 py-2.5 flex items-start gap-2 text-sm">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${l.jenis === "PINJAM" ? "bg-blue-500" : l.jenis === "KEMBALI" ? "bg-emerald-500" : "bg-red-500"}`} />
                <span className="flex-1 text-gray-700">{l.teks}</span>
                <span className="text-xs text-gray-400 font-mono">{l.jam}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}
