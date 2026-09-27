import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras } from "@/lib/sarpras-akses";
import { daftarPerangkat, kandidatJaringan, tebakJenis } from "@/lib/perangkat-jaringan";
import { logActivity } from "@/lib/activity-log";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const MAC_SAH = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.masuk) return Response.json({ error: "Khusus pengelola sarana prasarana." }, { status: 403 });

    const [{ baris, routerOk }, kandidat] = await Promise.all([
      daftarPerangkat(),
      akses.kelola ? kandidatJaringan() : Promise.resolve([]),
    ]);
    return Response.json({ baris, routerOk, kandidat, bolehKelola: akses.kelola });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal memuat perangkat jaringan." }, { status: 500 });
  }
}

/** Tambah satu perangkat, atau `banyak: [...]` sekaligus (tombol "Daftarkan semua yang terdeteksi"). */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.kelola) return Response.json({ error: "Tidak berhak menambah perangkat." }, { status: 403 });

    const b = await req.json().catch(() => ({})) as {
      nama?: string; jenis?: string; mac?: string; lokasi?: string; catatan?: string;
      banyak?: { mac: string; namaHost?: string | null; ip?: string }[];
    };

    if (Array.isArray(b.banyak) && b.banyak.length) {
      const sah = b.banyak.filter(x => MAC_SAH.test((x.mac ?? "").toUpperCase()));
      const dibuat = await prisma.perangkatJaringan.createMany({
        data: sah.map(x => ({
          mac: x.mac.toUpperCase(),
          // Nama otomatis dari nama host bila ada; petugas tinggal merapikan lewat tombol ubah.
          nama: (x.namaHost || `Perangkat ${x.mac.toUpperCase().slice(-5)}`).slice(0, 80),
          jenis: tebakJenis(x.namaHost ?? null, x.mac),
          ipTerakhir: x.ip || null,
        })),
        skipDuplicates: true,
      });
      await logActivity(session, {
        action: "IMPOR_PERANGKAT_JARINGAN", entity: "PerangkatJaringan", entityId: "-",
        description: `Mendaftarkan ${dibuat.count} perangkat jaringan dari hasil deteksi router`,
      });
      return Response.json({ ok: true, dibuat: dibuat.count });
    }

    const nama = (b.nama ?? "").trim();
    const mac = (b.mac ?? "").trim().toUpperCase();
    if (!nama) return Response.json({ error: "Nama wajib diisi." }, { status: 400 });
    if (!MAC_SAH.test(mac)) return Response.json({ error: "MAC tidak sah (contoh: 70:85:C4:C2:12:32)." }, { status: 400 });
    if (await prisma.perangkatJaringan.findUnique({ where: { mac }, select: { id: true } })) {
      return Response.json({ error: "Perangkat dengan MAC itu sudah terdaftar." }, { status: 409 });
    }
    const p = await prisma.perangkatJaringan.create({
      data: { nama, mac, jenis: b.jenis || tebakJenis(nama, mac), lokasi: b.lokasi?.trim() || null, catatan: b.catatan?.trim() || null },
    });
    await logActivity(session, {
      action: "TAMBAH_PERANGKAT_JARINGAN", entity: "PerangkatJaringan", entityId: p.id,
      description: `Mendaftarkan ${p.jenis} "${nama}"${p.lokasi ? ` di ${p.lokasi}` : ""}`,
    });
    return Response.json({ ok: true, id: p.id });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menambah perangkat." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.kelola) return Response.json({ error: "Tidak berhak mengubah perangkat." }, { status: 403 });

    const b = await req.json().catch(() => ({})) as { id?: string; nama?: string; jenis?: string; lokasi?: string; aktif?: boolean; catatan?: string };
    if (!b.id) return Response.json({ error: "Perangkat tidak dikenal." }, { status: 400 });
    const lama = await prisma.perangkatJaringan.findUnique({ where: { id: b.id } });
    if (!lama) return Response.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });

    const p = await prisma.perangkatJaringan.update({
      where: { id: b.id },
      data: {
        nama: b.nama?.trim() || lama.nama,
        jenis: b.jenis || lama.jenis,
        lokasi: b.lokasi === undefined ? lama.lokasi : (b.lokasi.trim() || null),
        aktif: typeof b.aktif === "boolean" ? b.aktif : lama.aktif,
        catatan: b.catatan === undefined ? lama.catatan : (b.catatan.trim() || null),
      },
    });
    await logActivity(session, {
      action: "UBAH_PERANGKAT_JARINGAN", entity: "PerangkatJaringan", entityId: p.id,
      description: `Mengubah ${p.jenis} "${p.nama}"${p.aktif ? "" : " — ditandai tidak aktif"}`,
    });
    return Response.json({ ok: true });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal mengubah perangkat." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.kelola) return Response.json({ error: "Tidak berhak menghapus perangkat." }, { status: 403 });
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const lama = await prisma.perangkatJaringan.findUnique({ where: { id }, select: { nama: true, jenis: true } });
    if (!lama) return Response.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
    await prisma.perangkatJaringan.delete({ where: { id } });
    await logActivity(session, {
      action: "HAPUS_PERANGKAT_JARINGAN", entity: "PerangkatJaringan", entityId: id,
      description: `Menghapus ${lama.jenis} "${lama.nama}"`,
    });
    return Response.json({ ok: true });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menghapus perangkat." }, { status: 500 });
  }
}
