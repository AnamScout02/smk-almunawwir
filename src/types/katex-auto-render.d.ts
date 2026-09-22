/** Tipe minimal untuk ekstensi auto-render KaTeX (paket katex tidak menyertakan tipe untuk
 * `katex/contrib/auto-render`). Dipakai src/components/ujian/HtmlSoal.tsx. */
declare module "katex/contrib/auto-render" {
  export interface PembatasRumus { left: string; right: string; display: boolean }
  export interface OpsiAutoRender {
    delimiters?: PembatasRumus[];
    ignoredTags?: string[];
    ignoredClasses?: string[];
    throwOnError?: boolean;
    errorColor?: string;
    macros?: Record<string, string>;
  }
  export default function renderMathInElement(element: HTMLElement, options?: OpsiAutoRender): void;
}

/** Ekstensi kimia KaTeX (\ce{…}, \pu{…}) — cukup dimuat, ia mendaftarkan makronya sendiri. */
declare module "katex/contrib/mhchem";
