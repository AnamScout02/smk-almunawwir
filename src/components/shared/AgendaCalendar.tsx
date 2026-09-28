"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
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
const WIB = 7 * 3600_000;

const STATUS: Record<string, { label: string; kelas: string }> = {
  DIRENCANAKAN: { label: "Direncanakan", kelas: "bg-gray-50 text-gray-600 border-gray-200" },
  BERJALAN:     { label: "Berjalan",     kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  SELESAI:      { label: "Selesai",      kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  BATAL:        { label: "Batal",        kelas: "bg-red-50 text-red-600 border-red-200" },
};

/** Tanggal di WIB (server berjalan UTC) supaya "hari ini" di server & browser sama. */
const wib = (d: string | Date | number) => new Date(new Date(d).getTime() + WIB);
function fmtShort(d: string | Date) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
}

/** Widget kalender bulan berjalan + daftar agenda ringkas — sumber agendanya program kerja Wakil Kepala saja (lihat
 * src/lib/agenda.ts). Tanggal berisi agenda diberi titik berwarna sesuai jabatan Wakasek (colorForJabatan); detailnya
 * muncul saat disorot (desktop) atau diketuk (HP) lewat tooltip portal. Tampilan mengikuti Pola tampilan v2 (§17). */
export default function AgendaCalendar({ agenda }: { agenda: AgendaItem[] }) {
  const kini = wib(Date.now());
  const year = kini.getUTCFullYear();
  const month = kini.getUTCMonth();
  const today = kini.getUTCDate();

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startOffset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // Senin = 0

  const itemsByDay = new Map<number, AgendaItem[]>();
  for (const a of agenda) {
    const d = wib(a.tanggalMulai);
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month) continue;
    const day = d.getUTCDate();
    if (!itemsByDay.has(day)) itemsByDay.set(day, []);
    itemsByDay.get(day)!.push(a);
  }

  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const cellRefs = useRef<Record<number, HTMLElement | null>>({});

  function showTooltip(day: number) {
    const el = cellRefs.current[day];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const kiri = Math.min(Math.max(rect.left + rect.width / 2, 140), window.innerWidth - 140);
    setPopupStyle({ position: "fixed", left: kiri, top: rect.top - 6, transform: "translate(-50%, -100%)", zIndex: 99999 });
    setHoverDay(day);
  }

  const hoverItems = hoverDay ? itemsByDay.get(hoverDay) : undefined;

  return (
    <section className="panel masuk-halus">
      <header className="panel-kepala">
        <h2 className="panel-judul">
          <span className="panel-ikon" aria-hidden="true"><CalendarDays /></span>
          <span>Agenda {BULAN[month]} {year}</span>
        </h2>
      </header>

      <div className="px-3 pt-3 sm:px-4">
        <div className="mb-1 grid grid-cols-7 text-center">
          {HARI.map(h => <span key={h} className="py-1 text-xs font-semibold text-gray-400">{h}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((d, i) => {
            const items = d ? itemsByDay.get(d) : undefined;
            if (!d) return <span key={i} className="h-10" />;
            const angka = (
              <>
                <span className={`angka flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                  d === today ? "bg-gold font-bold text-primary-900" : items?.length ? "font-semibold text-primary-900" : "text-gray-600"}`}>
                  {d}
                </span>
                {!!items?.length && (
                  <span className="absolute bottom-0.5 flex gap-0.5" aria-hidden="true">
                    {items.slice(0, 3).map((it, idx) => (
                      <span key={idx} className="h-1.5 w-1.5 rounded-full" style={{ background: colorForJabatan(it.jabatan.name) }} />
                    ))}
                  </span>
                )}
              </>
            );
            return items?.length ? (
              <button key={i} type="button"
                ref={el => { cellRefs.current[d] = el; }}
                className="relative flex h-10 flex-col items-center justify-center rounded-lg hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-gold"
                aria-label={`${d} ${BULAN[month]}: ${items.map(it => it.title).join(", ")}`}
                onMouseEnter={() => showTooltip(d)}
                onMouseLeave={() => setHoverDay(null)}
                onFocus={() => showTooltip(d)}
                onBlur={() => setHoverDay(null)}
                onClick={() => (hoverDay === d ? setHoverDay(null) : showTooltip(d))}>
                {angka}
              </button>
            ) : (
              <div key={i} className="relative flex h-10 flex-col items-center justify-center">{angka}</div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 border-t border-gray-100 px-4 py-3 sm:px-5">
        <p className="label-kecil mb-2.5">Agenda Wakil Kepala</p>
        {agenda.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">Belum ada agenda Wakil Kepala.</p>
        ) : (
          <ul className="space-y-3">
            {agenda.slice(0, 4).map(item => {
              const st = STATUS[item.status] ?? STATUS.DIRENCANAKAN;
              return (
                <li key={item.id} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: colorForJabatan(item.jabatan.name) }} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-primary-900">{item.title}</p>
                    <p className="truncate text-xs text-gray-500">
                      {item.jabatan.name} · {fmtShort(item.tanggalMulai)}{item.tanggalSelesai ? ` – ${fmtShort(item.tanggalSelesai)}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${st.kelas}`}>{st.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {hoverDay && hoverItems && hoverItems.length > 0 && typeof document !== "undefined" && createPortal(
        <div style={popupStyle} className="pointer-events-none w-64 rounded-xl border border-primary-100 bg-white p-3 shadow-panel-naik">
          <p className="mb-1.5 text-xs font-bold text-primary-900">{hoverDay} {BULAN[month]} {year}</p>
          <div className="space-y-2">
            {hoverItems.map(it => (
              <div key={it.id} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: colorForJabatan(it.jabatan.name) }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-primary-900">{it.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {it.jabatan.name} · {fmtShort(it.tanggalMulai)}{it.tanggalSelesai ? ` – ${fmtShort(it.tanggalSelesai)}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
