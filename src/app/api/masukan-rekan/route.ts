import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { ISI_MAKS, PERAN_PEGAWAI, jenisSah } from "@/lib/masukan-rekan";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/**
 * GET — kotak masuk & terkirim MILIK SENDIRI.
 * `pengirimId`/relasi `pengirim` SENGAJA tidak ikut di bagian "masuk": penerima tidak boleh tahu
 * siapa pengirimnya, dan menyembunyikannya di layar saja tidak cukup (lihat src/lib/masukan-rekan.ts).
 */
export async function GET() {
  try {
    const session = await verifyRole([...PERAN_PEGAWAI]);
    const [masuk, terkirim, rekan] = await Promise.all([
      prisma.masukanRekan.findMany({
        where: { penerimaId: session.userId },
        select: { id: true, jenis: true, isi: true, dibacaAt: true, createdAt: true },
        orderBy: { createdAt: "desc" }, take: 200,
      }),
      prisma.masukanRekan.findMany({
        where: { pengirimId: session.userId },
        select: { id: true, jenis: true, isi: true, createdAt: true, dibacaAt: true, penerima: { select: { name: true } } },
        orderBy: { createdAt: "desc" }, take: 200,
      }),
      prisma.user.findMany({
        where: { role: { in: [...PERAN_PEGAWAI] }, id: { not: session.userId } },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return NextResponse.json({ masuk, terkirim, rekan });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** POST — kirim masukan. Pengirim dicatat di DB (untuk Superadmin), tidak pernah dikembalikan ke penerima. */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole([...PERAN_PEGAWAI]);
    const { penerimaId, jenis, isi } = await req.json() as { penerimaId?: string; jenis?: string; isi?: string };

    if (!penerimaId || penerimaId === session.userId) {
      return NextResponse.json({ error: "Pilih rekan tujuan (tidak bisa ke diri sendiri)." }, { status: 400 });
    }
    if (!jenisSah(jenis)) return NextResponse.json({ error: "Jenis masukan tidak sah." }, { status: 400 });
    const teks = (isi ?? "").trim();
    if (teks.length < 10) return NextResponse.json({ error: "Tulis masukannya minimal 10 karakter." }, { status: 400 });
    if (teks.length > ISI_MAKS) return NextResponse.json({ error: `Maksimal ${ISI_MAKS} karakter.` }, { status: 400 });

    const penerima = await prisma.user.findFirst({
      where: { id: penerimaId, role: { in: [...PERAN_PEGAWAI] } },
      select: { id: true },
    });
    if (!penerima) return NextResponse.json({ error: "Rekan tujuan tidak ditemukan." }, { status: 400 });

    // Batas wajar supaya tidak jadi saluran spam: 10 masukan per pengirim per hari.
    const sejak = new Date(Date.now() - 86400_000);
    const jumlah = await prisma.masukanRekan.count({ where: { pengirimId: session.userId, createdAt: { gte: sejak } } });
    if (jumlah >= 10) {
      return NextResponse.json({ error: "Batas 10 masukan per hari sudah tercapai." }, { status: 429 });
    }

    const baris = await prisma.masukanRekan.create({
      data: { pengirimId: session.userId, penerimaId, jenis, isi: teks },
      select: { id: true },
    });

    // Notifikasi TANPA menyebut pengirim.
    kirimLatar(() => kirimNotifikasi({
      userIds: [penerimaId],
      kunci: `masukan-rekan:${baris.id}`,
      jenis: "MASUKAN_REKAN",
      judul: "Ada masukan untukmu",
      isi: "Seorang rekan mengirim masukan. Buka menu Masukan Rekan untuk membacanya.",
      url: "/masukan-rekan",
    }));

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    console.error("[masukan-rekan POST]", e);
    return NextResponse.json({ error: "Gagal mengirim masukan." }, { status: 500 });
  }
}

/** PUT — tandai masukan yang DITUJUKAN KE SAYA sudah dibaca. */
export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole([...PERAN_PEGAWAI]);
    const { id } = await req.json() as { id?: string };
    if (!id) return NextResponse.json({ error: "id wajib." }, { status: 400 });
    const n = await prisma.masukanRekan.updateMany({
      where: { id, penerimaId: session.userId, dibacaAt: null },
      data: { dibacaAt: new Date() },
    });
    return NextResponse.json({ ok: true, diubah: n.count });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menandai." }, { status: 500 });
  }
}
