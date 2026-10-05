import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras, daftarRuang } from "@/lib/sarpras-akses";
import { daftarLayar, kandidatPerangkat, mungkinMacAcak } from "@/lib/layar-server";
import { statusLayar } from "@/lib/layar-adb";
import { randomBytes } from "node:crypto";
import { logActivity } from "@/lib/activity-log";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Papan & TV — daftar layar sekolah beserta statusnya dari router (24 September 2026). */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.masuk) return Response.json({ error: "Khusus pengelola sarana prasarana." }, { status: 403 });

    const [{ baris, routerOk }, kandidat, ruang, kelas] = await Promise.all([
      daftarLayar(),
      akses.kelola ? kandidatPerangkat() : Promise.resolve([]),
      daftarRuang().catch(() => [] as string[]),
      prisma.class.findMany({ orderBy: [{ grade: "asc" }, { name: "asc" }], select: { id: true, name: true } }).catch(() => []),
    ]);
    // Status layar hanya untuk TV yang terlihat hidup di jaringan — sekaligus, masing-masing dibatasi ±6 detik.
    const layar = await Promise.all(baris.map(b => (b.status !== "OFFLINE" && b.ip ? statusLayar(b.ip).catch(() => null) : Promise.resolve(null))));
    return Response.json({ baris: baris.map((b, i) => ({ ...b, layar: layar[i] })), routerOk, kandidat, ruang, kelas, bolehKelola: akses.kelola });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal memuat daftar layar." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.kelola) return Response.json({ error: "Tidak berhak menambah layar." }, { status: 403 });

    const b = await req.json().catch(() => ({})) as { nama?: string; ruang?: string; mac?: string; catatan?: string };
    const nama = (b.nama ?? "").trim();
    const ruang = (b.ruang ?? "").trim();
    const mac = (b.mac ?? "").trim().toUpperCase();
    if (!nama || !ruang) return Response.json({ error: "Nama dan ruang wajib diisi." }, { status: 400 });
    if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) return Response.json({ error: "MAC tidak sah (contoh: 2C:1B:3A:71:9E:9E)." }, { status: 400 });
    if (await prisma.layar.findUnique({ where: { mac }, select: { id: true } })) {
      return Response.json({ error: "Perangkat dengan MAC itu sudah terdaftar." }, { status: 409 });
    }

    const layar = await prisma.layar.create({ data: { nama, ruang, mac, catatan: b.catatan?.trim() || null } });
    await logActivity(session, { action: "TAMBAH_LAYAR", entity: "Layar", entityId: layar.id, description: `Mendaftarkan layar "${nama}" di ${ruang}` });
    // Peringatan, bukan penolakan: MAC acak tetap boleh didaftarkan supaya petugas tidak terhalang di lapangan.
    return Response.json({ ok: true, id: layar.id, macAcak: mungkinMacAcak(mac) });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menambah layar." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.kelola) return Response.json({ error: "Tidak berhak mengubah layar." }, { status: 403 });

    const b = await req.json().catch(() => ({})) as { id?: string; nama?: string; ruang?: string; aktif?: boolean; catatan?: string; jadwalMati?: string; jadwalNyala?: string; kelasId?: string; buatToken?: boolean; papanJudul?: string; papanIsi?: string; papanOtomatis?: boolean; papanQr?: string; papanJenis?: string; papanGiliran?: number; volumeBel?: number | string | null; papanCara?: string; ipTetap?: string };
    if (!b.id) return Response.json({ error: "Layar tidak dikenal." }, { status: 400 });
    const lama = await prisma.layar.findUnique({ where: { id: b.id } });
    if (!lama) return Response.json({ error: "Layar tidak ditemukan." }, { status: 404 });

    const layar = await prisma.layar.update({
      where: { id: b.id },
      data: {
        nama: b.nama?.trim() || lama.nama,
        ruang: b.ruang?.trim() || lama.ruang,
        aktif: typeof b.aktif === "boolean" ? b.aktif : lama.aktif,
        catatan: b.catatan === undefined ? lama.catatan : (b.catatan.trim() || null),
        // Hanya IPv4 yang diterima; kosong = biarkan sistem memilih alamat yang menjawab (aman dari IP berpindah).
        ipTetap: b.ipTetap === undefined ? lama.ipTetap
          : (/^\d{1,3}(\.\d{1,3}){3}$/.test(b.ipTetap.trim()) ? b.ipTetap.trim() : null),
        // "HH:MM" atau kosong. Jadwal hanya MEMATIKAN — menyalakan tidak mungkin lewat WiFi (layar-jadwal.ts).
        jadwalMati: b.jadwalMati === undefined ? lama.jadwalMati : (/^\d{1,2}:\d{2}$/.test(b.jadwalMati.trim()) ? b.jadwalMati.trim() : null),
        jadwalNyala: b.jadwalNyala === undefined ? lama.jadwalNyala : (/^\d{1,2}:\d{2}$/.test(b.jadwalNyala.trim()) ? b.jadwalNyala.trim() : null),
        kelasId: b.kelasId === undefined ? lama.kelasId : (b.kelasId || null),
        // Pengumuman yang diketik kantor — begitu terisi, papan mengganti jam besar dengan pengumuman ini.
        papanJudul: b.papanJudul === undefined ? lama.papanJudul : (b.papanJudul.trim() || null),
        papanIsi: b.papanIsi === undefined ? lama.papanIsi : (b.papanIsi.trim() || null),
        papanCara: ["TEKS_SUARA", "TEKS", "SUARA"].includes(b.papanCara ?? "") ? b.papanCara! : lama.papanCara,
        papanOtomatis: typeof b.papanOtomatis === "boolean" ? b.papanOtomatis : lama.papanOtomatis,
        papanQr: ["MATI", "JAM_PRESENSI", "SELALU"].includes(b.papanQr ?? "") ? b.papanQr! : lama.papanQr,
        // GURU = papan ruang guru/ruang rapat (panel bergilir, memuat NAMA guru yang belum mengisi). Karena itu
        // jenisnya dipilih petugas per layar dan tidak pernah ditebak dari nama ruang.
        papanJenis: ["UMUM", "GURU"].includes(b.papanJenis ?? "") ? b.papanJenis! : lama.papanJenis,
        // Giliran panel 15–600 detik. Di bawah 15 detik papan tidak terbaca; di atas 10 menit orang menganggapnya macet.
        papanGiliran: typeof b.papanGiliran === "number" && b.papanGiliran >= 15 && b.papanGiliran <= 600
          ? Math.round(b.papanGiliran) : lama.papanGiliran,
        // Kosong = volume TV tidak pernah disentuh saat bel. Nilai di luar 0–100 diabaikan, bukan dijepit diam-diam.
        volumeBel: b.volumeBel === undefined ? lama.volumeBel
          : (b.volumeBel === null || b.volumeBel === "" ? null
            : (Number(b.volumeBel) >= 0 && Number(b.volumeBel) <= 100 ? Math.round(Number(b.volumeBel)) : lama.volumeBel)),
        // Tautan papan dibuat HANYA saat diminta: layar yang tidak dipakai sebagai papan informasi tidak perlu
        // punya alamat yang bisa dibuka siapa pun yang mengetahuinya.
        token: b.buatToken && !lama.token ? randomBytes(12).toString("base64url") : lama.token,
      },
    });
    await logActivity(session, { action: "UBAH_LAYAR", entity: "Layar", entityId: layar.id, description: `Mengubah layar "${layar.nama}" (${layar.ruang})${layar.aktif ? "" : " — ditandai tidak aktif"}` });
    return Response.json({ ok: true });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal mengubah layar." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.kelola) return Response.json({ error: "Tidak berhak menghapus layar." }, { status: 403 });
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const lama = await prisma.layar.findUnique({ where: { id }, select: { nama: true, ruang: true } });
    if (!lama) return Response.json({ error: "Layar tidak ditemukan." }, { status: 404 });
    await prisma.layar.delete({ where: { id } });
    await logActivity(session, { action: "HAPUS_LAYAR", entity: "Layar", entityId: id, description: `Menghapus layar "${lama.nama}" (${lama.ruang})` });
    return Response.json({ ok: true });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menghapus layar." }, { status: 500 });
  }
}
