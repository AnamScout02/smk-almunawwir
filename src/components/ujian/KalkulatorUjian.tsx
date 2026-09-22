"use client";
import { useState } from "react";
import { Calculator, X } from "lucide-react";

/** KALKULATOR ILMIAH di layar ujian — hanya muncul kalau guru mengizinkannya di pengaturan ujian.
 *
 * Ekspresi dihitung dengan pengurai sendiri (shunting-yard), BUKAN `eval`, jadi apa pun yang
 * diketik siswa tidak pernah dijalankan sebagai kode. Mendukung + − × ÷ ^ ( ) % !, akar, sin/cos/
 * tan (derajat atau radian), log, ln, π, e, dan koma sebagai tanda desimal. */

type Token =
  | { k: "angka"; v: number }
  | { k: "op"; v: string }
  | { k: "fn"; v: string }
  | { k: "buka" }
  | { k: "tutup" };

const FUNGSI = ["asin", "acos", "atan", "sqrt", "sin", "cos", "tan", "log", "ln"];
const PRIORITAS: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "neg": 3, "^": 4 };

function tokenisasi(teks: string): Token[] {
  const s = teks.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/√/g, "sqrt").replace(/π/g, "pi").replace(/\s+/g, "");
  const hasil: Token[] = [];
  let i = 0;
  const bisaKaliSiratan = () => {
    const a = hasil[hasil.length - 1];
    return !!a && (a.k === "angka" || a.k === "tutup" || (a.k === "op" && (a.v === "!" || a.v === "%")));
  };
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      const n = Number(s.slice(i, j).replace(",", "."));
      if (Number.isNaN(n)) throw new Error("Angka tidak sah");
      if (bisaKaliSiratan()) hasil.push({ k: "op", v: "*" });
      hasil.push({ k: "angka", v: n });
      i = j; continue;
    }
    if (s.startsWith("pi", i) || c === "e") {
      if (bisaKaliSiratan()) hasil.push({ k: "op", v: "*" });
      hasil.push({ k: "angka", v: c === "e" ? Math.E : Math.PI });
      i += c === "e" ? 1 : 2; continue;
    }
    const fn = FUNGSI.find(f => s.startsWith(f, i));
    if (fn) {
      if (bisaKaliSiratan()) hasil.push({ k: "op", v: "*" });
      hasil.push({ k: "fn", v: fn }); i += fn.length; continue;
    }
    if (c === "(") { if (bisaKaliSiratan()) hasil.push({ k: "op", v: "*" }); hasil.push({ k: "buka" }); i++; continue; }
    if (c === ")") { hasil.push({ k: "tutup" }); i++; continue; }
    if ("+-*/^!%".includes(c)) {
      const a = hasil[hasil.length - 1];
      const unary = c === "-" && (!a || a.k === "op" && !["!", "%"].includes(a.v) || a.k === "buka" || a.k === "fn");
      if (c === "+" && (!a || a.k === "buka" || (a.k === "op" && !["!", "%"].includes(a.v)))) { i++; continue; }
      hasil.push({ k: "op", v: unary ? "neg" : c }); i++; continue;
    }
    throw new Error("Karakter tidak dikenal");
  }
  return hasil;
}

function hitung(teks: string, derajat: boolean): number {
  const keluaran: Token[] = [];
  const tumpukan: Token[] = [];
  for (const t of tokenisasi(teks)) {
    if (t.k === "angka") keluaran.push(t);
    else if (t.k === "fn" || t.k === "buka") tumpukan.push(t);
    else if (t.k === "op" && (t.v === "!" || t.v === "%")) keluaran.push(t); // pascafiks langsung
    else if (t.k === "op") {
      while (tumpukan.length) {
        const a = tumpukan[tumpukan.length - 1];
        if (a.k === "fn" || (a.k === "op" && (PRIORITAS[a.v] > PRIORITAS[t.v] || (PRIORITAS[a.v] === PRIORITAS[t.v] && t.v !== "^" && t.v !== "neg")))) keluaran.push(tumpukan.pop()!);
        else break;
      }
      tumpukan.push(t);
    } else if (t.k === "tutup") {
      while (tumpukan.length && tumpukan[tumpukan.length - 1].k !== "buka") keluaran.push(tumpukan.pop()!);
      if (!tumpukan.length) throw new Error("Kurung tidak seimbang");
      tumpukan.pop();
      if (tumpukan.length && tumpukan[tumpukan.length - 1].k === "fn") keluaran.push(tumpukan.pop()!);
    }
  }
  while (tumpukan.length) {
    const t = tumpukan.pop()!;
    if (t.k === "buka") continue; // kurung buka yang tidak ditutup dianggap tertutup di akhir
    keluaran.push(t);
  }

  const rad = (x: number) => (derajat ? (x * Math.PI) / 180 : x);
  const drj = (x: number) => (derajat ? (x * 180) / Math.PI : x);
  const st: number[] = [];
  const ambil = () => { const v = st.pop(); if (v === undefined) throw new Error("Ekspresi belum lengkap"); return v; };
  for (const t of keluaran) {
    if (t.k === "angka") { st.push(t.v); continue; }
    if (t.k === "fn") {
      const x = ambil();
      const f: Record<string, number> = {
        sin: Math.sin(rad(x)), cos: Math.cos(rad(x)), tan: Math.tan(rad(x)),
        asin: drj(Math.asin(x)), acos: drj(Math.acos(x)), atan: drj(Math.atan(x)),
        sqrt: Math.sqrt(x), log: Math.log10(x), ln: Math.log(x),
      };
      st.push(f[t.v]); continue;
    }
    if (t.k === "op") {
      if (t.v === "neg") { st.push(-ambil()); continue; }
      if (t.v === "%") { st.push(ambil() / 100); continue; }
      if (t.v === "!") {
        const n = ambil();
        if (n < 0 || n > 170 || !Number.isInteger(n)) throw new Error("Faktorial hanya untuk bilangan bulat 0–170");
        let h = 1; for (let k = 2; k <= n; k++) h *= k; st.push(h); continue;
      }
      const b = ambil(), a = ambil();
      st.push(t.v === "+" ? a + b : t.v === "-" ? a - b : t.v === "*" ? a * b : t.v === "/" ? a / b : Math.pow(a, b));
    }
  }
  if (st.length !== 1) throw new Error("Ekspresi belum lengkap");
  return st[0];
}

const tampilAngka = (n: number) => {
  if (!Number.isFinite(n)) return "Tidak terdefinisi";
  const bulat = Math.abs(n) < 1e-12 ? 0 : Number(n.toPrecision(12));
  return Math.abs(bulat) >= 1e12 || (Math.abs(bulat) > 0 && Math.abs(bulat) < 1e-6)
    ? bulat.toExponential(6).replace(".", ",")
    : bulat.toLocaleString("id-ID", { maximumFractionDigits: 10, useGrouping: false });
};

const TOMBOL: { t: string; sisip?: string; gaya?: "fn" | "op" | "aksi" | "sama" }[][] = [
  [{ t: "sin", sisip: "sin(", gaya: "fn" }, { t: "cos", sisip: "cos(", gaya: "fn" }, { t: "tan", sisip: "tan(", gaya: "fn" }, { t: "ln", sisip: "ln(", gaya: "fn" }, { t: "log", sisip: "log(", gaya: "fn" }],
  [{ t: "√", sisip: "√(", gaya: "fn" }, { t: "xʸ", sisip: "^", gaya: "op" }, { t: "(", gaya: "op" }, { t: ")", gaya: "op" }, { t: "÷", gaya: "op" }],
  [{ t: "7" }, { t: "8" }, { t: "9" }, { t: "π", gaya: "fn" }, { t: "×", gaya: "op" }],
  [{ t: "4" }, { t: "5" }, { t: "6" }, { t: "e", gaya: "fn" }, { t: "−", gaya: "op" }],
  [{ t: "1" }, { t: "2" }, { t: "3" }, { t: "!", gaya: "op" }, { t: "+", gaya: "op" }],
  [{ t: "0" }, { t: "," }, { t: "%", gaya: "op" }, { t: "⌫", gaya: "aksi" }, { t: "=", gaya: "sama" }],
];

export default function KalkulatorUjian({ onTutup }: { onTutup: () => void }) {
  const [ekspresi, setEkspresi] = useState("");
  const [hasil, setHasil] = useState<string>("0");
  const [salah, setSalah] = useState(false);
  const [derajat, setDerajat] = useState(true);

  function tekan(t: string, sisip?: string) {
    setSalah(false);
    if (t === "⌫") { setEkspresi(e => e.slice(0, -1)); return; }
    if (t === "=") {
      try { const n = hitung(ekspresi, derajat); setHasil(tampilAngka(n)); setEkspresi(tampilAngka(n) === "Tidak terdefinisi" ? "" : tampilAngka(n)); }
      catch (e) { setSalah(true); setHasil(e instanceof Error ? e.message : "Ekspresi tidak sah"); }
      return;
    }
    setEkspresi(e => e + (sisip ?? t));
  }

  return (
    <div className="fixed right-3 bottom-3 z-50 w-[19rem] max-w-[94vw] rounded-2xl border border-primary-100 bg-white shadow-2xl overflow-hidden select-none">
      <div className="flex items-center gap-2 px-3 py-2 text-white" style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
        <Calculator size={15} className="text-gold" />
        <span className="font-heading font-semibold text-sm flex-1">Kalkulator</span>
        <button onClick={() => setDerajat(d => !d)} className="text-xs font-bold px-2 py-0.5 rounded-md border border-white/25 hover:bg-white/10" title="Satuan sudut">
          {derajat ? "DEG" : "RAD"}
        </button>
        <button onClick={onTutup} className="p-1 rounded-md hover:bg-white/10" title="Tutup"><X size={15} /></button>
      </div>
      <div className="px-3 pt-3">
        <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-right">
          <input value={ekspresi} onChange={e => { setEkspresi(e.target.value); setSalah(false); }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); tekan("="); } }}
            className="w-full bg-transparent text-right font-mono text-sm text-gray-600 outline-none" placeholder="0" aria-label="Ekspresi" />
          <p className={`font-mono font-bold truncate ${salah ? "text-red-600 text-xs" : "text-primary-900 text-xl"}`}>{hasil}</p>
        </div>
      </div>
      <div className="p-3 grid grid-cols-5 gap-1.5">
        <button onClick={() => { setEkspresi(""); setHasil("0"); setSalah(false); }} className="col-span-5 h-8 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100">AC — hapus semua</button>
        {TOMBOL.flat().map(b => (
          <button key={b.t} onClick={() => tekan(b.t, b.sisip)}
            className={`h-9 rounded-lg text-sm font-semibold transition active:scale-95 ${
              b.gaya === "sama" ? "bg-gold text-primary-900 hover:bg-gold-dark hover:text-white"
              : b.gaya === "op" ? "bg-primary-50 text-primary-700 hover:bg-primary-100"
              : b.gaya === "fn" ? "bg-gray-100 text-gray-700 text-xs hover:bg-gray-200"
              : b.gaya === "aksi" ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
              : "bg-white border border-gray-200 text-gray-800 hover:bg-gray-50"}`}>
            {b.t}
          </button>
        ))}
      </div>
    </div>
  );
}
