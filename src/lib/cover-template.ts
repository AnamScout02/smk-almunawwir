export type CoverField = "static" | "kelas" | "kompetensi" | "waliKelas" | "tahunSemester" | "tahunPelajaran" | "semester" | "bulan";

export interface CoverTextBox {
  id: string;
  field: CoverField;
  content: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  fontSize: number;
  color: string;
  bold: boolean;
  align: "left" | "center" | "right";
}

export interface CoverTemplate {
  imageUrl: string;
  texts: CoverTextBox[];
}

export const COVER_TEMPLATE_KEY = "absensi.cover_template";

export const FIELD_LABELS: Record<CoverField, string> = {
  static: "Teks Bebas",
  kelas: "Kelas",
  kompetensi: "Kompetensi Keahlian",
  waliKelas: "Wali Kelas",
  tahunSemester: "Tahun Pelajaran / Semester (gabungan)",
  tahunPelajaran: "Tahun Pelajaran",
  semester: "Semester",
  bulan: "Bulan",
};

export interface CoverFieldContext {
  kelas: string;
  kompetensi: string;
  waliKelas: string;
  tahunSemester: string;
  tahunPelajaran: string;
  semester: string;
  bulan: string;
}

export function resolveCoverText(box: CoverTextBox, ctx: CoverFieldContext): string {
  if (box.field === "static") return box.content;
  return ctx[box.field];
}

export const DEFAULT_WIDTH_PCT = 80;

export function defaultCoverTexts(): CoverTextBox[] {
  return [
    { id: "t1", field: "static", content: "BUKU ABSENSI KEHADIRAN & JURNAL MENGAJAR", xPct: 50, yPct: 18, widthPct: 90, fontSize: 22, color: "#0F1A45", bold: true, align: "center" },
    { id: "t2", field: "kelas", content: "", xPct: 50, yPct: 42, widthPct: 90, fontSize: 48, color: "#0F1A45", bold: true, align: "center" },
    { id: "t3", field: "kompetensi", content: "", xPct: 50, yPct: 54, widthPct: 80, fontSize: 16, color: "#374151", bold: false, align: "center" },
    { id: "t4", field: "waliKelas", content: "", xPct: 50, yPct: 62, widthPct: 80, fontSize: 16, color: "#374151", bold: false, align: "center" },
    { id: "t5", field: "tahunPelajaran", content: "", xPct: 50, yPct: 70, widthPct: 80, fontSize: 14, color: "#6B7280", bold: false, align: "center" },
    { id: "t6", field: "semester", content: "", xPct: 50, yPct: 76, widthPct: 80, fontSize: 14, color: "#6B7280", bold: false, align: "center" },
    { id: "t7", field: "bulan", content: "", xPct: 50, yPct: 82, widthPct: 80, fontSize: 12, color: "#9CA3AF", bold: false, align: "center" },
  ];
}
