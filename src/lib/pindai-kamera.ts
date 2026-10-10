"use client";
import { useEffect, useRef, useState } from "react";

export type StatusKamera = "mati" | "meminta-izin" | "aktif" | "ditolak" | "perlu-https" | "tidak-didukung" | "galat";

type Detektor = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** Pindai QR lewat kamera belakang HP/laptop. Memakai BarcodeDetector bawaan browser bila ada (Chrome
 * Android/desktop), selain itu `jsqr` (JavaScript murni — jalan di Safari iPhone). Kamera hanya bisa dibuka di
 * alamat HTTPS. Kode yang sama diabaikan selama `jedaUlangMs` supaya satu QR tidak terkirim berkali-kali. */
export function usePindaiKamera({ aktif, onKode, jedaUlangMs = 4000, format }: { aktif: boolean; onKode: (kode: string) => void; jedaUlangMs?: number;
  /** Jenis kode selain QR (mis. ["ean_13"] untuk ISBN). Hanya lewat BarcodeDetector bawaan — peramban tanpanya (Safari iPhone) berstatus "tidak-didukung". */
  format?: string[] }) {
  const formatKunci = (format ?? ["qr_code"]).join(",");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<StatusKamera>("mati");
  const onKodeRef = useRef(onKode);
  onKodeRef.current = onKode;

  useEffect(() => {
    if (!aktif) { setStatus("mati"); return; }
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) { setStatus("perlu-https"); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("tidak-didukung"); return; }

    let berhenti = false;
    let stream: MediaStream | null = null;
    let jeda: ReturnType<typeof setTimeout> | null = null;
    const terakhir = { kode: "", waktu: 0 };
    const kanvas = document.createElement("canvas");
    const ctx = kanvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      setStatus("meminta-izin");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      } catch (e) {
        if (!berhenti) setStatus((e as DOMException)?.name === "NotAllowedError" ? "ditolak" : "galat");
        return;
      }
      if (berhenti) { stream.getTracks().forEach(t => t.stop()); return; }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play().catch(() => {});
      setStatus("aktif");

      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detektor }).BarcodeDetector;
      let detektor: Detektor | null = null;
      if (BD) { try { detektor = new BD({ formats: formatKunci.split(",") }); } catch { detektor = null; } }
      // jsqr hanya mengerti QR: untuk barcode batang tanpa BarcodeDetector, kamera dimatikan lagi dan pemanggil memakai ketikan.
      if (!detektor && formatKunci !== "qr_code") { stream.getTracks().forEach(t => t.stop()); setStatus("tidak-didukung"); return; }
      const jsQR = detektor ? null : (await import("jsqr")).default;

      const putaran = async () => {
        if (berhenti) return;
        let kode: string | null = null;
        try {
          if (video.readyState >= 2 && video.videoWidth) {
            if (detektor) {
              const hasil = await detektor.detect(video);
              kode = hasil[0]?.rawValue ?? null;
            } else if (jsQR && ctx) {
              const skala = Math.min(1, 640 / video.videoWidth);
              kanvas.width = Math.round(video.videoWidth * skala);
              kanvas.height = Math.round(video.videoHeight * skala);
              ctx.drawImage(video, 0, 0, kanvas.width, kanvas.height);
              const gambar = ctx.getImageData(0, 0, kanvas.width, kanvas.height);
              kode = jsQR(gambar.data, gambar.width, gambar.height, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
          }
        } catch { /* bingkai gagal dibaca — coba bingkai berikutnya */ }
        if (kode && (kode !== terakhir.kode || Date.now() - terakhir.waktu > jedaUlangMs)) {
          terakhir.kode = kode; terakhir.waktu = Date.now();
          onKodeRef.current(kode);
        }
        jeda = setTimeout(putaran, 250);
      };
      putaran();
    })();

    return () => {
      berhenti = true;
      if (jeda) clearTimeout(jeda);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [aktif, jedaUlangMs, formatKunci]);

  return { videoRef, status };
}

/** Id perangkat acak yang menetap di browser — sama dengan yang dipakai ujian online. */
export function idPerangkat() {
  const KUNCI = "smk-perangkat-ujian";
  try {
    let id = localStorage.getItem(KUNCI);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(KUNCI, id); }
    return id;
  } catch {
    return null;
  }
}
