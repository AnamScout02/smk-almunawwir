import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Pengisian Buku Tamu oleh TAMU SENDIRI — tanpa login, dipicu dari QR di meja depan.
 *
 * Endpoint publik, jadi dijaga seperlunya: hanya boleh menulis, tidak pernah membaca daftar tamu;
 * kategori dibatasi pada nilai yang dikenal; panjang tiap isian dipotong; dan satu alamat IP
 * dibatasi beberapa pengisian per jam supaya tidak bisa dipakai membanjiri buku tamu. Foto SENGAJA
 * tidak diterima di sini — dokumentasi diunggah petugas TU dari daftar Buku Tamu. */

const KATEGORI_SAH = ["DINAS", "WALI_MURID", "VENDOR", "UMUM", "LAINNYA"];
const BATAS_PER_IP_PER_JAM = 12;

const potong = (v: unknown, n: number) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t.slice(0, n) : null;
};

/** Jejak pengisian per IP, hanya di memori proses — cukup untuk menahan spam iseng dari satu
 * perangkat. Bukan pengganti pembatasan di tingkat jaringan, dan sengaja tidak disimpan ke DB. */
const jejak = new Map<string, number[]>();
function terlaluSering(ip: string): boolean {
  const sekarang = Date.now();
  const sejam = sekarang - 3_600_000;
  const daftar = (jejak.get(ip) ?? []).filter(t => t > sejam);
  daftar.push(sekarang);
  jejak.set(ip, daftar);
  if (jejak.size > 500) for (const [k, v] of jejak) if (!v.some(t => t > sejam)) jejak.delete(k);
  return daftar.length > BATAS_PER_IP_PER_JAM;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "tanpa-ip";
    if (terlaluSering(ip)) {
      return Response.json({ error: "Terlalu banyak pengisian dari perangkat ini. Silakan hubungi petugas." }, { status: 429 });
    }

    const b = await req.json();
    const guestName = potong(b.guestName, 120);
    const purpose = potong(b.purpose, 300);
    if (!guestName) return Response.json({ error: "Nama wajib diisi." }, { status: 400 });
    if (!purpose) return Response.json({ error: "Keperluan wajib diisi." }, { status: 400 });

    const category = KATEGORI_SAH.includes(b.category) ? b.category : "UMUM";
    const sekarang = new Date();
    // Jam datang diambil dari WAKTU SERVER, bukan kiriman tamu — supaya tidak bisa diatur sendiri.
    // Server berjalan UTC sedangkan sekolah WIB, jadi dikonversi eksplisit.
    const jamWib = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(sekarang).replace(".", ":");
    const tanggalWib = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(sekarang);

    await prisma.guestBookEntry.create({
      data: {
        visitDate: new Date(`${tanggalWib}T00:00:00.000Z`),
        timeIn: jamWib,
        guestName,
        category,
        institution: potong(b.institution, 150),
        purpose,
        metWith: potong(b.metWith, 120),
        phone: potong(b.phone, 30),
        notes: null,
        inputById: null,
        viaQr: true,
      },
    });
    return Response.json({ ok: true, jam: jamWib }, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan. Silakan hubungi petugas." }, { status: 500 });
  }
}
