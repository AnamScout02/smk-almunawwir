/** Speculation Rules + View Transitions lintas halaman (2 Oktober 2026) — dipasang Navbar, jadi
 *  HANYA berlaku di halaman publik (dashboard tidak memakai Navbar dan tidak ikut).
 *  - Pra-muat: halaman publik tujuan disiapkan saat tautan disentuh/ditunjuk (eagerness "moderate"),
 *    sehingga perpindahan terasa instan. Daftar jalur SENGAJA tertulis tegas: rute yang MENGUBAH data
 *    saat dibuka (QR /hadir, /aset, keluar) tidak boleh ikut dipra-muat. Halaman yang punya penghitung
 *    (detail berita) melewati hitungannya untuk permintaan pra-muat (header Sec-Purpose).
 *  - Transisi: `@view-transition` harus ada di halaman ASAL dan TUJUAN; elemen bernama
 *    `view-transition-name` yang sama di keduanya (logo jurusan, foto berita) "terbang" ke posisi baru.
 *  Peramban yang belum mendukung mengabaikan keduanya tanpa galat. */
const JALUR_PUBLIK = [
  "/", "/about", "/about/*", "/news", "/news/*", "/programs", "/programs/*", "/gallery", "/gallery/*",
  "/admissions", "/agenda", "/agenda/*", "/lomba", "/lomba/*", "/alumni", "/alumni/*", "/extracurricular", "/extracurricular/*",
  "/facilities", "/facilities/*", "/contact",
];

const ATURAN = {
  prerender: [{
    where: { and: [{ href_matches: JALUR_PUBLIK }, { not: { selector_matches: "[data-tanpa-pramuat], [target=_blank]" } }] },
    eagerness: "moderate",
  }],
};

export default function PramuatTransisi() {
  return (
    <>
      <script type="speculationrules" dangerouslySetInnerHTML={{ __html: JSON.stringify(ATURAN) }} />
      <style>{"@view-transition { navigation: auto; }"}</style>
    </>
  );
}
