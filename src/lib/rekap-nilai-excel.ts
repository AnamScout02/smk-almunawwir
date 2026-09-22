import "server-only";
import type { Worksheet, Cell } from "exceljs";
import { legerKelas, rekapMapel, ringkasanKelasMapel, semuaMapel, LABEL_STATUS_NILAI, type DataRekap, type SelNilai } from "@/lib/rekap-nilai-hitung";
import { keteranganSingkatan, labelMapel } from "@/lib/singkatan-mapel";

/** EXCEL REKAP NILAI UJIAN (21 September 2026) — "download excel-nya dengan kolom yang sudah dipercantik" (permintaan
 * user). exceljs, bukan xlsx: SheetJS edisi komunitas tidak bisa menulis gaya sel. Angka tetap bertipe number supaya
 * bisa dihitung di Excel; penanda nilai sementara/susulan/remedial lewat warna & catatan sel, bukan teks. */

const HURUF = "Arial Narrow";
const EMAS = "FFB87D0E"; // kepala kolom mapel Diniyah (tambahan)
const NAVY = "FF1B2B6B", MERAH = "FFDC2626", MERAH_MUDA = "FFFEF2F2", KUNING = "FFFFF7E6", ABU = "FFF5F6FA", ZEBRA = "FFFAFBFD";
const garis = { style: "thin" as const, color: { argb: "FF9AA3BF" } };
const kotak = { top: garis, left: garis, bottom: garis, right: garis };
const isi = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });

export type ModeRekap = "kelas" | "mapel" | "ringkasan";

function namaSheet(n: string, dipakai: Set<string>) {
  let s = n.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Rekap";
  for (let i = 2; dipakai.has(s); i++) s = `${s.slice(0, 28)} ${i}`;
  dipakai.add(s);
  return s;
}

/** Tiga baris kop di atas tabel, digabung selebar tabel. Mengembalikan nomor baris kepala tabel. */
function kop(ws: Worksheet, lebar: number, baris: string[]) {
  baris.forEach((t, i) => {
    ws.mergeCells(i + 1, 1, i + 1, lebar);
    const c = ws.getCell(i + 1, 1);
    c.value = t;
    c.font = { name: HURUF, bold: i < 2, size: i === 0 ? 13 : i === 1 ? 12 : 10, color: { argb: "FF0F1A45" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  return baris.length + 2;
}

function kepala(ws: Worksheet, r: number, judul: string[], tinggi = 32) {
  judul.forEach((t, i) => {
    const c = ws.getCell(r, i + 1);
    c.value = t;
    c.font = { name: HURUF, bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    c.fill = isi(NAVY);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = kotak;
  });
  ws.getRow(r).height = tinggi;
}

function selBiasa(c: Cell, v: string | number | null, o: { tengah?: boolean; tebal?: boolean; latar?: string } = {}) {
  c.value = v === null ? "—" : v === "" ? null : v; // null = belum ada nilai ("—"), "" = sel pengisi (kosong)
  c.font = { name: HURUF, size: 10, bold: o.tebal, color: { argb: v === null ? "FF9CA3AF" : "FF1F2937" } };
  c.alignment = { horizontal: o.tengah || v === null ? "center" : "left", vertical: "middle" };
  c.border = kotak;
  if (o.latar) c.fill = isi(o.latar);
}

/** Sel nilai: merah bila di bawah KKM, kuning miring bila sementara, catatan untuk susulan/remedial. */
function selNilai(c: Cell, sel: SelNilai | undefined, kkm: number, latar?: string) {
  const n = sel?.n ?? null;
  selBiasa(c, n, { tengah: true, latar });
  if (n === null) return;
  const bawah = n < kkm;
  c.font = { name: HURUF, size: 10, italic: !!sel?.s, bold: bawah, color: { argb: bawah ? MERAH : "FF1F2937" } };
  if (sel?.s) c.fill = isi(KUNING); else if (bawah) c.fill = isi(MERAH_MUDA);
  const catatan = [sel?.s ? "Sementara: masih ada uraian yang belum dikoreksi" : "", sel?.su ? "Nilai ujian susulan" : "", sel?.r != null ? `Remedial: ${sel.r}` : ""].filter(Boolean);
  if (catatan.length) c.note = catatan.join("\n");
}

function aturCetak(ws: Worksheet, barisKepala: number) {
  ws.pageSetup = {
    paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    printTitlesRow: `${barisKepala}:${barisKepala}`,
  };
}

function keterangan(ws: Worksheet, r: number, lebar: number, singkatan = "") {
  ws.mergeCells(r, 1, r, lebar);
  const c = ws.getCell(r, 1);
  c.value = "Keterangan: merah = di bawah KKM · kuning miring = nilai sementara (uraian belum dikoreksi) · — = belum ikut ujian · kepala emas = mapel Diniyah (tambahan, tidak ikut jumlah/rata-rata/peringkat) · arahkan kursor ke sel bertanda untuk catatan susulan/remedial."
    + (singkatan ? `\nSingkatan: ${singkatan}.` : "");
  c.font = { name: HURUF, size: 9, italic: true, color: { argb: "FF6B7280" } };
  c.alignment = { wrapText: true, vertical: "top" };
  ws.getRow(r).height = 28 + (singkatan ? 14 * Math.ceil(singkatan.length / 160) : 0);
}

function sheetLeger(ws: Worksheet, d: DataRekap, classId: string, sekolah: string) {
  const L = legerKelas(d, classId);
  // Mapel DINIYAH (tambahan) di kanan Peringkat — tidak ikut jumlah/rata-rata/peringkat (keputusan user 21 Sep 2026).
  const judul = ["No", "NIS", "Nama Siswa", ...L.mapel.map(m => labelMapel(m, d.singkatan)), "Jumlah", "Rata-rata", "Peringkat", ...L.mapelDiniyah.map(m => `${labelMapel(m, d.singkatan)} (Diniyah)`)];
  const r0 = kop(ws, judul.length, [sekolah, `LEGER NILAI ${d.kegiatan.nama.toUpperCase()}${d.kegiatan.tahunAjaran ? ` — ${d.kegiatan.tahunAjaran}` : ""}`, `Kelas ${L.kelas?.nama ?? ""} · ${L.baris.length} siswa`]);
  kepala(ws, r0, judul, 48);
  const kolomDiniyah = 7 + L.mapel.length; // kolom pertama mapel Diniyah (1-based)
  L.mapelDiniyah.forEach((_, j) => { ws.getCell(r0, kolomDiniyah + j).fill = isi(EMAS); });
  ws.columns = judul.map((_, i) => ({ width: i === 0 ? 5 : i === 1 ? 11 : i === 2 ? 30 : i >= 3 + L.mapel.length && i < 6 + L.mapel.length ? 10 : 9 }));
  L.baris.forEach((b, i) => {
    const r = r0 + 1 + i, latar = i % 2 ? ZEBRA : undefined;
    selBiasa(ws.getCell(r, 1), i + 1, { tengah: true, latar });
    selBiasa(ws.getCell(r, 2), b.siswa.nis, { tengah: true, latar });
    selBiasa(ws.getCell(r, 3), b.siswa.nama, { latar });
    L.mapel.forEach((m, j) => selNilai(ws.getCell(r, 4 + j), b.sel[j], L.kkm[m] ?? 75, latar));
    const k = 4 + L.mapel.length;
    selBiasa(ws.getCell(r, k), b.jumlah, { tengah: true, latar });
    selBiasa(ws.getCell(r, k + 1), b.rata, { tengah: true, tebal: true, latar });
    selBiasa(ws.getCell(r, k + 2), b.peringkat, { tengah: true, latar });
    L.mapelDiniyah.forEach((m, j) => selNilai(ws.getCell(r, kolomDiniyah + j), b.selDiniyah[j], L.kkm[m] ?? 75, latar));
  });
  const rKaki = r0 + 1 + L.baris.length;
  const kaki: [string, (p: (typeof L.perMapel)[number]) => number | string | null][] = [
    ["KKM", p => p.kkm], ["Rata-rata", p => p.rata], ["Tertinggi", p => p.maks], ["Terendah", p => p.min],
    ["Tuntas", p => `${p.tuntas}/${p.ikut}`], ["Belum ikut", p => p.total - p.ikut],
  ];
  kaki.forEach(([label, f], i) => {
    const r = rKaki + i;
    ws.mergeCells(r, 1, r, 3);
    selBiasa(ws.getCell(r, 1), label, { tebal: true, latar: ABU });
    ws.getCell(r, 1).alignment = { horizontal: "right", vertical: "middle" };
    L.perMapel.forEach((p, j) => selBiasa(ws.getCell(r, 4 + j), f(p), { tengah: true, tebal: true, latar: ABU }));
    for (let k = 4 + L.mapel.length; k < 7 + L.mapel.length; k++) selBiasa(ws.getCell(r, k), "", { latar: ABU });
    L.perMapelDiniyah.forEach((p, j) => selBiasa(ws.getCell(r, kolomDiniyah + j), f(p), { tengah: true, tebal: true, latar: ABU }));
  });
  keterangan(ws, rKaki + kaki.length + 1, judul.length, keteranganSingkatan([...L.mapel, ...L.mapelDiniyah], d.singkatan));
  ws.views = [{ state: "frozen", xSplit: 3, ySplit: r0 }];
  aturCetak(ws, r0);
}

function sheetMapel(ws: Worksheet, d: DataRekap, mapel: string, sekolah: string) {
  const R = rekapMapel(d, mapel);
  const judul = ["No", "NIS", "Nama Siswa", "Kelas", "Nilai", "Remedial", "KKM", "Status"];
  const r0 = kop(ws, judul.length, [sekolah, `REKAP NILAI ${d.kegiatan.nama.toUpperCase()}${d.kegiatan.tahunAjaran ? ` — ${d.kegiatan.tahunAjaran}` : ""}`, `Mata pelajaran ${mapel} · ${R.grup.length} kelas`]);
  kepala(ws, r0, judul);
  ws.columns = [{ width: 5 }, { width: 11 }, { width: 30 }, { width: 14 }, { width: 9 }, { width: 10 }, { width: 7 }, { width: 18 }];
  let r = r0 + 1, no = 0;
  for (const g of R.grup) {
    for (const b of g.baris) {
      const latar = no % 2 ? ZEBRA : undefined;
      selBiasa(ws.getCell(r, 1), ++no, { tengah: true, latar });
      selBiasa(ws.getCell(r, 2), b.siswa.nis, { tengah: true, latar });
      selBiasa(ws.getCell(r, 3), b.siswa.nama, { latar });
      selBiasa(ws.getCell(r, 4), g.kelas.nama, { tengah: true, latar });
      selNilai(ws.getCell(r, 5), b.sel, g.kkm, latar);
      selBiasa(ws.getCell(r, 6), b.sel.r ?? null, { tengah: true, latar });
      selBiasa(ws.getCell(r, 7), g.kkm, { tengah: true, latar });
      selBiasa(ws.getCell(r, 8), LABEL_STATUS_NILAI[b.status], { tengah: true, latar });
      const warna = b.status === "BELUM_TUNTAS" ? MERAH : b.status === "BELUM_IKUT" ? "FF9CA3AF" : "FF047857";
      ws.getCell(r, 8).font = { name: HURUF, size: 10, bold: true, color: { argb: warna } };
      r++;
    }
  }
  // Ringkasan per kelas di bawah daftar.
  r += 1;
  const judul2 = ["Kelas", "Siswa", "Ikut", "Rata-rata", "Tertinggi", "Terendah", "Tuntas", "Belum tuntas"];
  ws.mergeCells(r, 1, r, judul2.length);
  selBiasa(ws.getCell(r, 1), `Ringkasan per kelas — ${mapel}`, { tebal: true });
  r++;
  kepala(ws, r, judul2, 22);
  for (const g of R.grup) {
    r++;
    const n = g.ringkas;
    [g.kelas.nama, n.total, n.ikut, n.rata, n.maks, n.min, n.tuntas + n.tuntasRemedial, n.belumTuntas]
      .forEach((v, i) => selBiasa(ws.getCell(r, i + 1), v as string | number | null, { tengah: i > 0 }));
  }
  keterangan(ws, r + 2, judul.length);
  ws.views = [{ state: "frozen", xSplit: 3, ySplit: r0 }];
  aturCetak(ws, r0);
}

function sheetRingkasan(ws: Worksheet, d: DataRekap, sekolah: string) {
  const S = ringkasanKelasMapel(d);
  const judul = ["Kelas", "Jurusan", "Siswa", ...S.mapel.map((m, i) => (S.diniyah[i] ? `${labelMapel(m, d.singkatan)} (Diniyah)` : labelMapel(m, d.singkatan))), S.diniyah.some(Boolean) ? "Rata-rata Kelas (tanpa Diniyah)" : "Rata-rata Kelas"];
  const r0 = kop(ws, judul.length, [sekolah, `RINGKASAN NILAI ${d.kegiatan.nama.toUpperCase()}${d.kegiatan.tahunAjaran ? ` — ${d.kegiatan.tahunAjaran}` : ""}`, "Rata-rata nilai per kelas & mata pelajaran (kolom bawah: persentase tuntas)"]);
  kepala(ws, r0, judul, 48);
  S.diniyah.forEach((dn, i) => { if (dn) ws.getCell(r0, 4 + i).fill = isi(EMAS); });
  ws.columns = judul.map((_, i) => ({ width: i === 0 ? 14 : i === 1 ? 9 : i === 2 ? 7 : 10 }));
  S.baris.forEach((b, i) => {
    const r = r0 + 1 + i, latar = i % 2 ? ZEBRA : undefined;
    selBiasa(ws.getCell(r, 1), b.kelas.nama, { latar });
    selBiasa(ws.getCell(r, 2), b.kelas.jurusan, { tengah: true, latar });
    selBiasa(ws.getCell(r, 3), b.jumlahSiswa, { tengah: true, latar });
    b.sel.forEach((x, j) => selBiasa(ws.getCell(r, 4 + j), x ? x.rata : "", { tengah: true, latar: x ? latar : ABU }));
    selBiasa(ws.getCell(r, 4 + S.mapel.length), b.rataKelas, { tengah: true, tebal: true, latar });
  });
  const rRata = r0 + 1 + S.baris.length;
  ws.mergeCells(rRata, 1, rRata, 3);
  selBiasa(ws.getCell(rRata, 1), "Rata-rata mapel", { tebal: true, latar: ABU });
  S.perMapel.forEach((v, j) => selBiasa(ws.getCell(rRata, 4 + j), v, { tengah: true, tebal: true, latar: ABU }));
  selBiasa(ws.getCell(rRata, 4 + S.mapel.length), "", { latar: ABU });
  // Blok kedua: persentase tuntas.
  const r1 = rRata + 2;
  kepala(ws, r1, ["Kelas", "Jurusan", "Siswa", ...S.mapel.map(m => `% Tuntas ${labelMapel(m, d.singkatan)}`), ""], 48);
  S.baris.forEach((b, i) => {
    const r = r1 + 1 + i, latar = i % 2 ? ZEBRA : undefined;
    selBiasa(ws.getCell(r, 1), b.kelas.nama, { latar });
    selBiasa(ws.getCell(r, 2), b.kelas.jurusan, { tengah: true, latar });
    selBiasa(ws.getCell(r, 3), b.jumlahSiswa, { tengah: true, latar });
    b.sel.forEach((x, j) => {
      const c = ws.getCell(r, 4 + j);
      selBiasa(c, x ? x.persenTuntas : "", { tengah: true, latar: x ? latar : ABU });
      if (x?.persenTuntas != null && x.persenTuntas < 75) c.font = { name: HURUF, size: 10, bold: true, color: { argb: MERAH } };
    });
    selBiasa(ws.getCell(r, 4 + S.mapel.length), "", { latar });
  });
  const teksSingkatan = keteranganSingkatan(S.mapel, d.singkatan);
  if (teksSingkatan) {
    const rk = r1 + S.baris.length + 2;
    ws.mergeCells(rk, 1, rk, judul.length);
    const c = ws.getCell(rk, 1);
    c.value = `Singkatan: ${teksSingkatan}.`;
    c.font = { name: HURUF, size: 9, italic: true, color: { argb: "FF6B7280" } };
    c.alignment = { wrapText: true, vertical: "top" };
    ws.getRow(rk).height = 14 * Math.ceil(teksSingkatan.length / 160) + 4;
  }
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: r0 }];
  aturCetak(ws, r0);
}

export async function bukuRekapNilai(d: DataRekap, o: { mode: ModeRekap; kelasId?: string; mapel?: string; sekolah: string }): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = `${o.sekolah} - Pusat Ujian`;
  const dipakai = new Set<string>();
  if (o.mode === "kelas") {
    const kelas = o.kelasId && o.kelasId !== "semua" ? d.kelas.filter(k => k.id === o.kelasId) : d.kelas;
    for (const k of kelas) sheetLeger(wb.addWorksheet(namaSheet(k.nama, dipakai)), d, k.id, o.sekolah);
  } else if (o.mode === "mapel") {
    const mapel = o.mapel && o.mapel !== "semua" ? [o.mapel] : semuaMapel(d);
    for (const m of mapel) sheetMapel(wb.addWorksheet(namaSheet(m, dipakai)), d, m, o.sekolah);
  } else {
    sheetRingkasan(wb.addWorksheet(namaSheet("Ringkasan", dipakai)), d, o.sekolah);
  }
  if (!wb.worksheets.length) wb.addWorksheet("Kosong").getCell(1, 1).value = "Belum ada data nilai.";
  return Buffer.from(await wb.xlsx.writeBuffer());
}
