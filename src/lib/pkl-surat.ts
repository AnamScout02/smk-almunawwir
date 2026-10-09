/** SURAT PKL (9 Okt 2026) — isi badan surat disusun dari DATA PKL (DUDI, daftar siswa, tanggal), netral.
 *  Kalimatnya mengikuti template arsip sekolah (PMH_PKL & PENGANTAR di src/lib/template-surat.ts) supaya tidak
 *  terasa beda dari surat yang selama ini dibuat TU. Suratnya masuk buku agenda TU sebagai `Surat` biasa:
 *  nomor dari `nomorSuratBerikutnya`, dan TU tetap bisa menyunting kalimatnya di Persuratan. */

export const JENIS_SURAT_PKL = {
  PERMOHONAN: { label: "Permohonan tempat PKL", klasifikasi: "B.1", perihal: "Permohonan Tempat Praktik Kerja Lapangan (PKL)" },
  PENGANTAR: { label: "Pengantar / penyerahan siswa PKL", klasifikasi: "B.12", perihal: "Pengantar Siswa Praktik Kerja Lapangan (PKL)" },
  PENARIKAN: { label: "Penarikan siswa PKL & ucapan terima kasih", klasifikasi: "B.12", perihal: "Penarikan Siswa Praktik Kerja Lapangan (PKL)" },
  TUGAS: { label: "Surat tugas guru (+ SPPD)", klasifikasi: "B.5", perihal: "Surat Tugas" },
} as const;
export type JenisSuratPkl = keyof typeof JENIS_SURAT_PKL;

export const KEPERLUAN_TUGAS: Record<string, string> = {
  PENGANTARAN: "Mengantar dan menyerahkan siswa Praktik Kerja Lapangan (PKL)",
  MONITORING: "Monitoring siswa Praktik Kerja Lapangan (PKL)",
  PENJEMPUTAN: "Menjemput (penarikan) siswa Praktik Kerja Lapangan (PKL)",
};

export type SiswaSurat = { nama: string; nis: string; kelas: string | null; jurusan: string; jk: string | null };

const aman = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tgl = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const lp = (jk: string | null) => (!jk ? "" : /^p/i.test(jk) ? "P" : "L");

const SALAM = `<p>Assalamu'alaikum Warahmatullahi Wabarakatuh.</p>`;
const TUTUP = `<p>Wassalamu'alaikum Warahmatullahi Wabarakatuh.</p>`;

function tabelSiswa(siswa: SiswaSurat[]) {
  return `<table><tbody>
<tr><td><strong>No</strong></td><td><strong>Nama</strong></td><td><strong>NIS</strong></td><td><strong>Kelas</strong></td><td><strong>Kompetensi Keahlian</strong></td><td><strong>L/P</strong></td></tr>
${siswa.map((s, i) => `<tr><td>${i + 1}</td><td>${aman(s.nama)}</td><td>${aman(s.nis)}</td><td>${aman(s.kelas ?? "")}</td><td>${aman(s.jurusan)}</td><td>${lp(s.jk)}</td></tr>`).join("\n")}
</tbody></table>`;
}

/** Lama pelaksanaan dalam kata: "3 (tiga) bulan" bila diketahui, selain itu rentang tanggalnya saja. */
function lama(bulan: number | null) {
  const kata = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas", "dua belas"];
  return bulan && kata[bulan] ? `${bulan} (${kata[bulan]}) bulan` : "";
}

export function isiSuratPkl(jenis: Exclude<JenisSuratPkl, "TUGAS">, o: { sekolah: string; dudi: string; siswa: SiswaSurat[]; mulai: string; selesai: string; lamaBulan: number | null; guru?: string | null }): string {
  const rentang = `${tgl(o.mulai)} s.d. ${tgl(o.selesai)}`;
  const selama = lama(o.lamaBulan);
  if (jenis === "PERMOHONAN") return `${SALAM}
<p style="text-align:justify">Disampaikan dengan hormat, berkenaan dengan program ${aman(o.sekolah)} tentang pelatihan siswa di luar sekolah yakni Praktik Kerja Lapangan (PKL), dengan tujuan melatih siswa-siswi kami mengenal dunia kerja nyata agar menjadi pribadi yang lebih kreatif dan produktif.</p>
<p style="text-align:justify">Maka kami mohon kerja samanya agar siswa-siswi kami dapat melaksanakan PKL di ${aman(o.dudi)} yang Bapak/Ibu pimpin${selama ? ` selama <strong>${selama}</strong>` : ""}, terhitung ${rentang}. Berikut kami sertakan nama-nama peserta PKL:</p>
${tabelSiswa(o.siswa)}
<p style="text-align:justify">Demikian surat ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu pimpinan, kami ucapkan terima kasih.</p>${TUTUP}`;
  if (jenis === "PENGANTAR") return `${SALAM}
<p style="text-align:justify">Menindaklanjuti kesediaan Bapak/Ibu menerima siswa-siswi kami melaksanakan Praktik Kerja Lapangan (PKL) di ${aman(o.dudi)}, bersama surat ini kami serahkan siswa-siswi berikut untuk melaksanakan PKL${selama ? ` selama <strong>${selama}</strong>` : ""}, terhitung ${rentang}:</p>
${tabelSiswa(o.siswa)}
<p style="text-align:justify">Selama pelaksanaan PKL, siswa-siswi tersebut wajib mematuhi tata tertib yang berlaku di tempat Bapak/Ibu.${o.guru ? ` Guru pembimbing dari sekolah adalah <strong>${aman(o.guru)}</strong>, yang akan melakukan monitoring secara berkala.` : ""} Kami mohon bimbingan dan arahan Bapak/Ibu agar siswa-siswi kami memperoleh pengalaman kerja yang bermanfaat.</p>
<p style="text-align:justify">Demikian surat ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu pimpinan, kami ucapkan terima kasih.</p>${TUTUP}`;
  return `${SALAM}
<p style="text-align:justify">Sehubungan dengan berakhirnya masa Praktik Kerja Lapangan (PKL) siswa-siswi ${aman(o.sekolah)} di ${aman(o.dudi)} pada ${tgl(o.selesai)}, bersama surat ini kami menarik kembali siswa-siswi berikut:</p>
${tabelSiswa(o.siswa)}
<p style="text-align:justify">Kami mengucapkan terima kasih yang sebesar-besarnya atas kesempatan, bimbingan, dan ilmu yang telah Bapak/Ibu berikan. Apabila selama PKL terdapat sikap dan tutur kata siswa-siswi kami yang kurang berkenan, kami mohon maaf. Besar harapan kami kerja sama ini dapat terus berlanjut pada tahun-tahun berikutnya.</p>
<p style="text-align:justify">Demikian surat ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu pimpinan, kami ucapkan terima kasih.</p>${TUTUP}`;
}
