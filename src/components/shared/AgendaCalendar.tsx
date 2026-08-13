"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Circle } from "lucide-react";
import { colorForJabatan } from "@/lib/wakasek-colors";

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
 * ringkas — sumber agendanya program kerja Wakil Kepala saja (lihat src/lib/agenda.ts). Tanggal yang
 * punya agenda ditandai titik BERWARNA sesuai jabatan Wakasek pemiliknya (colorForJabatan) — hover
 * ke tanggalnya utk lihat detail (judul, jabatan, rentang tanggal) lewat tooltip portal (sama pola
 * popup dgn DatePicker.tsx, supaya tidak kepotong overflow-hidden card ini). "use client" karena
 * butuh state hover — data agenda-nya sendiri tetap di-fetch server-side oleh pemanggil. */
export default function AgendaCalendar({ agenda }: { agenda: AgendaItem[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7; // Senin = 0

  const itemsByDay = new Map<number, AgendaItem[]>();
  for (const a of agenda) {
    const d = new Date(a.tanggalMulai);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const day = d.getDate();
    if (!itemsByDay.has(day)) itemsByDay.set(day, []);
    itemsByDay.get(day)!.push(a);
  }

  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const cellRefs = useRef<Record<number, HTMLDivElement | null>>({});

  function showTooltip(day: number) {
    const el = cellRefs.current[day];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPopupStyle({ position: "fixed", left: rect.left + rect.width / 2, top: rect.top - 6, transform: "translate(-50%, -100%)", zIndex: 99999 });
    setHoverDay(day);
  }

  const hoverItems = hoverDay ? itemsByDay.get(hoverDay) : undefined;

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
          {cells.map((d, i) => {
            const items = d ? itemsByDay.get(d) : undefined;
            return (
              <div key={i}
                ref={el => { if (d) cellRefs.current[d] = el; }}
                className="h-7 flex flex-col items-center justify-center relative"
                onMouseEnter={() => { if (d && items?.length) showTooltip(d); }}
                onMouseLeave={() => setHoverDay(null)}
              >
                {d && (
                  <>
                    <span className={`w-6 h-6 flex items-center justify-center text-[10px] rounded-full ${
                      d === today ? "bg-gold text-primary-900 font-bold" : "text-gray-600"
                    } ${items?.length ? "cursor-default font-semibold" : ""}`}>
                      {d}
                    </span>
                    {!!items?.length && (
                      <span className="flex gap-0.5 absolute -bottom-0.5">
                        {items.slice(0, 3).map((it, idx) => (
                          <span key={idx} className="w-1.5 h-1.5 rounded-full" style={{ background: colorForJabatan(it.jabatan.name) }} />
                        ))}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
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

      {hoverDay && hoverItems && hoverItems.length > 0 && typeof document !== "undefined" && createPortal(
        <div style={popupStyle} className="rounded-xl shadow-2xl border border-primary-100 bg-white p-3 w-64 pointer-events-none">
          <p className="text-[10px] font-bold text-primary-900 mb-1.5">{hoverDay} {BULAN[month]} {year}</p>
          <div className="space-y-2">
            {hoverItems.map(it => (
              <div key={it.id} className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: colorForJabatan(it.jabatan.name) }} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary-900 leading-snug">{it.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {it.jabatan.name} · {fmtShort(it.tanggalMulai)}{it.tanggalSelesai ? ` – ${fmtShort(it.tanggalSelesai)}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
