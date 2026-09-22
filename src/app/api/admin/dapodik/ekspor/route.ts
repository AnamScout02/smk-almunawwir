import { verifyDapodikAccess } from "@/lib/dapodik-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { balasanExcelBanyakSheet, type SelBaris } from "@/lib/ekspor-excel";
import { bandingkanDapodik } from "@/lib/dapodik-sinkron";
import { LABEL_STATUS_SINKRON, type BagianSinkron, type BarisSinkron } from "@/lib/dapodik-jenis";

export const dynamic = "force-dynamic";

const escapeHtml = (x: string) => x.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** Tombol unduh membuka route ini lewat tautan biasa — kalau gagal, tampilkan halaman berpetunjuk, bukan JSON mentah. */
const halamanGalat = (pesan: string, status: number, kembali: string) => new Response(
  `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unduhan belum bisa dibuat</title></head>` +
  `<body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f0f2f7;margin:0;padding:15vh 20px;color:#0F1A45">` +
  `<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px">` +
  `<h1 style="font-size:19px;margin:0 0 10px">Daftar perbaikan Dapodik belum bisa diunduh</h1>` +
  `<p style="color:#4b5563;line-height:1.6;margin:0 0 18px">${escapeHtml(pesan)}</p>` +
  `<a href="${kembali}" style="color:#1B2B6B;font-weight:600;text-decoration:none">&larr; Kembali ke Sinkron Dapodik</a></div></body></html>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
);

const rincian = (b: BarisSinkron) => [
  ...b.beda.map(t => `${t.label}: Dapodik "${t.dapodik}" → data TU "${t.tu}"`),
  ...b.kurangDiDapodik.map(t => `Lengkapi ${t.label}: ${t.nilai}`),
].join("\n");

function lembarDaftar(nama: string, bagian: BagianSinkron, kolomTu: string, kolomDapodik: string) {
  const perlu = bagian.baris.filter(b => b.status !== "sesuai");
  return {
    nama,
    headers: ["No", "Nama (data TU)", "Identitas", kolomTu, kolomDapodik, "Status", "Yang perlu dilakukan di Dapodik",
      "Rincian (data TU = acuan)", "Data TU belum lengkap (dilengkapi TU)", "Dasar pasangan"],
    rows: perlu.map((b, i): SelBaris => [
      i + 1, b.nama, b.identitas, b.tu, b.dapodik, LABEL_STATUS_SINKRON[b.status], b.tindakan, rincian(b),
      b.kurangDiTu.join(", "), b.dasar,
    ]),
  };
}

/** UNDUH DAFTAR PERBAIKAN DAPODIK (.xlsx) — pegangan operator saat menyamakan aplikasi Dapodik dengan data TU.
 * Dibatasi 3 kali per menit (setiap unduhan membaca Dapodik ulang) dan tercatat di Log Aktivitas. */
export async function GET() {
  const { session } = await verifyDapodikAccess();
  // Operator berakun Guru membuka halaman ini dari portal guru.
  const kembali = session.role === "TEACHER" ? "/dashboard/teacher/dapodik" : "/dashboard/admin/dapodik";
  if (!checkRateLimit("dapodik-ekspor", 3, 60_000)) {
    return halamanGalat("Unduhan dibatasi 3 kali per menit — tunggu sebentar lalu coba lagi.", 429, kembali);
  }
  const h = await bandingkanDapodik();
  if (!h.ok) return halamanGalat(`Data Dapodik gagal diambil — ${h.pesan}`, 502, kembali);
  const d = h.data;
  const s = d.siswa.ringkasan, g = d.gtk.ringkasan;

  await logActivity(session, {
    action: "EKSPOR_DAPODIK", entity: "Dapodik", entityId: "ekspor",
    description: `${session.name} mengunduh daftar perbaikan Dapodik (data Dapodik semester ${d.semester})`,
  }).catch(() => {});

  const tanggal = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  return balasanExcelBanyakSheet(`perbaikan-dapodik-${tanggal}`, [
    {
      nama: "Ringkasan",
      headers: ["Keterangan", "Peserta Didik", "GTK"],
      rows: [
        ["Semester data Dapodik", d.semester, d.semester],
        ["Tahun ajaran aktif data TU (acuan)", d.tahunTu ?? "-", d.tahunTu ?? "-"],
        ["Jumlah di Dapodik", s.dapodik, g.dapodik],
        ["Jumlah aktif di data TU", s.tuAktif, g.tuAktif],
        ["Sudah sesuai", s.sesuai, g.sesuai],
        ["Perlu diperbaiki di Dapodik", s.perbaiki, g.perbaiki],
        ["Belum ada di Dapodik", s.belumDiDapodik, g.belumDiDapodik],
        ["Tidak ada di data TU", s.tidakAdaDiTu, g.tidakAdaDiTu],
        ["Sudah lulus/keluar di data TU", s.keluarDiTu, g.keluarDiTu],
        ["Data TU belum lengkap", s.tuBelumLengkap, g.tuBelumLengkap],
      ],
    },
    lembarDaftar("Peserta Didik", d.siswa, "Kelas/Status di TU", "Rombel Dapodik"),
    lembarDaftar("GTK", d.gtk, "Jabatan di TU", "Jenis & Status di Dapodik"),
    {
      nama: "Kelas TU vs Rombel",
      headers: ["Kelas (data TU)", "Siswa aktif", "Tercatat di rombel Dapodik"],
      rows: d.rombel.kelasTu.map(k => [k.nama, k.siswaAktif, k.sebaran.map(x => `${x.label}: ${x.jumlah}`).join("; ")]),
    },
  ]);
}
