import { CalendarDays, Circle } from "lucide-react";

export interface AgendaItem {
  id: string;
  title: string;
  tanggalMulai: string | Date;
  tanggalSelesai: string | Date | null;
  status: string;
  jabatan: { name: string };
}

const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const STATUS_DOT: Record<string, string> = {
  DIRENCANAKAN: "text-gray-400",
  BERJALAN: "text-blue-500",
  SELESAI: "text-emerald-500",
  BATAL: "text-red-400",
};
const STATUS_LABEL: Record<string, string> = {
  DIRENCANAKAN: "Direncanakan", BERJALAN: "Berjalan", SELESAI: "Selesai", BATAL: "Batal",
};

function fmtShort(d: string | Date) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

/** Widget kalender bulan berjalan (tema navy/gold, tanggal hari ini di-highlight) + daftar agenda
 * ringkas — sumber agendanya program kerja Wakil Kepala saja (lihat src/lib/agenda.ts). Murni
 * presentational & server-renderable: tanggal "live" karena selalu dihitung saat request (halaman
 * pemanggilnya sudah `force-dynamic`), tanpa navigasi bulan untuk menjaga simpel di v1. */
export default function AgendaCalendar({ agenda }: { agenda: AgendaItem[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7; // Senin = 0

  const agendaDays = new Set(
    agenda
      .filter(a => {
        const d = new Date(a.tanggalMulai);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .map(a => new Date(a.tanggalMulai).getDate())
  );

  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "100px 100px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
        <div className="relative flex items-center gap-2">
          <CalendarDays size={15} className="text-gold" />
          <h3 className="font-heading font-semibold text-xs uppercase tracking-wide">{BULAN[month]} {year}</h3>
        </div>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {HARI.map(h => (
            <span key={h} className="text-[10px] font-bold text-gray-400">{h}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => (
            <div key={i} className="h-6 flex items-center justify-center relative">
              {d && (
                <span className={`w-6 h-6 flex items-center justify-center text-[10px] rounded-full ${
                  d === today ? "bg-gold text-primary-900 font-bold" : "text-gray-600"
                }`}>
                  {d}
                  {agendaDays.has(d) && d !== today && (
                    <span className="absolute bottom-0 w-1 h-1 rounded-full bg-primary-500" />
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-50 px-4 py-2.5">
        <p className="text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 mb-1.5">Agenda Wakil Kepala</p>
        {agenda.length === 0 ? (
          <div className="text-center py-3 text-gray-300">
            <CalendarDays size={20} className="mx-auto mb-1" />
            <p className="text-xs text-gray-400">Belum ada agenda Wakil Kepala</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {agenda.slice(0, 4).map(item => (
              <li key={item.id} className="flex items-start gap-2 text-xs">
                <Circle size={7} className={`mt-1 shrink-0 rounded-full ${STATUS_DOT[item.status] ?? STATUS_DOT.DIRENCANAKAN}`} fill="currentColor" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-primary-900 truncate">{item.title}</p>
                  <p className="text-gray-400 truncate">
                    {item.jabatan.name} · {fmtShort(item.tanggalMulai)}{item.tanggalSelesai ? ` – ${fmtShort(item.tanggalSelesai)}` : ""}
                  </p>
                </div>
                <span className="text-[9px] font-bold text-gray-400 whitespace-nowrap">{STATUS_LABEL[item.status] ?? item.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
