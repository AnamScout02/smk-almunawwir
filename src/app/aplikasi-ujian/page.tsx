import { redirect } from "next/navigation";
import { HALAMAN_APLIKASI } from "@/lib/aplikasi-ujian";

/** Alamat lama (aplikasi versi 1.0 khusus ujian) — satu halaman aplikasi sekarang di /pasang-aplikasi. */
export default function Page() {
  redirect(HALAMAN_APLIKASI);
}
