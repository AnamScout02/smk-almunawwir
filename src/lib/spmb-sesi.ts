import "server-only";

/** Isian sesi kedatangan dari panitia → data tersimpan (dipakai POST & PUT /api/spmb/sesi). */
export function rapikanSesi(b: Record<string, unknown>): { data?: { tanggal: string; jamMulai: string; jamSelesai: string; tempat: string | null; kuota: number; catatan: string | null }; galat?: string } {
  const tanggal = String(b?.tanggal ?? "");
  const jam = (x: unknown) => (/^\d{2}:\d{2}$/.test(String(x ?? "")) ? String(x) : "");
  const jamMulai = jam(b?.jamMulai), jamSelesai = jam(b?.jamSelesai);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { galat: "Tanggal sesi wajib diisi." };
  if (!jamMulai || !jamSelesai) return { galat: "Jam mulai & selesai wajib diisi." };
  if (jamSelesai <= jamMulai) return { galat: "Jam selesai harus setelah jam mulai." };
  const kuota = Math.round(Number(b?.kuota) || 0);
  if (kuota < 1 || kuota > 2000) return { galat: "Kuota sesi 1–2000 orang." };
  return {
    data: {
      tanggal, jamMulai, jamSelesai, kuota,
      tempat: String(b?.tempat ?? "").trim().slice(0, 200) || null,
      catatan: String(b?.catatan ?? "").trim().slice(0, 300) || null,
    },
  };
}
