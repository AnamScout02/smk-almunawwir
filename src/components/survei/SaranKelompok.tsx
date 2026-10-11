"use client";
import { useMemo, useState } from "react";
import Select from "@/components/admin/Select";
import { sarankanKelompok } from "@/lib/kelompok-sosiometri";

/** Usulan kelompok belajar dari hasil sosiometri — dihitung di peramban, tidak disimpan. */
export default function SaranKelompok({ siswa, pilihan }: { siswa: { id: string; nama: string; dipilih: number; mengisi: boolean }[]; pilihan: [string, string][] }) {
  const [ukuran, setUkuran] = useState("4");
  const kelompok = useMemo(() => sarankanKelompok(siswa, pilihan, Number(ukuran)), [siswa, pilihan, ukuran]);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-primary-900">Usulan kelompok belajar</p>
        <div className="w-40"><Select value={ukuran} onChange={setUkuran} options={[3, 4, 5, 6].map(n => ({ value: String(n), label: `${n} orang per kelompok` }))} /></div>
        <span className="text-xs text-gray-500">{kelompok.length} kelompok</span>
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {kelompok.map((g, i) => (
          <li key={i} className="min-w-0 rounded-xl border border-gray-100 p-3">
            <p className="label-kecil mb-1.5">Kelompok {i + 1}</p>
            <ul className="space-y-1">
              {g.map(a => (
                <li key={a.id} className="text-sm">
                  <span className={`font-medium ${a.dipilih === 0 ? "text-red-600" : "text-primary-900"}`}>{a.nama}</span>
                  <span className="block text-xs text-gray-500">{a.alasan}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-500">Usulan saja: siswa yang paling banyak dipilih disebar satu per kelompok, dan siswa yang tidak dipilih (merah) ditempatkan bersama orang yang ia pilih. Hal di luar angket — konflik, kemampuan, putra/putri — tetap pertimbangan guru.</p>
    </div>
  );
}
