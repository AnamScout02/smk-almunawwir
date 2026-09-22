import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

/** RUMUS WORD → LaTeX (22 September 2026). Mammoth (pembaca .docx impor soal) MEMBUANG rumus Equation Editor Word
 * (OMML, <m:oMath>), sehingga soal matematika/kimia yang disusun di Word kehilangan rumusnya saat diimpor. Di sini
 * setiap <m:oMath> di word/document.xml diganti teks `$…$` (rumus sebaris) atau `$$…$$` (rumus berdiri sendiri)
 * SEBELUM diberikan ke mammoth — hasilnya dirender KaTeX di layar soal (HtmlSoal) seperti rumus yang diketik guru.
 * Rumus lama "Microsoft Equation 3.0" (objek OLE) bukan OMML dan tetap terbaca sebagai gambar. */

const M = "http://schemas.openxmlformats.org/officeDocument/2006/math";
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

type El = Element;
const anak = (e: El, nama?: string): El[] => {
  const hasil: El[] = [];
  for (let n = e.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (!nama || (n as El).localName === nama)) hasil.push(n as El);
  }
  return hasil;
};
const satu = (e: El | undefined, nama: string): El | undefined => (e ? anak(e, nama)[0] : undefined);
/** Nilai atribut m:val dari properti (mis. <m:chr m:val="∑"/>). */
const val = (pr: El | undefined, nama: string): string | null => {
  const x = satu(pr, nama);
  if (!x) return null;
  return x.getAttributeNS(M, "val") ?? x.getAttribute("m:val") ?? x.getAttribute("val");
};

const SIMBOL: Record<string, string> = {
  "×": "\\times ", "÷": "\\div ", "±": "\\pm ", "∓": "\\mp ", "·": "\\cdot ", "⋅": "\\cdot ", "∙": "\\cdot ",
  "≤": "\\le ", "≥": "\\ge ", "≠": "\\neq ", "≈": "\\approx ", "≡": "\\equiv ", "≅": "\\cong ", "∼": "\\sim ", "∝": "\\propto ",
  "≪": "\\ll ", "≫": "\\gg ", "∞": "\\infty ", "∂": "\\partial ", "∇": "\\nabla ", "∈": "\\in ", "∉": "\\notin ", "∋": "\\ni ",
  "⊂": "\\subset ", "⊃": "\\supset ", "⊆": "\\subseteq ", "⊇": "\\supseteq ", "∪": "\\cup ", "∩": "\\cap ", "∅": "\\emptyset ",
  "→": "\\rightarrow ", "←": "\\leftarrow ", "↔": "\\leftrightarrow ", "⇒": "\\Rightarrow ", "⇐": "\\Leftarrow ", "⇔": "\\Leftrightarrow ",
  "⇌": "\\rightleftharpoons ", "↑": "\\uparrow ", "↓": "\\downarrow ", "°": "^{\\circ}", "′": "'", "″": "''", "∠": "\\angle ",
  "⊥": "\\perp ", "∥": "\\parallel ", "∴": "\\therefore ", "∵": "\\because ", "∀": "\\forall ", "∃": "\\exists ", "¬": "\\neg ",
  "∧": "\\land ", "∨": "\\lor ", "…": "\\ldots ", "⋯": "\\cdots ", "⋮": "\\vdots ", "⋱": "\\ddots ", "⊕": "\\oplus ", "⊗": "\\otimes ",
  "ℏ": "\\hbar ", "ℝ": "\\mathbb{R}", "ℕ": "\\mathbb{N}", "ℤ": "\\mathbb{Z}", "ℚ": "\\mathbb{Q}", "ℂ": "\\mathbb{C}", "√": "\\surd ",
  "α": "\\alpha ", "β": "\\beta ", "γ": "\\gamma ", "δ": "\\delta ", "ε": "\\varepsilon ", "ϵ": "\\epsilon ", "ζ": "\\zeta ", "η": "\\eta ",
  "θ": "\\theta ", "ϑ": "\\vartheta ", "ι": "\\iota ", "κ": "\\kappa ", "λ": "\\lambda ", "μ": "\\mu ", "ν": "\\nu ", "ξ": "\\xi ",
  "π": "\\pi ", "ρ": "\\rho ", "σ": "\\sigma ", "ς": "\\varsigma ", "τ": "\\tau ", "υ": "\\upsilon ", "φ": "\\varphi ", "ϕ": "\\phi ",
  "χ": "\\chi ", "ψ": "\\psi ", "ω": "\\omega ", "Γ": "\\Gamma ", "Δ": "\\Delta ", "∆": "\\Delta ", "Θ": "\\Theta ", "Λ": "\\Lambda ",
  "Ξ": "\\Xi ", "Π": "\\Pi ", "Σ": "\\Sigma ", "Υ": "\\Upsilon ", "Φ": "\\Phi ", "Ψ": "\\Psi ", "Ω": "\\Omega ",
  "{": "\\{", "}": "\\}", "%": "\\%", "#": "\\#", "&": "\\&", "$": "\\$", "_": "\\_", "\\": "\\backslash ", "−": "-", "–": "-",
};
const FUNGSI = new Set(["sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "log", "ln", "lg",
  "exp", "lim", "max", "min", "sup", "inf", "det", "dim", "ker", "deg", "gcd", "arg"]);
const NARY: Record<string, string> = { "∑": "\\sum", "∏": "\\prod", "∐": "\\coprod", "∫": "\\int", "∬": "\\iint", "∭": "\\iiint",
  "∮": "\\oint", "⋃": "\\bigcup", "⋂": "\\bigcap", "⋁": "\\bigvee", "⋀": "\\bigwedge" };
const AKSEN: Record<string, string> = { "̂": "\\hat", "̃": "\\tilde", "̄": "\\bar", "̅": "\\bar", "̇": "\\dot",
  "̈": "\\ddot", "⃗": "\\vec", "̆": "\\breve", "̌": "\\check", "⃖": "\\overleftarrow", "⃡": "\\overleftrightarrow" };
const KURUNG: Record<string, string> = { "{": "\\{", "}": "\\}", "‖": "\\|", "⟨": "\\langle", "⟩": "\\rangle", "〈": "\\langle",
  "〉": "\\rangle", "⌊": "\\lfloor", "⌋": "\\rfloor", "⌈": "\\lceil", "⌉": "\\rceil", "|": "|", "(": "(", ")": ")", "[": "[", "]": "]" };

function teks(t: string, polos: boolean): string {
  // NFKC: huruf matematika Unicode (𝑥, 𝐴) → huruf biasa.
  const n = t.normalize("NFKC");
  if (polos && /[A-Za-z]{2,}/.test(n) && !FUNGSI.has(n.trim())) return `\\mathrm{${n.replace(/[{}\\%#&$_]/g, c => SIMBOL[c] ?? c)}}`;
  if (FUNGSI.has(n.trim())) return `\\${n.trim()} `;
  let out = "";
  for (const c of n) out += SIMBOL[c] ?? c;
  return out;
}

const kelompok = (s: string) => (s.length === 1 || /^\\[A-Za-z]+\s?$/.test(s) ? s : `{${s}}`);

/** Ubah isi elemen OMML (m:oMath / m:e / m:num …) menjadi LaTeX. */
function isi(e: El | undefined): string {
  if (!e) return "";
  return anak(e).map(simpul).join("");
}

function simpul(e: El): string {
  switch (e.localName) {
    case "r": {
      const pr = satu(e, "rPr");
      const polos = !!satu(pr, "nor") || val(pr, "sty") === "p";
      return anak(e, "t").map(t => teks(t.textContent ?? "", polos)).join("");
    }
    case "f": {
      const jenis = val(satu(e, "fPr"), "type");
      const a = isi(satu(e, "num")), b = isi(satu(e, "den"));
      if (jenis === "lin") return `${kelompok(a)}/${kelompok(b)}`;
      if (jenis === "noBar") return `\\genfrac{}{}{0pt}{}{${a}}{${b}}`;
      return `\\frac{${a}}{${b}}`;
    }
    case "sSup": return `${kelompok(isi(satu(e, "e")))}^{${isi(satu(e, "sup"))}}`;
    case "sSub": return `${kelompok(isi(satu(e, "e")))}_{${isi(satu(e, "sub"))}}`;
    case "sSubSup": return `${kelompok(isi(satu(e, "e")))}_{${isi(satu(e, "sub"))}}^{${isi(satu(e, "sup"))}}`;
    case "sPre": return `{}_{${isi(satu(e, "sub"))}}^{${isi(satu(e, "sup"))}}${kelompok(isi(satu(e, "e")))}`;
    case "rad": {
      const sembunyi = val(satu(e, "radPr"), "degHide");
      const deg = isi(satu(e, "deg"));
      return sembunyi === "1" || sembunyi === "on" || !deg ? `\\sqrt{${isi(satu(e, "e"))}}` : `\\sqrt[${deg}]{${isi(satu(e, "e"))}}`;
    }
    case "nary": {
      const pr = satu(e, "naryPr");
      const op = NARY[val(pr, "chr") ?? "∫"] ?? "\\int";
      const sub = val(pr, "subHide") === "1" ? "" : isi(satu(e, "sub"));
      const sup = val(pr, "supHide") === "1" ? "" : isi(satu(e, "sup"));
      return `${op}${sub ? `_{${sub}}` : ""}${sup ? `^{${sup}}` : ""}{${isi(satu(e, "e"))}}`;
    }
    case "d": {
      const pr = satu(e, "dPr");
      const buka = val(pr, "begChr") ?? "(", tutup = val(pr, "endChr") ?? ")", pisah = val(pr, "sepChr") ?? "|";
      const bagian = anak(e, "e").map(isi).join(pisah === "|" ? " \\mid " : ` ${KURUNG[pisah] ?? pisah} `);
      return `\\left${buka ? KURUNG[buka] ?? buka : "."} ${bagian} \\right${tutup ? KURUNG[tutup] ?? tutup : "."}`;
    }
    case "func": {
      const nama = isi(satu(e, "fName")).trim();
      const fn = /^[a-z]+$/.test(nama) ? (FUNGSI.has(nama) ? `\\${nama}` : `\\operatorname{${nama}}`) : nama;
      return `${fn} ${kelompok(isi(satu(e, "e")))}`;
    }
    case "acc": {
      const c = val(satu(e, "accPr"), "chr") ?? "̂";
      return `${AKSEN[c] ?? "\\hat"}{${isi(satu(e, "e"))}}`;
    }
    case "bar": return `${val(satu(e, "barPr"), "pos") === "top" ? "\\overline" : "\\underline"}{${isi(satu(e, "e"))}}`;
    case "limLow": {
      const dasar = isi(satu(e, "e")).trim();
      const bawah = isi(satu(e, "lim"));
      return /^\\(lim|max|min|sup|inf) ?$/.test(dasar) || /^(lim|max|min)$/.test(dasar)
        ? `\\${dasar.replace(/^\\/, "").trim()}_{${bawah}}` : `\\underset{${bawah}}{${dasar}}`;
    }
    case "limUpp": return `\\overset{${isi(satu(e, "lim"))}}{${isi(satu(e, "e"))}}`;
    case "groupChr": {
      const pr = satu(e, "groupChrPr");
      const c = val(pr, "chr") ?? "⏟";
      return `${c === "⏞" || val(pr, "pos") === "top" ? "\\overbrace" : "\\underbrace"}{${isi(satu(e, "e"))}}`;
    }
    case "m": {
      const baris = anak(e, "mr").map(r => anak(r, "e").map(isi).join(" & "));
      return `\\begin{matrix} ${baris.join(" \\\\ ")} \\end{matrix}`;
    }
    case "eqArr": return `\\begin{aligned} ${anak(e, "e").map(isi).join(" \\\\ ")} \\end{aligned}`;
    case "box": case "borderBox": case "phant": case "e": case "num": case "den": case "sub": case "sup": case "deg": case "lim": case "fName": case "oMath":
      return isi(e);
    case "t": return teks(e.textContent ?? "", false); // w:t di dalam rumus
    default:
      // Properti (…Pr), w:rPr, bookmark, dsb. tidak menghasilkan teks.
      return /Pr$/.test(e.localName ?? "") ? "" : isi(e);
  }
}

export function ommlKeLatex(oMath: El): string {
  return isi(oMath).replace(/\s+/g, " ").trim();
}

/** Ganti semua rumus Word di .docx dengan teks `$…$`/`$$…$$`. Mengembalikan berkas baru + jumlah rumus. */
export async function gantiRumusWord(buf: Buffer): Promise<{ buf: Buffer; jumlah: number }> {
  const zip = await JSZip.loadAsync(buf);
  const f = zip.file("word/document.xml");
  if (!f) return { buf, jumlah: 0 };
  const xml = await f.async("string");
  if (!xml.includes("oMath")) return { buf, jumlah: 0 };
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  let jumlah = 0;

  const runTeks = (isiTeks: string) => {
    const r = doc.createElementNS(W, "w:r");
    const t = doc.createElementNS(W, "w:t");
    t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    t.appendChild(doc.createTextNode(isiTeks));
    r.appendChild(t);
    return r;
  };

  // Rumus berdiri sendiri (paragraf rumus) → $$…$$
  for (const para of Array.from(doc.getElementsByTagNameNS(M, "oMathPara"))) {
    const latex = anak(para as El, "oMath").map(ommlKeLatex).filter(Boolean).join(" \\\\ ");
    if (latex) { para.parentNode?.replaceChild(runTeks(` $$${latex}$$ `), para); jumlah++; }
    else para.parentNode?.removeChild(para);
  }
  // Rumus di dalam kalimat → $…$
  for (const om of Array.from(doc.getElementsByTagNameNS(M, "oMath"))) {
    const latex = ommlKeLatex(om as El);
    if (latex) { om.parentNode?.replaceChild(runTeks(`$${latex}$`), om); jumlah++; }
    else om.parentNode?.removeChild(om);
  }
  if (!jumlah) return { buf, jumlah: 0 };
  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
  return { buf: await zip.generateAsync({ type: "nodebuffer" }), jumlah };
}
