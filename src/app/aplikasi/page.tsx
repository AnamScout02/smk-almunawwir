import { redirect } from "next/navigation";
import { HALAMAN_APLIKASI } from "@/lib/aplikasi-ujian";

/** Alamat lama halaman unduh APK — digabung ke /pasang-aplikasi (23 Sep 2026, permintaan user: dua halaman "kok double"). */
export default function Page() {
  redirect(HALAMAN_APLIKASI);
}
