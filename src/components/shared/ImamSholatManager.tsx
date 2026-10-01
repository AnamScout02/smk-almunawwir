"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Moon, Loader2, ClipboardCheck } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import { useToast } from "@/components/shared/ToastProvider";

interface Orang { id: string; nama: string; role: string; jk: string | null }
interface Baris { id: string; day: string; weekType: string; sesi: string; slot: string; userId: string; nama: string; catatan: string | null }
interface DataJadwal { hari: string[]; sesi: string[]; slot: Record<string, string[]>; jadwal: Baris[]; orang: Orang[] }

/** JADWAL imam sholat — dipakai portal admin dan guru (pola komponen manager lintas portal,
 *  CLAUDE.md #14). Jadwalnya mingguan berulang persis seperti Jadwal Piket.
 *
 *  PRESENSI HARIANNYA TIDAK DI SINI (30 September 2026, permintaan user "biar jadi 1"): kehadiran
 *  imam dicek bersama kehadiran petugas piket di Buku Piket (Kedisiplinan Guru), karena
 *  petugas & tanggalnya sama. Jangan menghidupkan lagi tab "Presensi Harian" di halaman ini —
 *  dua tempat pengisian untuk satu data berarti keduanya bisa berbeda. */
export default function ImamSholatManager({ bukuPiketHref }: { bukuPiketHref: string }) {
  const toast = useToast();
  const [d, setD] = useState<DataJadwal | null>(null);
  const [galat, setGalat] = useState("");
  const [minggu, setMinggu] = useState("SEMUA");
  const [sibuk, setSibuk] = useState("");

  const muat = useCallback(() => {
    fetch("/api/imam/jadwal", { cache: "no-store" })
      .then(async r => {
        const x = await r.json().catch(() => null);
        if (r.ok && x) { setD(x); setGalat(""); } else setGalat(x?.error ?? "Gagal memuat jadwal imam.");
      })
      .catch(() => setGalat("Gagal memuat jadwal imam."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function simpanSlot(day: string, sesi: string, slot: string, userId: string) {
    const kunci = `${day}|${sesi}|${slot}`;
    setSibuk(kunci);
    const res = await fetch("/api/imam/jadwal", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, weekType: minggu, sesi, slot, userId }),
    }).catch(() => null);
    setSibuk("");
    if (!res?.ok) { const x = await res?.json().catch(() => null); toast.error(x?.error ?? "Gagal menyimpan."); return; }
    muat();
  }

  const cari = (day: string, sesi: string, slot: string) =>
    d?.jadwal.find(j => j.day === day && j.weekType === minggu && j.sesi === sesi && j.slot === slot)?.userId ?? "";

  const terisi = d ? d.jadwal.filter(j => j.weekType === minggu).length : 0;
  const totalSlot = d ? d.hari.length * (d.slot.DUHA.length + d.slot.DZUHUR.length) : 0;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Moon size={22} />} title="Jadwal Imam Sholat"
        description="Duha satu petugas, Dzuhur imam putra & putri — jadwal mingguan berulang; kehadiran hariannya dicek di Buku Piket" />

      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile ikon="kalender" color="primary" value={terisi} label={`Slot Terisi (minggu ${minggu})`} />
        <StatTile ikon="menunggu" color={totalSlot - terisi ? "amber" : "emerald"} value={Math.max(0, totalSlot - terisi)} label="Slot Kosong" sorot={totalSlot - terisi > 0} />
        <StatTile ikon="guru" color="blue" value={d?.orang.length ?? 0} label="Guru & Staf Tersedia" />
      </div>

      <div className="baris-alat mb-5">
        <div className="alat-saring">
          <Select value={minggu} onChange={setMinggu} options={[
            { value: "SEMUA", label: "Berlaku setiap minggu" },
            { value: "A", label: "Minggu A saja" },
            { value: "B", label: "Minggu B saja" },
          ]} />
        </div>
        <div className="alat-aksi alat-teks">
          <Link href={bukuPiketHref} className="btn-modal-cancel btn-teks">
            <ClipboardCheck size={15} /> Presensi Imam di Buku Piket
          </Link>
        </div>
      </div>

      {galat ? (
        <p className="py-16 text-center text-sm text-gray-400">{galat}</p>
      ) : !d ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">No</th><th>Hari</th>
                  <th>Duha — Petugas</th><th>Dzuhur — Imam Putra</th><th>Dzuhur — Imam Putri</th>
                </tr>
              </thead>
              <tbody>
                {d.hari.map((h, i) => (
                  <tr key={h}>
                    <td className="angka">{i + 1}</td>
                    <td className="font-semibold text-primary-900 whitespace-nowrap">{h}</td>
                    {([["DUHA", "-"], ["DZUHUR", "L"], ["DZUHUR", "P"]] as const).map(([sesi, slot]) => (
                      <td key={`${sesi}${slot}`} className="min-w-[13rem]">
                        <Select value={cari(h, sesi, slot)} onChange={v => simpanSlot(h, sesi, slot, v)}
                          placeholder={sibuk === `${h}|${sesi}|${slot}` ? "Menyimpan..." : "— Belum diisi —"}
                          options={[{ value: "", label: "— Kosongkan —" },
                            ...d.orang
                              .filter(o => sesi !== "DZUHUR" || !o.jk || o.jk === slot)
                              .map(o => ({ value: o.id, label: o.nama }))]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
            Pilihan untuk Dzuhur disaring menurut jenis kelamin yang tercatat di Buku Induk; yang belum
            tercatat tetap muncul supaya jadwal tidak terhambat data kosong.
          </p>
        </div>
      )}
    </div>
  );
}

