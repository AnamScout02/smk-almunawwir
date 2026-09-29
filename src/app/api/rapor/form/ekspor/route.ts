import { NextRequest } from "next/server";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { semesterRapor } from "@/lib/rapor-verifikasi";
import { aksesForm, muatForm } from "@/lib/rapor-form-server";
import { hitungSiswa } from "@/lib/rapor-form";
import { balasanExcelBanyakSheet, type SelBaris } from "@/lib/ekspor-excel";
import { adalahKategoriDiniyah } from "@/lib/mapel-diniyah";

export const dynamic = "force-dynamic";

/**
 * UNDUH FORM NILAI RAPOR SEBAGAI EXCEL (permintaan user 29 September 2026: "bagian form isi nilai
 * kali bisa download juga excel").
 *
 * Satu sheet per tab layar supaya guru melihat susunan yang sama persis, plus sheet "Keterangan"
 * berisi teks TP/LM, bobot, dan KKM — tanpa itu kepala kolom "TP-1"/"LM-2" tidak berarti apa-apa di
 * berkas yang dibuka terpisah dari aplikasi.
 *
 * Angka dikirim sebagai NUMBER (bukan string) supaya langsung bisa dijumlah/dirata-rata di Excel —
 * lihat CLAUDE.md "Export data → Excel".
 */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const sp = new URL(req.url).searchParams;
    const classId = sp.get("classId") ?? "";
    const subject = sp.get("subject") ?? "";
    const semester = sp.get("semester") ?? "";
    if (!semesterRapor().includes(semester)) {
      return Response.json({ error: "Semester tidak dikenal." }, { status: 400 });
    }
    // Hak akses PERSIS sama dengan membuka formnya di layar — jangan dilonggarkan hanya karena ini unduhan.
    const akses = await aksesForm(session, classId, subject);
    if (!akses) return Response.json({ error: "Anda tidak berhak membuka form ini." }, { status: 403 });
    const data = await muatForm(classId, subject, semester);
    if (!data) return Response.json({ error: "Kelas tidak ditemukan." }, { status: 404 });

    const { pengaturan, siswa, nilai, kelas, mapel } = data;
    const tp = pengaturan.tp.filter(t => t.teks.trim());
    const lm = pengaturan.lm.filter(l => l.teks.trim());
    const diniyah = adalahKategoriDiniyah(mapel.kategori);
    const identitas = (s: { nis: string }, i: number): SelBaris => [i + 1, "", s.nis];
    const nama = (s: { nama: string }) => s.nama;

    const sheets: { nama: string; headers: string[]; rows: SelBaris[] }[] = [];

    if (diniyah) {
      sheets.push({
        nama: "Nilai Diniyah",
        headers: ["No", "Nama", "NIS", "Pengetahuan", "Penerapan", "Jumlah"],
        rows: siswa.map((s, i) => {
          const n = nilai[s.id] ?? {};
          const jml = (n.pengetahuan ?? 0) + (n.penerapan ?? 0);
          return [i + 1, nama(s), s.nis, n.pengetahuan ?? null, n.penerapan ?? null, jml || null];
        }),
      });
    } else {
      sheets.push({
        nama: "Sumatif LM",
        headers: ["No", "Nama", "NIS", ...lm.flatMap(l => [`${l.kode} Tes`, `${l.kode} Non Tes`]), "RPH"],
        rows: siswa.map((s, i) => {
          const n = nilai[s.id] ?? {};
          const h = hitungSiswa(pengaturan, n, s.nama);
          return [i + 1, nama(s), s.nis,
            ...lm.flatMap(l => [n.lm?.[l.kode]?.tes ?? null, n.lm?.[l.kode]?.nonTes ?? null]),
            h.rph ?? null];
        }),
      });
      sheets.push({
        nama: "Formatif TP",
        headers: ["No", "Nama", "NIS", ...tp.flatMap(t => [`${t.kode} KKTP`, `${t.kode} Tampil`])],
        rows: siswa.map((s, i) => {
          const n = nilai[s.id] ?? {};
          return [i + 1, nama(s), s.nis,
            ...tp.flatMap(t => [n.tp?.[t.kode]?.kktp ?? null, n.tp?.[t.kode]?.tampil ?? null])];
        }),
      });
      sheets.push({
        nama: "STS & SAS",
        headers: ["No", "Nama", "NIS", "STS", "SAS Tes", "SAS Non Tes"],
        rows: siswa.map((s, i) => {
          const n = nilai[s.id] ?? {};
          return [i + 1, nama(s), s.nis, n.sts ?? null, n.sasTes ?? null, n.sasNonTes ?? null];
        }),
      });
      sheets.push({
        nama: "Hasil & Deskripsi",
        headers: ["No", "Nama", "NIS", "RPH", "STS", "SAS", "HPA", "HPA Asli", "Predikat", "Deskripsi Formatif", "Deskripsi Sumatif"],
        rows: siswa.map((s, i) => {
          const n = nilai[s.id] ?? {};
          const h = hitungSiswa(pengaturan, n, s.nama);
          return [i + 1, nama(s), s.nis, h.rph ?? null, n.sts ?? null, n.sasTes ?? null,
            h.hpa ?? null, pengaturan.katrol ? h.hpaAsli ?? null : null, h.predikat ?? null,
            h.deskFormatif || null, h.deskSumatif || null];
        }),
      });
    }

    const b = pengaturan.bobot;
    sheets.push({
      nama: "Keterangan",
      headers: ["Bagian", "Kode", "Keterangan"],
      rows: [
        ["Identitas", "Kelas", kelas.nama],
        ["Identitas", "Mata Pelajaran", mapel.nama],
        ["Identitas", "Semester", semester],
        ["Identitas", "Guru", data.guru ?? "—"],
        ["Identitas", "Wali Kelas", kelas.wali ?? "—"],
        ["Identitas", "Status Form", data.status],
        ["Bobot", "RPH", b.rph], ["Bobot", "STS", b.sts],
        ["Bobot", "SAS Tes", b.sasTes], ["Bobot", "SAS Non Tes", b.sasNonTes],
        ["Nilai", "KKM", pengaturan.kkm],
        ["Nilai", "Katrol", pengaturan.katrol ? "Ya" : "Tidak"],
        ...lm.map(l => ["Lingkup Materi (LM)", l.kode, l.teks] as SelBaris),
        ...tp.map(t => ["Tujuan Pembelajaran (TP)", t.kode, t.teks] as SelBaris),
        ["Catatan", "Formatif", "1 = memenuhi KKTP / ditampilkan, 0 = tidak, kosong = belum dinilai."],
      ],
    });

    const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return balasanExcelBanyakSheet(`form-nilai-${slug(kelas.nama)}-${slug(mapel.nama)}-${slug(semester)}`, sheets);
  } catch (e) {
    lemparBilaPengalihan(e);
    console.error("[rapor form ekspor]", e);
    return Response.json({ error: "Gagal menyusun berkas Excel." }, { status: 500 });
  }
}
