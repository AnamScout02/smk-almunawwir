"use client";
import { useEffect, useState } from "react";
import { Clock, MapPin } from "lucide-react";

const PRAYERS = [
  { name: "Subuh", key: "Fajr" },
  { name: "Dzuhur", key: "Dhuhr" },
  { name: "Ashar", key: "Asr" },
  { name: "Maghrib", key: "Maghrib" },
  { name: "Isya", key: "Isha" },
];

const FALLBACK = { lat: -8.2907167, lng: 114.2072342, label: "Singojuruh" };

export default function PrayerTimes() {
  const [times, setTimes] = useState<Record<string, string> | null>(null);
  const [label, setLabel] = useState("Memuat...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();

    function fetchTimes(lat: number, lng: number, cityLabel: string) {
      setLabel(cityLabel);
      fetch(`https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${lat}&longitude=${lng}&method=20`)
        .then((r) => r.json())
        .then((d) => { setTimes(d.data.timings); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchTimes(pos.coords.latitude, pos.coords.longitude, "Lokasi Anda");
        },
        () => {
          // Ditolak atau gagal → fallback Singojuruh
          fetchTimes(FALLBACK.lat, FALLBACK.lng, FALLBACK.label);
        },
        { timeout: 5000 }
      );
    } else {
      fetchTimes(FALLBACK.lat, FALLBACK.lng, FALLBACK.label);
    }
  }, []);

  return (
    <div className="bg-primary-900 text-white rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={18} className="text-gold" />
        <h3 className="font-heading font-semibold text-sm">Jadwal Sholat</h3>
        <span className="flex items-center gap-1 text-white/50 text-xs ml-auto">
          <MapPin size={11} /> {label}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {PRAYERS.map((p) => (
          <div key={p.key} className="text-center bg-white/10 rounded-xl py-3">
            <p className="text-gold text-xs mb-1.5 font-medium">{p.name}</p>
            <p className="font-semibold text-sm">
              {loading ? "..." : (times?.[p.key]?.slice(0, 5) ?? "--:--")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
