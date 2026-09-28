import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

/** Staf (role TAS) yang BELUM punya satu pun jabatan.
 *
 * Kenapa perlu: fitur di portal staf dinyalakan oleh JABATAN, bukan oleh role — role TAS hanyalah
 * wadah untuk semua pegawai non-guru. Staf tanpa jabatan otomatis tidak punya menu tugas apa pun,
 * dan itu tidak terlihat dari mana pun sampai orangnya mengeluh (temuan user 28 September 2026).
 *
 * Sengaja TIDAK memasukkan guru: sebagian besar guru memang tidak memegang jabatan struktural, jadi
 * mendaftar mereka di sini hanya akan menenggelamkan peringatan yang sungguhan.
 *
 * Perlu dicatat batasnya: daftar ini menangkap staf yang jabatannya KOSONG, bukan staf yang
 * jabatannya KURANG SATU (mis. pemegang "Kepala UKS" yang sebenarnya juga Tata Usaha). Kasus
 * seperti itu ketahuan dari daftar pemegang tiap jabatan di halaman Jabatan. */
export async function GET() {
  try {
    await verifyTasAccess();
    const staf = await prisma.user.findMany({
      where: { role: "TAS", staffJabatan: { none: {} } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
    return Response.json({ staf });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
