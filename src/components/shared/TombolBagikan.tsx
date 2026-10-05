"use client";
import { useId, useState, type CSSProperties, type MouseEvent } from "react";
import { Share2, Link2, MessageCircle, Globe } from "lucide-react";
import { salinTeks } from "@/lib/salin-teks";

/** Tombol Bagikan (2 Oktober 2026).
 *  - HP: Web Share API → lembar bagi bawaan (WA, IG, Telegram, …).
 *  - Selain itu: menu kecil memakai Popover API (`popover` + `popovertarget`, tutup otomatis saat
 *    klik di luar / Esc, tanpa state) yang ditambatkan ke tombol dengan CSS Anchor Positioning.
 *    Peramban tanpa anchor positioning menaruh menu di tengah layar (perilaku bawaan popover) —
 *    tetap bisa dipakai. Id unik dari useId (CLAUDE.md #15). */
export default function TombolBagikan({ judul, teks, url, label = "Bagikan", className = "" }: {
  judul: string; teks?: string; url?: string; label?: string; className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const [pesan, setPesan] = useState("");
  const alamat = () => url ?? (typeof window !== "undefined" ? window.location.href : "");

  async function bagikan(e: MouseEvent<HTMLButtonElement>) {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      e.preventDefault();
      try { await nav.share({ title: judul, text: teks ?? judul, url: alamat() }); } catch { /* dibatalkan */ }
    }
    // Tanpa navigator.share, klik diteruskan ke popovertarget → menu cadangan terbuka.
  }

  const jangkar = `--bagikan-${id}`;
  return (
    <>
      <button type="button" onClick={bagikan} popoverTarget={`menu-${id}`}
        style={{ anchorName: jangkar } as CSSProperties} className={className}>
        <Share2 size={16} /> {label}
      </button>
      <div id={`menu-${id}`} popover="auto"
        style={{ positionAnchor: jangkar, top: "anchor(bottom)", left: "anchor(left)", positionTryFallbacks: "flip-block, flip-inline", margin: "6px 0 0" } as CSSProperties}
        className="w-56 rounded-2xl border border-gray-100 bg-white p-1.5 text-sm text-primary-900 shadow-xl">
        <a href={`https://wa.me/?text=${encodeURIComponent(`${teks ?? judul} ${alamat()}`)}`} target="_blank" rel="noopener"
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-gray-50"><MessageCircle size={16} className="text-emerald-600" /> WhatsApp</a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(alamat())}`} target="_blank" rel="noopener"
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-gray-50"><Globe size={16} className="text-blue-600" /> Facebook</a>
        <button type="button" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-gray-50"
          onClick={async () => setPesan((await salinTeks(alamat())) ? "Tautan disalin" : "Gagal menyalin")}>
          <Link2 size={16} className="text-gray-500" /> {pesan || "Salin tautan"}
        </button>
      </div>
    </>
  );
}
