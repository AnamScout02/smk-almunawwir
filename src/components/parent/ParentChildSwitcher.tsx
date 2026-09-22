"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import Select from "@/components/admin/Select";

export interface ChildOption {
  id: string;
  name: string;
  className: string;
}

/** Dropdown pindah anak — cuma dirender kalau akun ortu punya >1 anak (lihat layout.tsx). Anak
 * yang dipilih disimpan lewat `?studentId=` di URL (pola sama `?classId=`/`?month=` yang sudah
 * lazim di app ini), bukan cookie/localStorage — supaya konsisten dgn pola searchParams Next.js
 * 16 dan gampang di-refresh/share. Ganti anak akan navigasi ke path yang sama dgn param baru,
 * jadi tetap di halaman yang sedang dibuka (mis. dari Rapor anak A → Rapor anak B). */
export default function ParentChildSwitcher({ childOptions }: { childOptions: ChildOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (childOptions.length <= 1) return null;

  const selectedId = searchParams.get("studentId") ?? childOptions[0].id;

  function handleChange(studentId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("studentId", studentId);
    router.push(`${pathname}?${params.toString()}`);
  }

  // SENGAJA BUKAN sticky — header "hero" tiap halaman Portal Orang Tua sudah sticky sendiri
  // (top-14 lg:top-0, pola §3.3 DESIGN_SYSTEM.md). Menumpuk dua elemen sticky butuh offset `top`
  // kumulatif yang benar (pernah jadi bug nyata soal tinggi dinamis — lihat gotcha ImpersonationBanner
  // di CLAUDE.md), jadi switcher ini dibiarkan ikut discroll biasa — cukup sederhana & aman.
  return (
    <div className="bg-white border-b border-gray-100 px-5 md:px-8 py-2.5 flex items-center gap-3 print:hidden">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 shrink-0">
        <Users size={14} /> Menampilkan data:
      </span>
      <Select
        className="w-52"
        value={selectedId}
        onChange={handleChange}
        options={childOptions.map(c => ({ value: c.id, label: `${c.name} — ${c.className}` }))}
      />
    </div>
  );
}
