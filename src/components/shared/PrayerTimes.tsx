"use client";
import { useEffect, useState } from "react";
import { Clock, MapPin } from "lucide-react";

const PRAYERS = [
  { name: "Subuh",   key: "Fajr"    },
  { name: "Dzuhur",  key: "Dhuhr"   },
  { name: "Ashar",   key: "Asr"     },
  { name: "Maghrib", key: "Maghrib" },
  { name: "Isya",    key: "Isha"    },
];

const FALLBACK = { lat: -8.2907167, lng: 114.2072342, label: "Singojuruh" };

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function PrayerTimes() {
  const [times, setTimes]   = useState<Record<string, string> | null>(null);
  const [label, setLabel]   = useState("Memuat...");
  const [loading, setLoading] = useState(true);
  const [now, setNow]       = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const today = new Date();
    const dd   = String(today.getDate()).padStart(2, "0");
    const mm   = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();

    function fetchTimes(lat: number, lng: number, cityLabel: string) {
      setLabel(cityLabel);
      fetch(`https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${lat}&longitude=${lng}&method=20`)
        .then(r => r.json())
        .then(d => setTimes(d.data.timings))
        .catch(() => {})
        .finally(() => setLoading(false));
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos  => fetchTimes(pos.coords.latitude, pos.coords.longitude, "Lokasi Anda"),
        ()   => fetchTimes(FALLBACK.lat, FALLBACK.lng, FALLBACK.label),
        { timeout: 5000 }
      );
    } else {
      fetchTimes(FALLBACK.lat, FALLBACK.lng, FALLBACK.label);
    }
  }, []);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  function getNextPrayerKey(): string | null {
    if (!times) return null;
    for (const p of PRAYERS) {
      const t = times[p.key];
      if (t && toMinutes(t.slice(0, 5)) > currentMinutes) return p.key;
    }
    return PRAYERS[0].key; // setelah Isya → Subuh besok
  }

  const nextKey = getNextPrayerKey();

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.85) 0%, rgba(27,43,107,0.9) 100%)", backdropFilter: "blur(8px)", border: "1px solid rgba(232,160,32,0.2)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-white/10">
        <Clock size={15} className="text-gold shrink-0" />
        <h3 className="font-heading font-semibold text-sm text-white">Jadwal Sholat</h3>
        <span className="flex items-center gap-1 text-white/40 text-xs ml-auto">
          <MapPin size={11} /> {label}
        </span>
      </div>

      {/* Prayer cards */}
      <div className="grid grid-cols-5 gap-2 p-4">
        {PRAYERS.map(p => {
          const isNext = p.key === nextKey;
          const timeStr = loading ? "..." : (times?.[p.key]?.slice(0, 5) ?? "--:--");
          return (
            <div key={p.key}
              className={`relative text-center rounded-xl py-3 px-1 transition-all ${
                isNext
                  ? "bg-gradient-to-b from-gold/30 to-gold/10 border border-gold/50 shadow-lg shadow-gold/10"
                  : "bg-white/5 border border-white/5 hover:bg-white/10"
              }`}>
              {isNext && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gold text-primary-900 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap leading-none">
                  Berikutnya
                </span>
              )}
              <p className={`text-xs mb-1.5 font-semibold ${isNext ? "text-gold" : "text-white/50"}`}>
                {p.name}
              </p>
              <p className={`font-bold text-sm font-mono ${isNext ? "text-white" : "text-white/80"}`}>
                {timeStr}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
