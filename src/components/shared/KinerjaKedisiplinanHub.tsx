"use client";
import { useEffect, useState } from "react";
import DisciplineLeaderboard from "./DisciplineLeaderboard";
import KpiDashboard from "./KpiDashboard";

/** Gabungan navigasi "Papan Peringkat Disiplin" + "Kinerja Pegawai" jadi satu titik masuk sidebar
 * (permintaan user: digabung tapi papan/ranking masing-masing tetap ada, bukan dilebur jadi satu
 * perhitungan — lihat percakapan sesi ini). Kedua komponen TETAP berdiri sendiri (masing-masing
 * py PageHeader & logic sendiri, TIDAK direfactor internalnya) — cuma diberi tombol saling-silang
 * lewat prop `onSwitchTab` supaya user bisa pindah tanpa balik ke sidebar. Tab "Kinerja Pegawai"
 * cuma tampil kalau user ini memang berwenang (dicek lewat probe API, sesuai scope
 * `assertKpiLeadershipAccess` di /api/kpi/leaderboard) — Kedisiplinan tetap terbuka utk semua. */
export default function KinerjaKedisiplinanHub() {
  const [tab, setTab] = useState<"disiplin" | "kinerja">("disiplin");
  const [canViewKinerja, setCanViewKinerja] = useState(false);

  useEffect(() => {
    fetch("/api/kpi/leaderboard?jabatanName=GURU").then(r => setCanViewKinerja(r.ok)).catch(() => setCanViewKinerja(false));
  }, []);

  if (tab === "kinerja" && canViewKinerja) {
    return <KpiDashboard mode="leadership" onSwitchTab={() => setTab("disiplin")} />;
  }
  return <DisciplineLeaderboard onSwitchTab={canViewKinerja ? () => setTab("kinerja") : undefined} />;
}
