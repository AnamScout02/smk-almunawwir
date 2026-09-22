"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, RotateCcw, Square, UploadCloud } from "lucide-react";
import { fetchUjian, tahanPengawasan, lepasPengawasan } from "@/lib/perangkat-ujian";

/** PEREKAM JAWABAN LISAN (22 September 2026) — siswa merekam jawabannya di browser (MediaRecorder), berhenti sendiri di
 * batas durasi, lalu diunggah ke folder rahasia (POST /api/student/exams/[id]/lisan). Bila unggahan gagal (koneksi),
 * rekaman TETAP di perangkat dan bisa dikirim ulang. Mikrofon hanya tersedia lewat HTTPS. */

const PILIHAN_MIME = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const fmt = (d: number) => `${Math.floor(d / 60)}:${String(d % 60).padStart(2, "0")}`;

export default function PerekamLisan({ examId, questionId, durasiMaks, jawaban, onTersimpan, aktif }: {
  examId: string; questionId: string; durasiMaks: number; jawaban: string | null;
  onTersimpan: (url: string) => void; aktif: boolean;
}) {
  const [status, setStatus] = useState<"siap" | "merekam" | "mengunggah">("siap");
  const [detik, setDetik] = useState(0);
  const [pesan, setPesan] = useState("");
  const [tertunda, setTertunda] = useState<Blob | null>(null);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const perekam = useRef<MediaRecorder | null>(null);
  const aliran = useRef<MediaStream | null>(null);
  const pewaktu = useRef<ReturnType<typeof setInterval> | null>(null);
  const hitung = useRef(0);

  const bersihkan = () => {
    if (pewaktu.current) clearInterval(pewaktu.current);
    aliran.current?.getTracks().forEach(t => t.stop());
    aliran.current = null;
  };
  useEffect(() => () => { if (perekam.current?.state === "recording") perekam.current.stop(); bersihkan(); }, []);
  useEffect(() => () => { if (pratinjau) URL.revokeObjectURL(pratinjau); }, [pratinjau]);

  async function kirim(blob: Blob) {
    setStatus("mengunggah"); setPesan("");
    const fd = new FormData();
    fd.append("questionId", questionId);
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    fd.append("file", new File([blob], `jawaban.${ext}`, { type: blob.type.split(";")[0] }));
    const r = await fetchUjian(`/api/student/exams/${examId}/lisan`, { method: "POST", body: fd }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setStatus("siap");
    if (r?.ok && d?.url) { setTertunda(null); onTersimpan(d.url); return; }
    setTertunda(blob);
    setPesan(d?.error ?? "Rekaman belum terkirim karena koneksi terputus — tekan Kirim Ulang. Rekaman masih tersimpan di perangkat ini.");
  }

  async function mulai() {
    setPesan("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPesan("Perangkat/browser ini tidak bisa merekam suara. Rekam suara hanya bisa lewat alamat HTTPS (https://…) di browser terbaru — lapor ke pengawas.");
      return;
    }
    try {
      tahanPengawasan(20_000); // jendela izin mikrofon bukan "pindah tab"
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      lepasPengawasan();
      aliran.current = s;
      const mime = PILIHAN_MIME.find(m => MediaRecorder.isTypeSupported?.(m));
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      const potongan: Blob[] = [];
      rec.ondataavailable = e => { if (e.data.size) potongan.push(e.data); };
      rec.onstop = () => {
        bersihkan();
        const blob = new Blob(potongan, { type: rec.mimeType || mime || "audio/webm" });
        setPratinjau(p => { if (p) URL.revokeObjectURL(p); return URL.createObjectURL(blob); });
        void kirim(blob);
      };
      perekam.current = rec;
      rec.start(1000);
      hitung.current = 0;
      setDetik(0); setStatus("merekam");
      pewaktu.current = setInterval(() => {
        hitung.current += 1;
        setDetik(hitung.current);
        if (hitung.current >= durasiMaks && rec.state === "recording") rec.stop(); // berhenti sendiri di batas durasi
      }, 1000);
    } catch {
      lepasPengawasan();
      bersihkan();
      setPesan("Mikrofon tidak diizinkan. Izinkan akses mikrofon untuk situs ini (ikon gembok di bilah alamat), lalu coba lagi.");
    }
  }

  const berhenti = () => { if (perekam.current?.state === "recording") perekam.current.stop(); };

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      {status === "merekam" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 font-semibold text-red-600">
            <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" /> Merekam… <span className="angka">{fmt(detik)}</span>
          </span>
          <span className="text-xs text-gray-500">sisa <span className="angka">{fmt(Math.max(0, durasiMaks - detik))}</span></span>
          <button type="button" onClick={berhenti} className="btn-modal-save ml-auto"><Square /> Selesai</button>
        </div>
      ) : status === "mengunggah" ? (
        <p className="flex items-center gap-2 text-sm text-gray-600"><Loader2 size={16} className="animate-spin" /> Menyimpan rekaman…</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {aktif && (
            <button type="button" onClick={mulai} className={jawaban ? "btn-modal-cancel" : "btn-modal-save"}>
              {jawaban ? <RotateCcw /> : <Mic />} {jawaban ? "Rekam Ulang" : "Mulai Rekam"}
            </button>
          )}
          {aktif && tertunda && <button type="button" onClick={() => kirim(tertunda)} className="btn-modal-save"><UploadCloud /> Kirim Ulang</button>}
          <span className="text-xs text-gray-500">Maksimal {fmt(durasiMaks)} menit. {jawaban ? "Rekaman terakhir yang tersimpan dipakai sebagai jawaban." : ""}</span>
        </div>
      )}
      {jawaban && status !== "merekam" && (
        <div>
          <p className="label-kecil mb-1">Rekaman tersimpan</p>
          <audio controls preload="none" src={jawaban} className="w-full" />
        </div>
      )}
      {!jawaban && tertunda && pratinjau && (
        <div>
          <p className="label-kecil mb-1">Rekaman belum terkirim</p>
          <audio controls src={pratinjau} className="w-full" />
        </div>
      )}
      {pesan && <p className="text-sm text-red-600">{pesan}</p>}
    </div>
  );
}
