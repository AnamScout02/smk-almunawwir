"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { DoorOpen, Loader2, Camera, CheckCircle2, AlertTriangle, LogIn, ImageIcon } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";

interface Izin {
  id: string; alasan: string; keluarPada: string; kembaliRencana: string | null;
  kembaliPada: string | null; dicatatOleh: string; perluFoto: boolean;
  adaBukti: boolean; buktiPada: string | null;
  status: "DI_LUAR" | "KEMBALI" | "BUKTI_TERTUNDA";
  bolehUnggah: boolean; qr: string | null;
}
interface Data {
  sekolah: string; logo: string;
  siswa: { nama: string; nis: string; kelas: string; jurusan: string };
  izin: Izin[];
}

const GAYA: Record<Izin["status"], string> = {
  DI_LUAR: "bg-amber-50 text-amber-700 border-amber-200",
  KEMBALI: "bg-emerald-50 text-emerald-700 border-emerald-200",
  BUKTI_TERTUNDA: "bg-red-50 text-red-600 border-red-200",
};
const LABEL: Record<Izin["status"], string> = {
  DI_LUAR: "Sedang di luar sekolah",
  KEMBALI: "Sudah kembali",
  BUKTI_TERTUNDA: "Bukti foto belum diunggah",
};

const jam = (v: string) => new Date(v).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const tanggal = (v: string) => new Date(v).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

export default function IzinKeluarSiswaPage() {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [unggah, setUnggah] = useState<string | null>(null);
  const berkasRef = useRef<Record<string, HTMLInputElement | null>>({});

  function muat() {
    fetch("/api/student/izin-keluar")
      .then(r => r.json())
      .then((d: Data & { error?: string }) => { if (d.error) setGalat(d.error); else { setData(d); setGalat(""); } })
      .catch(() => setGalat("Gagal memuat surat izin keluar. Periksa sambungan lalu muat ulang."))
      .finally(() => setMemuat(false));
  }
  useEffect(() => { muat(); }, []);

  async function kirimBukti(izinId: string, file: File) {
    setUnggah(izinId);
    const form = new FormData();
    form.append("izinId", izinId);
    form.append("file", file);
    const res = await fetch("/api/student/izin-keluar/bukti", { method: "POST", body: form }).catch(() => null);
    setUnggah(null);
    if (!res) { toast.error("Gagal menghubungi server"); return; }
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.error ?? "Gagal mengunggah bukti foto"); return; }
    toast.success("Bukti foto terkirim");
    muat();
  }

  if (memuat) {
    return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<DoorOpen size={22} />}
        title="Izin Keluar"
        description="Surat izin keluar lingkungan sekolah — tunjukkan ke petugas keamanan atau tempat tujuan"
      />

      <div className="max-w-3xl space-y-6">
        {galat && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{galat}</div>}

        {data && data.izin.some(i => i.status === "BUKTI_TERTUNDA" && i.bolehUnggah) && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Ada bukti foto yang belum kamu unggah</p>
              <p className="text-xs">Guru piket meminta bukti foto dari tempat tujuan untuk izin keluar di bawah ini.</p>
            </div>
          </div>
        )}

        {!data || data.izin.length === 0 ? (
          <EmptyState icon={DoorOpen} title="Belum Ada Izin Keluar"
            description="Surat izin keluar muncul di sini setelah guru piket mencatat izinmu. Kamu tidak perlu membuatnya sendiri." />
        ) : data.izin.map(i => (
          <div key={i.id} className="panel overflow-hidden">
            <div className="flex items-center gap-3 border-b border-gray-100 bg-[#f5f6fa] px-5 py-3">
              <Image src={data.logo} alt="" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" unoptimized />
              <div className="min-w-0 flex-1">
                <p className="font-heading font-semibold text-sm text-primary-900">SURAT IZIN KELUAR</p>
                <p className="truncate text-xs text-gray-500">{data.sekolah}</p>
              </div>
              <span className={`status-badge shrink-0 ${GAYA[i.status]}`}>{LABEL[i.status]}</span>
            </div>

            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-[1fr_auto]">
              <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-gray-500">Nama</dt><dd className="font-semibold text-primary-900">{data.siswa.nama}</dd>
                <dt className="text-gray-500">Kelas</dt><dd>{data.siswa.kelas} · {data.siswa.jurusan}</dd>
                <dt className="text-gray-500">NIS</dt><dd className="angka">{data.siswa.nis}</dd>
                <dt className="text-gray-500">Keperluan</dt><dd>{i.alasan}</dd>
                <dt className="text-gray-500">Tanggal</dt><dd>{tanggal(i.keluarPada)}</dd>
                <dt className="text-gray-500">Jam keluar</dt><dd className="angka">{jam(i.keluarPada)} WIB</dd>
                <dt className="text-gray-500">Rencana kembali</dt><dd className="angka">{i.kembaliRencana ? `${i.kembaliRencana} WIB` : "—"}</dd>
                <dt className="text-gray-500">Kembali</dt>
                <dd className="angka">{i.kembaliPada ? `${jam(i.kembaliPada)} WIB` : "belum tercatat kembali"}</dd>
                <dt className="text-gray-500">Diizinkan oleh</dt><dd>{i.dicatatOleh} <span className="text-xs text-gray-400">(Guru Piket)</span></dd>
              </dl>

              <div className="flex flex-col items-center gap-1 sm:w-32">
                {i.qr ? (
                  <>
                    {/* QR keaslian — petugas keamanan memindai untuk memastikan surat ini benar terbit di sistem sekolah. */}
                    <Image src={i.qr} alt="QR keaslian surat" width={112} height={112} className="h-28 w-28" unoptimized />
                    <p className="text-center text-xs text-gray-400">Pindai untuk memeriksa keaslian surat</p>
                  </>
                ) : <p className="text-sm text-gray-400">QR belum tersedia</p>}
              </div>
            </div>

            {i.perluFoto && (
              <div className="border-t border-gray-100 bg-[#fbfcfe] px-5 py-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-900">
                  <Camera size={15} className="text-amber-600" /> Bukti foto dari tempat tujuan
                </p>
                {i.adaBukti ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <a href={`/api/izin-keluar/${i.id}/bukti`} target="_blank" rel="noreferrer"
                      className="btn-modal-cancel btn-teks"><ImageIcon size={15} /> Lihat bukti foto</a>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                      <CheckCircle2 size={14} /> Terkirim{i.buktiPada ? ` ${jam(i.buktiPada)} WIB` : ""}
                    </span>
                  </div>
                ) : (
                  <p className="mb-2 text-sm text-red-600">Belum diunggah. Ambil foto di tempat tujuan lalu unggah di sini.</p>
                )}
                {i.bolehUnggah && (
                  <div className="mt-2">
                    <input ref={el => { berkasRef.current[i.id] = el; }} type="file" accept="image/jpeg,image/png,image/webp"
                      capture="environment" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) kirimBukti(i.id, f); e.target.value = ""; }} />
                    <button type="button" className="btn-modal-save btn-teks" disabled={unggah === i.id}
                      onClick={() => berkasRef.current[i.id]?.click()}>
                      {unggah === i.id ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                      {i.adaBukti ? "Ganti Bukti Foto" : "Ambil / Unggah Bukti Foto"}
                    </button>
                  </div>
                )}
                {!i.bolehUnggah && !i.adaBukti && (
                  <p className="text-sm text-gray-400">Batas waktu unggah sudah lewat — lapor ke guru piket.</p>
                )}
              </div>
            )}

            {!i.kembaliPada && (
              <div className="flex items-start gap-2 border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
                <LogIn size={14} className="mt-0.5 shrink-0" />
                Saat kembali ke sekolah, tunjukkan kartu pelajarmu ke guru piket untuk dipindai.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
