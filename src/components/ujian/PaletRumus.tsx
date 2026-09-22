"use client";
import { useRef, useState } from "react";
import { Sigma } from "lucide-react";
import Modal from "@/components/admin/Modal";
import HtmlSoal from "@/components/ujian/HtmlSoal";

/** PALET RUMUS (22 September 2026) — permintaan user: "penulisan soal atau jawaban dengan banyak rumus kimia maupun
 * matematika bagaimana memasukkannya, atau ikon-ikon penting di rumus". Guru (penyunting soal) dan siswa (jawaban
 * uraian/isian) memakai jendela yang SAMA: klik simbol → tersusun di kotak rumus (LaTeX) → pratinjau langsung →
 * "Sisipkan" menaruh `$…$` di posisi kursor. Rumus kimia memakai mhchem: \ce{H2SO4}, \ce{A + B -> C}.
 * Tanpa pustaka tambahan: pratinjau memakai KaTeX yang sudah dipakai HtmlSoal. */

type Tombol = { t: string; s: string; j?: string };

const KATEGORI: { nama: string; tombol: Tombol[] }[] = [
  { nama: "Dasar", tombol: [
    { t: "xⁿ", s: "^{}", j: "pangkat" }, { t: "xₙ", s: "_{}", j: "indeks bawah" }, { t: "a⁄b", s: "\\frac{}{}", j: "pecahan" },
    { t: "√", s: "\\sqrt{}", j: "akar" }, { t: "ⁿ√", s: "\\sqrt[]{}", j: "akar pangkat n" }, { t: "±", s: "\\pm " },
    { t: "×", s: "\\times " }, { t: "÷", s: "\\div " }, { t: "·", s: "\\cdot " }, { t: "≠", s: "\\neq " }, { t: "≈", s: "\\approx " },
    { t: "≤", s: "\\le " }, { t: "≥", s: "\\ge " }, { t: "∞", s: "\\infty " }, { t: "π", s: "\\pi " }, { t: "°", s: "^{\\circ}" },
    { t: "%", s: "\\% " }, { t: "( )", s: "\\left(  \\right)", j: "kurung menyesuaikan" }, { t: "|x|", s: "\\left|  \\right|", j: "nilai mutlak" },
    { t: "x̄", s: "\\bar{}", j: "rata-rata" }, { t: "a:b", s: "a : b" }, { t: "ab‾", s: "\\overline{}", j: "garis atas" },
  ] },
  { nama: "Aljabar & Kalkulus", tombol: [
    { t: "∑", s: "\\sum_{i=1}^{n} " }, { t: "∏", s: "\\prod_{i=1}^{n} " }, { t: "∫", s: "\\int_{a}^{b}  \\,dx" }, { t: "lim", s: "\\lim_{x \\to 0} " },
    { t: "log", s: "\\log_{}" }, { t: "ln", s: "\\ln " }, { t: "sin", s: "\\sin " }, { t: "cos", s: "\\cos " }, { t: "tan", s: "\\tan " },
    { t: "d/dx", s: "\\frac{d}{dx}" }, { t: "f′(x)", s: "f'(x)" }, { t: "v⃗", s: "\\vec{}", j: "vektor" }, { t: "Δ", s: "\\Delta " },
    { t: "[a b; c d]", s: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", j: "matriks 2×2" },
    { t: "|A|", s: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}", j: "determinan" }, { t: "ⁿCₖ", s: "\\binom{n}{k}", j: "kombinasi" },
    { t: "n!", s: "n!" }, { t: "∴", s: "\\therefore " }, { t: "∵", s: "\\because " }, { t: "∠", s: "\\angle " }, { t: "⊥", s: "\\perp " },
    { t: "∥", s: "\\parallel " }, { t: "≅", s: "\\cong " }, { t: "∼", s: "\\sim " },
  ] },
  { nama: "Yunani", tombol: ["alpha", "beta", "gamma", "delta", "epsilon", "theta", "lambda", "mu", "pi", "rho", "sigma", "tau", "phi", "omega", "Delta", "Sigma", "Omega", "Phi", "Pi", "Theta", "Lambda", "Gamma"]
    .map(n => ({ t: { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", omega: "ω", Delta: "Δ", Sigma: "Σ", Omega: "Ω", Phi: "Φ", Pi: "Π", Theta: "Θ", Lambda: "Λ", Gamma: "Γ" }[n] ?? n, s: `\\${n} ` })) },
  { nama: "Himpunan & Logika", tombol: [
    { t: "∈", s: "\\in " }, { t: "∉", s: "\\notin " }, { t: "⊂", s: "\\subset " }, { t: "⊆", s: "\\subseteq " }, { t: "∪", s: "\\cup " },
    { t: "∩", s: "\\cap " }, { t: "∅", s: "\\emptyset " }, { t: "ℝ", s: "\\mathbb{R}" }, { t: "ℕ", s: "\\mathbb{N}" }, { t: "ℤ", s: "\\mathbb{Z}" },
    { t: "∀", s: "\\forall " }, { t: "∃", s: "\\exists " }, { t: "∧", s: "\\land " }, { t: "∨", s: "\\lor " }, { t: "¬", s: "\\neg " },
    { t: "⇒", s: "\\Rightarrow " }, { t: "⇔", s: "\\Leftrightarrow " }, { t: "→", s: "\\to " }, { t: "{ }", s: "\\{  \\}", j: "kurung kurawal" },
  ] },
  { nama: "Kimia", tombol: [
    { t: "H₂O", s: "\\ce{H2O}", j: "rumus senyawa (angka otomatis jadi indeks)" }, { t: "A + B → C", s: "\\ce{A + B -> C}", j: "reaksi" },
    { t: "⇌", s: "\\ce{A <=> B}", j: "reaksi setimbang" }, { t: "→ᵏᵃᵗ", s: "\\ce{A ->[katalis] B}", j: "panah bertulisan" },
    { t: "SO₄²⁻", s: "\\ce{SO4^2-}", j: "ion" }, { t: "Na⁺", s: "\\ce{Na+}" }, { t: "(aq)", s: "\\ce{NaCl(aq)}", j: "wujud zat" },
    { t: "↑ gas", s: "\\ce{CO2 ^}" }, { t: "↓ endapan", s: "\\ce{AgCl v}" }, { t: "¹⁴₆C", s: "\\ce{^{14}_{6}C}", j: "isotop" },
    { t: "CuSO₄·5H₂O", s: "\\ce{CuSO4*5H2O}", j: "hidrat" }, { t: "e⁻", s: "\\ce{e-}" }, { t: "ΔH", s: "\\Delta H = \\pu{-286 kJ/mol}" },
    { t: "°C", s: "\\pu{25 ^\\circ C}" }, { t: "mol/L", s: "\\pu{0,1 mol/L}" }, { t: "[H⁺]", s: "[\\ce{H+}]" },
  ] },
  { nama: "Fisika & Satuan", tombol: [
    { t: "×10ⁿ", s: "\\times 10^{}", j: "notasi ilmiah" }, { t: "m/s²", s: "\\mathrm{m/s^2}" }, { t: "Ω", s: "\\Omega " }, { t: "μ", s: "\\mu " },
    { t: "λ", s: "\\lambda " }, { t: "°C", s: "^{\\circ}\\mathrm{C}" }, { t: "F⃗", s: "\\vec{F}" }, { t: "Δt", s: "\\Delta t" },
    { t: "ε₀", s: "\\varepsilon_0" }, { t: "ħ", s: "\\hbar " }, { t: "√(2gh)", s: "\\sqrt{2gh}" }, { t: "satuan", s: "\\,\\mathrm{}", j: "satuan tegak" },
  ] },
];

/** Tombol pembuka palet — dipakai di samping kotak isian. */
export function TombolRumus({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} title="Sisipkan rumus matematika / kimia"
      className={`inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline ${className}`}>
      <Sigma size={13} /> Rumus
    </button>
  );
}

export default function PaletRumus({ open, onClose, onSisip }: {
  open: boolean; onClose: () => void; onSisip: (teks: string) => void;
}) {
  const [latex, setLatex] = useState("");
  const [kategori, setKategori] = useState(0);
  const [blok, setBlok] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  function tambah(s: string) {
    const el = ref.current;
    const awal = el?.selectionStart ?? latex.length, akhir = el?.selectionEnd ?? latex.length;
    const pilihan = latex.slice(awal, akhir);
    // Teks yang sedang dipilih masuk ke kurung kurawal pertama (mis. pilih "2x" lalu klik √ → \sqrt{2x}).
    const kosong = s.indexOf("{}");
    const sisip = pilihan && kosong >= 0 ? s.slice(0, kosong + 1) + pilihan + s.slice(kosong + 1) : s;
    const baru = latex.slice(0, awal) + sisip + latex.slice(akhir);
    setLatex(baru);
    // Kursor ke kurung kurawal kosong pertama supaya guru/siswa langsung mengetik isinya.
    const k = sisip.indexOf("{}");
    const pos = awal + (k >= 0 ? k + 1 : sisip.length);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos, pos); });
  }

  function sisipkan() {
    const isi = latex.trim();
    if (!isi) return;
    onSisip(blok ? `$$${isi}$$` : `$${isi}$`);
    setLatex("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Sisipkan Rumus" description="Klik simbol, lengkapi isinya, lalu Sisipkan" size="xl" scrollBody
      footer={<>
        <button type="button" onClick={onClose} className="btn-modal-cancel">Batal</button>
        <button type="button" onClick={sisipkan} disabled={!latex.trim()} className="btn-modal-save"><Sigma /> Sisipkan</button>
      </>}>
      <div className="space-y-3">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
          {KATEGORI.map((k, i) => (
            <button key={k.nama} type="button" onClick={() => setKategori(i)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${kategori === i ? "bg-primary-900 text-white" : "text-gray-600 hover:bg-white"}`}>{k.nama}</button>
          ))}
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
          {KATEGORI[kategori].tombol.map(b => (
            <button key={b.t + b.s} type="button" onClick={() => tambah(b.s)} title={`${b.j ? b.j + " — " : ""}${b.s}`}
              className="h-10 rounded-lg border border-gray-200 bg-white px-1 text-sm font-medium text-gray-800 hover:border-primary-300 hover:bg-primary-50 truncate">
              {b.t}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="kotak-rumus" className="label-field">Rumus (LaTeX — boleh diketik langsung)</label>
          <textarea id="kotak-rumus" ref={ref} value={latex} onChange={e => setLatex(e.target.value)} rows={2} spellCheck={false}
            autoCapitalize="off" autoCorrect="off" placeholder={"mis. x^2 + \\frac{1}{2}  atau  \\ce{H2SO4}"}
            className="input-field w-full font-mono" />
          <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={blok} onChange={e => setBlok(e.target.checked)} className="h-4 w-4 accent-primary-700" />
            Tampilkan di baris sendiri (rumus besar di tengah)
          </label>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 min-h-[3.5rem]">
          <p className="label-kecil mb-1">Pratinjau</p>
          {latex.trim() ? <HtmlSoal key={latex + blok} html={blok ? `$$${latex}$$` : `$${latex}$`} className="text-lg" /> : <p className="text-sm text-gray-400">Rumus tampil di sini.</p>}
        </div>
        <p className="text-xs text-gray-500">
          Kimia: tulis di dalam <code>{String.raw`\ce{…}`}</code> — angka otomatis jadi indeks (<code>{String.raw`\ce{H2SO4}`}</code>),
          <code>{"->"}</code> panah, <code>{"<=>"}</code> setimbang, <code>{"^2-"}</code> muatan ion.
        </p>
      </div>
    </Modal>
  );
}
