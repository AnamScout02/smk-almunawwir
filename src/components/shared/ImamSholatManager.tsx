"use client";
import { useCallback, useEffect, useState } from "react";
import { Moon, Loader2, Save, CalendarDays, ClipboardCheck } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";

interface Orang { id: string; nama: string; role: string; jk: string | null }
interface Baris { id: string; day: string; weekType: string; sesi: string; slot: string; userId: string; nama: string; catatan: string | null }
interface DataJadwal { hari: string[]; sesi: string[]; slot: Record<string, string[]>; jadwal: Baris[]; orang: Orang[] }
interface Petugas { sesi: string; slot: string; userId: string; nama: string; status: string | null }

const LABEL_SLOT: Record<string, string> = { "-": "Petugas", L: "Imam Putra", P: "Imam Putri" };
const LABEL_SESI: Record<string, string> = { DUHA: "Sholat Duha", DZUHUR: "Sholat Dzuhur" };
const BADGE: Record<string, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  IZIN: "bg-blue-50 text-blue-700 border border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border border-amber-200",
  ALPHA: "bg-red-50 text-red-600 border border-red-200",
};
const hariIniWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/** Jadwal & presensi imam sholat — dipakai portal admin dan guru (pola komponen manager lintas
 *  portal, CLAUDE.md #14). Jadwalnya mingguan berulang persis seperti Jadwal Piket. */
export default function ImamSholatManager() {
  const toast = useToast();
  const [tab, setTab] = useState<"jadwal" | "presensi">("jadwal");
  const [d, setD] = useState<DataJadwal | null>(null);
  const [galat, setGalat] = useState("");
  const [minggu, setMinggu] = useState("SEMUA");
  const [sibuk, setSibuk] = useState("");

  const [tanggal, setTanggal] = useState(hariIniWib);
  const [petugas, setPetugas] = useState<Petugas[] | null>(null);
  const [libur, setLibur] = useState<string | null>(null);
  const [isi, setIsi] = useState<Record<string, string>>({});

  const muat = useCallback(() => {
    fetch("/api/imam/jadwal", { cache: "no-store" })
      .then(async r => {
        const x = await r.json().catch(() => null);
        if (r.ok && x) { setD(x); setGalat(""); } else setGalat(x?.error ?? "Gagal memuat jadwal imam.");
      })
      .catch(() => setGalat("Gagal memuat jadwal imam."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const muatPresensi = useCallback((tgl: string) => {
    setPetugas(null);
    fetch(`/api/imam/presensi?tanggal=${tgl}`, { cache: "no-store" })
      .then(async r => {
        const x = await r.json().catch(() => null);
        if (!r.ok || !x) { setPetugas([]); setLibur(null); return; }
        setPetugas(x.petugas ?? []); setLibur(x.libur ?? null);
        const awal: Record<string, string> = {};
        for (const p of x.petugas ?? []) if (p.status) awal[`${p.userId}|${p.sesi}`] = p.status;
        setIsi(awal);
      })
      .catch(() => { setPetugas([]); setLibur(null); });
  }, []);
  useEffect(() => { if (tab === "presensi") muatPresensi(tanggal); }, [tab, tanggal, muatPresensi]);

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

  async function simpanPresensi() {
    const baris = (petugas ?? [])
      .map(p => ({ userId: p.userId, sesi: p.sesi, status: isi[`${p.userId}|${p.sesi}`] }))
      .filter(b => b.status);
    if (baris.length === 0) { toast.error("Belum ada kehadiran yang diisi."); return; }
    setSibuk("presensi");
    const res = await fetch("/api/imam/presensi", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tanggal, baris }),
    }).catch(() => null);
    setSibuk("");
    if (!res?.ok) { const x = await res?.json().catch(() => null); toast.error(x?.error ?? "Gagal menyimpan."); return; }
    toast.success(`Kehadiran ${baris.length} imam tersimpan.`);
    muatPresensi(tanggal);
  }

  const cari = (day: string, sesi: string, slot: string) =>
    d?.jadwal.find(j => j.day === day && j.weekType === minggu && j.sesi === sesi && j.slot === slot)?.userId ?? "";

  const terisi = d ? d.jadwal.filter(j => j.weekType === minggu).length : 0;
  const totalSlot = d ? d.hari.length * (d.slot.DUHA.length + d.slot.DZUHUR.length) : 0;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Moon size={22} />} title="Jadwal Imam Sholat"
        description="Duha satu petugas, Dzuhur imam putra & putri — jadwal mingguan berulang, kehadirannya ikut dicatat" />

      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile ikon="kalender" color="primary" value={terisi} label={`Slot Terisi (minggu ${minggu})`} />
        <StatTile ikon="menunggu" color={totalSlot - terisi ? "amber" : "emerald"} value={Math.max(0, totalSlot - terisi)} label="Slot Kosong" sorot={totalSlot - terisi > 0} />
        <StatTile ikon="guru" color="blue" value={d?.orang.length ?? 0} label="Guru & Staf Tersedia" />
      </div>

      <div className="baris-alat mb-5">
        <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
          {([["jadwal", "Jadwal Mingguan", CalendarDays], ["presensi", "Presensi Harian", ClipboardCheck]] as const).map(([v, l, Ikon]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === v ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              <Ikon size={14} /> {l}
            </button>
          ))}
        </div>
        {tab === "jadwal" ? (
          <div className="alat-saring">
            <Select value={minggu} onChange={setMinggu} options={[
              { value: "SEMUA", label: "Berlaku setiap minggu" },
              { value: "A", label: "Minggu A saja" },
              { value: "B", label: "Minggu B saja" },
            ]} />
          </div>
        ) : (
          <div className="alat-saring"><DatePicker value={tanggal} onChange={setTanggal} /></div>
        )}
        {tab === "presensi" && (
          <div className="alat-aksi">
            <button onClick={simpanPresensi} disabled={sibuk === "presensi" || !petugas?.length} className="btn-modal-save">
              {sibuk === "presensi" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </div>
        )}
      </div>

      {galat ? (
        <p className="py-16 text-center text-sm text-gray-400">{galat}</p>
      ) : !d ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : tab === "jadwal" ? (
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
      ) : libur ? (
        <EmptyState icon={Moon} title="Hari libur" description={`${tanggal} — ${libur}. Tidak ada jadwal imam.`} />
      ) : !petugas ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : petugas.length === 0 ? (
        <EmptyState icon={Moon} title="Belum ada petugas" description="Belum ada jadwal imam untuk hari itu. Isi dulu di tab Jadwal Mingguan." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th className="w-10">No</th><th>Sesi</th><th>Tugas</th><th>Petugas</th><th>Kehadiran</th></tr></thead>
              <tbody>
                {petugas.map((p, i) => (
                  <tr key={`${p.userId}${p.sesi}${p.slot}`}>
                    <td className="angka">{i + 1}</td>
                    <td className="whitespace-nowrap">{LABEL_SESI[p.sesi] ?? p.sesi}</td>
                    <td className="whitespace-nowrap text-gray-500">{LABEL_SLOT[p.slot] ?? p.slot}</td>
                    <td className="font-semibold text-primary-900">{p.nama}</td>
                    <td className="min-w-[11rem]">
                      <div className="flex items-center gap-2">
                        <Select value={isi[`${p.userId}|${p.sesi}`] ?? ""}
                          onChange={v => setIsi(x => ({ ...x, [`${p.userId}|${p.sesi}`]: v }))}
                          placeholder="— Pilih —"
                          options={["HADIR", "IZIN", "SAKIT", "ALPHA"].map(s => ({ value: s, label: s }))} />
                        {p.status && <span className={`status-badge whitespace-nowrap ${BADGE[p.status] ?? ""}`}>{p.status}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
            Kehadiran sengaja dimulai KOSONG — petugas yang belum diperiksa tidak boleh otomatis terhitung hadir.
          </p>
        </div>
      )}
    </div>
  );
}
