"use client";
import { useEffect, useState } from "react";
import { Copy, Loader2, Share2, UsersRound } from "lucide-react";
import { salinTeks } from "@/lib/salin-teks";

type Data = { punya: boolean; kode?: string; nama?: string; label?: string; tautan?: string; qr?: string; pendaftar?: number };

/** Kartu referral milik akun yang sedang masuk — ditempel DI BAWAH kartu identitas pada halaman
 *  `/kartu-identitas`, bukan di halaman kartu baru (CLAUDE.md #53: satu halaman kartu untuk semua).
 *
 *  Tidak semua akun punya kode, jadi kartu ini DIAM SEPENUHNYA bila belum terdaftar sebagai
 *  perujuk — bukan menampilkan kartu kosong atau pesan "Anda belum punya kode", yang hanya akan
 *  membingungkan sebagian besar pengguna yang memang tidak perlu. */
export default function KartuReferral() {
  const [d, setD] = useState<Data | null>(null);
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    fetch("/api/spmb/perujuk/saya")
      .then(r => r.json())
      .then(setD)
      .catch(() => setD({ punya: false }));
  }, []);

  if (!d) return (
    <div className="mx-auto mt-5 flex max-w-md justify-center px-4 text-gray-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  );
  if (!d.punya) return null;

  const ajakan = `Assalamualaikum. Mau daftar di SMK Al-Munawwir IIBS? Lewat tautan ini ya, biar tercatat rujukan dari ${d.nama}:\n${d.tautan}`;

  return (
    <div className="mx-auto mt-5 max-w-md px-4">
      <div className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
          <UsersRound size={16} className="text-gold-dark" />
          <p className="font-heading text-sm font-semibold text-navy">Kartu Referral SPMB</p>
        </div>

        <div className="p-5 text-center">
          <p className="text-sm text-gray-600">
            Ajak calon murid baru. Yang mendaftar lewat kode ini tercatat sebagai rujukan Anda.
          </p>

          {d.qr && (
            <div className="relative mx-auto mt-4 w-fit rounded-2xl border border-primary-100 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.qr} alt="QR referral" className="h-44 w-44" />
            </div>
          )}

          <p className="label-kecil mt-4 text-gray-500">Kode Anda</p>
          <p className="angka font-heading text-xl font-bold tracking-wider text-primary-900">{d.kode}</p>
          <p className="mt-1 text-xs text-gray-500">
            {d.label} · sudah mengajak <span className="angka font-semibold text-primary-900">{d.pendaftar ?? 0}</span> pendaftar
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="btn-modal-cancel"
              onClick={async () => {
                // salinTeks, bukan navigator.clipboard — situs juga dibuka lewat HTTP (CLAUDE.md #28)
                const ok = await salinTeks(d.tautan ?? "");
                setPesan(ok ? "Tautan disalin" : "Belum tersalin — salin manual dari kode di atas");
              }}>
              <Copy size={16} /> Salin Tautan
            </button>
            <a className="btn-modal-save" target="_blank" rel="noopener"
              href={`https://wa.me/?text=${encodeURIComponent(ajakan)}`}>
              <Share2 size={16} /> Bagikan
            </a>
          </div>
          {pesan && <p className="mt-2 text-xs font-medium text-primary-700">{pesan}</p>}

          <p className="mt-4 text-xs leading-relaxed text-gray-400">
            Tunjukkan QR ini agar calon memindainya langsung — formulirnya terbuka dengan kode Anda sudah terisi.
          </p>
        </div>
      </div>
    </div>
  );
}
