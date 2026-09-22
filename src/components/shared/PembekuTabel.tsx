"use client";
import { useEffect } from "react";

/** FREEZE TABEL otomatis (permintaan user 15 Sep 2026: "semua tabel kenapa tidak ada freeze") — berlaku untuk SEMUA tabel di
 * dalam <main> yang dibungkus wadah bergulir (`overflow-x-auto` / `overflow-auto`):
 *  - baris judul (thead) menempel saat isi tabel digulir ke bawah — wadahnya dibatasi setinggi layar (`[data-beku-wadah]`);
 *  - kolom pertama — dan kolom kedua bila kolom pertama hanya "No"/"#"/kotak centang — menempel saat tabel digeser ke samping,
 *    HANYA bila tabel memang lebih lebar dari wadahnya dan kolom beku tidak memakan lebih dari separuh wadah.
 * Gayanya di globals.css (blok "FREEZE TABEL", khusus layar). Komponen ini hanya memasang atribut data-* dan variabel CSS —
 * tidak memindah elemen — jadi aman terhadap render ulang React. Dilewati: dokumen cetak (`.print-doc`, `.a4-page`), tabel yang
 * sudah memakai sticky sendiri (Buku Induk, jadwal), dan tabel/leluhur ber-`data-beku="tidak"`. Dipasang sekali di Providers. */
export default function PembekuTabel() {
  useEffect(() => {
    let antrean = 0;
    const jalankan = () => {
      antrean = 0;
      document.querySelectorAll<HTMLTableElement>("main table").forEach(bekukan);
    };
    const antre = () => { if (!antrean) antrean = requestAnimationFrame(jalankan); };
    const pengamat = new MutationObserver(antre);
    pengamat.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", antre);
    antre();
    return () => {
      pengamat.disconnect();
      window.removeEventListener("resize", antre);
      if (antrean) cancelAnimationFrame(antrean);
    };
  }, []);
  return null;
}

const KOLOM_NOMOR = /^(no\.?|nomor|#)?$/i;
const FUNGSI_WARNA = /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\((?:[^()]|\([^()]*\))*\)/;

function transparan(warna: string) {
  return warna === "transparent" || /^rgba\(0,\s*0,\s*0,\s*0\)$/.test(warna);
}

/** Warna latar elemen pertama yang punya latar (warna padat, atau warna pertama dari gradien). */
function latarDari(...elemen: (Element | null | undefined)[]): string | null {
  for (const el of elemen) {
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (!transparan(cs.backgroundColor)) return cs.backgroundColor;
    const m = cs.backgroundImage.match(FUNGSI_WARNA);
    if (m) return m[0];
  }
  return null;
}

function tanpaLatarSendiri(sel: HTMLElement) {
  if (sel.hasAttribute("data-beku-tanpa-latar")) return true;
  const cs = getComputedStyle(sel);
  return transparan(cs.backgroundColor) && cs.backgroundImage === "none";
}

function wadahBergulir(tabel: HTMLElement): HTMLElement | null {
  let el = tabel.parentElement;
  for (let n = 0; el && n < 3; n++, el = el.parentElement) {
    const o = getComputedStyle(el).overflowX;
    if (o === "auto" || o === "scroll") return el;
  }
  return null;
}

function lepasKolom(tabel: HTMLTableElement) {
  tabel.querySelectorAll<HTMLElement>("[data-beku-kolom]").forEach(sel => {
    sel.removeAttribute("data-beku-kolom");
    sel.style.removeProperty("--beku-kiri");
  });
}

function bekukan(tabel: HTMLTableElement) {
  if (tabel.dataset.beku === "tidak" || tabel.closest(".print-doc, .a4-page, [data-beku='tidak']")) return;
  const kepala = tabel.tHead;
  if (!kepala || kepala.rows.length === 0) return;
  if (tabel.dataset.beku !== "1" && tabel.querySelector(":scope > thead[class*='sticky'], :scope > thead th[class*='sticky']")) {
    tabel.dataset.beku = "tidak";
    return;
  }
  const wadah = wadahBergulir(tabel);
  if (!wadah) return;
  tabel.dataset.beku = "1";
  wadah.dataset.bekuWadah = "1";

  // Judul bertingkat (rowSpan/colSpan): tiap baris judul menempel tepat di bawah baris sebelumnya. Sel judul tanpa latar sendiri
  // (latarnya dipasang di <tr>/<thead>) diberi warna itu supaya isi tabel tidak terlihat tembus di belakangnya.
  let atas = 0;
  for (const baris of Array.from(kepala.rows)) {
    baris.style.setProperty("--beku-atas", `${atas}px`);
    atas += baris.getBoundingClientRect().height;
    const latar = latarDari(baris, kepala, tabel);
    if (latar) baris.style.setProperty("--beku-latar", latar); else baris.style.removeProperty("--beku-latar");
    for (const sel of Array.from(baris.cells)) if (tanpaLatarSendiri(sel)) sel.setAttribute("data-beku-tanpa-latar", "");
  }

  const judul = kepala.rows[0];
  const sel0 = judul.cells[0];
  const lebarWadah = wadah.clientWidth;
  if (!sel0 || judul.cells.length < 3 || sel0.colSpan > 1 || (kepala.rows.length > 1 && sel0.rowSpan < kepala.rows.length)
      || tabel.scrollWidth <= lebarWadah + 1) {
    lepasKolom(tabel);
    return;
  }
  const lebar0 = sel0.getBoundingClientRect().width;
  const sel1 = judul.cells[1];
  const duaKolom = judul.cells.length > 3 && !!sel1 && sel1.colSpan === 1 && (kepala.rows.length === 1 || sel1.rowSpan >= kepala.rows.length)
    && (KOLOM_NOMOR.test((sel0.textContent ?? "").trim()) || !!sel0.querySelector("input[type=checkbox]") || lebar0 < 56);
  const lebarBeku = duaKolom ? lebar0 + sel1.getBoundingClientRect().width : lebar0;
  if (lebarBeku > lebarWadah * 0.55) {
    lepasKolom(tabel);
    return;
  }
  const kiri = duaKolom ? [0, lebar0] : [0];

  const tandai = (sel: HTMLTableCellElement, i: number, latarBaris: string | null) => {
    sel.setAttribute("data-beku-kolom", i === kiri.length - 1 ? "akhir" : "1");
    sel.style.setProperty("--beku-kiri", `${kiri[i]}px`);
    if (tanpaLatarSendiri(sel)) {
      sel.setAttribute("data-beku-tanpa-latar", "");
      if (latarBaris) sel.style.setProperty("--beku-latar-sel", latarBaris); else sel.style.removeProperty("--beku-latar-sel");
    }
  };
  kiri.forEach((_, i) => tandai(judul.cells[i], i, null));
  for (const bagian of Array.from(tabel.tBodies).concat(tabel.tFoot ? [tabel.tFoot] : [])) {
    const baris = Array.from(bagian.rows);
    const penuh = Math.max(0, ...baris.map(b => b.cells.length));
    for (const b of baris) {
      // Baris yang selnya berkurang karena rowSpan di atasnya, atau sel pertamanya melebar (judul kelompok), tidak dibekukan.
      if (b.cells.length !== penuh || kiri.some((_, i) => !b.cells[i] || b.cells[i].colSpan > 1)) continue;
      const latarBaris = latarDari(b, bagian);
      kiri.forEach((_, i) => tandai(b.cells[i], i, latarBaris));
    }
  }
}
