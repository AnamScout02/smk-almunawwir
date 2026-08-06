"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Image from "@tiptap/extension-image";
import { Extension } from "@tiptap/core";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, Undo2, Redo2, Link2, Link2Off, Table as TableIcon, Eraser,
  Superscript as SuperscriptIcon, Subscript as SubscriptIcon, Palette, Highlighter, Plus, Minus, Trash2,
  Image as ImageIcon, Minus as HrIcon, Loader2, Rows3, Columns3, Search, X, ChevronDown, ChevronUp, Replace,
} from "lucide-react";

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() { return { types: ["textStyle"] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs: { fontSize?: string }) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {}),
        },
      },
    }];
  },
});

const FONT_SIZES = [
  { label: "Kecil", value: "11px" },
  { label: "Normal", value: "" },
  { label: "Sedang", value: "16px" },
  { label: "Besar", value: "20px" },
  { label: "Sangat Besar", value: "28px" },
];
// Galeri gaya terpadu (mirip dropdown "Styles" di Word/Google Docs) — satu pilihan langsung
// menerapkan block style yang sesuai (bukan cuma heading, tapi juga kutipan) dalam satu klik.
const STYLE_OPTIONS = [
  { key: "normal", label: "Normal" },
  { key: "h1", label: "Judul 1" },
  { key: "h2", label: "Judul 2" },
  { key: "h3", label: "Judul 3" },
  { key: "quote", label: "Kutipan" },
] as const;
type StyleKey = typeof STYLE_OPTIONS[number]["key"];
const TEXT_COLORS = ["#0F1A45", "#000000", "#DC2626", "#059669", "#2563EB", "#D97706"];
const HIGHLIGHT_COLORS = ["#FEF08A", "#BBF7D0", "#BFDBFE", "#FBCFE8", "#FDE68A"];
const TABS = ["Beranda", "Sisipkan"] as const;
type TabKey = typeof TABS[number];

// Tinggi area isi 1 halaman A4 (297mm) dikurangi margin 2cm atas+bawah, dikonversi ke px
// (96dpi) — dipakai murni sebagai PANDUAN VISUAL kapan konten akan pindah ke halaman baru
// saat dicetak. Bukan pagination sungguhan (konten tetap 1 blok mengalir), cuma garis putus-putus
// + label "Halaman N" supaya pengisi surat langsung kebayang panjang tiap halaman seperti di Word.
const PAGE_CONTENT_HEIGHT_PX = 971;

function ToolbarButton({ onClick, active, disabled, title, children }: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${active ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:bg-gray-100"}`}>
      {children}
    </button>
  );
}
function Divider() { return <div className="w-px h-6 bg-gray-200 mx-1 shrink-0" />; }
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-2">
      <div className="flex items-center gap-0.5">{children}</div>
      <p className="text-[9px] uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}

export default function RichTextEditor({ value, onChange, placeholder = "Tulis isi surat di sini...", toolbarSlot }: {
  value: string; onChange: (html: string) => void; placeholder?: string;
  /** Elemen DOM (dari parent, biasanya sticky di atas halaman) tempat toolbar dirender lewat portal —
      supaya toolbar benar-benar keluar dari "kertas surat", bukan cuma sticky di tempat lamanya. */
  toolbarSlot?: HTMLElement | null;
}) {
  const [tab, setTab] = useState<TabKey>("Beranda");
  const [showTextColor, setShowTextColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [matchInfo, setMatchInfo] = useState({ total: 0, current: 0 });
  const [pageBreaks, setPageBreaks] = useState<number[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const contentWrapRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // link & underline dinonaktifkan dari paket bawaan StarterKit (Tiptap v3) karena kita pakai
      // instance terpisah di bawah dengan konfigurasi custom — kalau tidak, muncul warning
      // "Duplicate extension names" karena dua-duanya terdaftar dengan nama yang sama.
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      TextAlign.configure({ types: ["paragraph", "heading"] }),
      Placeholder.configure({ placeholder }),
      TextStyle,
      FontSize,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: "text-primary-700 underline" } }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
      Subscript, Superscript,
      Image.configure({ HTMLAttributes: { class: "max-w-full rounded" } }),
    ],
    content: value,
    editorProps: {
      attributes: { class: "prose-surat focus:outline-none min-h-[280px] px-4 py-3 text-sm" },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      recomputePageBreaks();
    },
  });

  // Hitung ulang garis panduan halaman setiap kali tinggi konten berubah (termasuk saat gambar
  // selesai dimuat, yang mengubah tinggi tanpa memicu onUpdate teks).
  function recomputePageBreaks() {
    requestAnimationFrame(() => {
      const el = contentWrapRef.current;
      if (!el) return;
      const h = el.scrollHeight;
      const count = Math.max(0, Math.floor(h / PAGE_CONTENT_HEIGHT_PX));
      const breaks: number[] = [];
      for (let i = 1; i <= count; i++) breaks.push(i * PAGE_CONTENT_HEIGHT_PX);
      setPageBreaks(breaks);
    });
  }

  useEffect(() => {
    recomputePageBreaks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return <div className="border border-gray-200 rounded-xl min-h-[360px] bg-gray-50 animate-pulse" />;

  function currentStyle(): StyleKey {
    if (editor!.isActive("heading", { level: 1 })) return "h1";
    if (editor!.isActive("heading", { level: 2 })) return "h2";
    if (editor!.isActive("heading", { level: 3 })) return "h3";
    if (editor!.isActive("blockquote")) return "quote";
    return "normal";
  }
  function applyStyle(key: string) {
    const chain = editor!.chain().focus();
    if (editor!.isActive("blockquote")) chain.toggleBlockquote();
    switch (key as StyleKey) {
      case "normal": chain.setParagraph().run(); break;
      case "h1": chain.setParagraph().toggleHeading({ level: 1 }).run(); break;
      case "h2": chain.setParagraph().toggleHeading({ level: 2 }).run(); break;
      case "h3": chain.setParagraph().toggleHeading({ level: 3 }).run(); break;
      case "quote": chain.setParagraph().toggleBlockquote().run(); break;
    }
  }
  function setFontSize(v: string) {
    if (!v) editor!.chain().focus().unsetMark("textStyle").run();
    else editor!.chain().focus().setMark("textStyle", { fontSize: v }).run();
  }
  function setLink() {
    const prev = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("Masukkan URL tautan:", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) { editor!.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor!.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }
  function insertTable() {
    editor!.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }
  async function handleImageFile(file: File) {
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "surat");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal upload");
      editor!.chain().focus().setImage({ src: data.url }).run();
      setTimeout(recomputePageBreaks, 300);
    } catch {
      window.alert("Gagal mengunggah gambar.");
    } finally {
      setUploadingImage(false);
    }
  }

  // --- Cari & Ganti ---------------------------------------------------------------------
  // Cari semua kemunculan `query` di seluruh dokumen dengan posisi absolut ProseMirror yang
  // akurat (menelusuri tiap text node), bukan cuma cocokkan di getText() polos yang posisinya
  // bisa meleset dari posisi asli di dalam struktur dokumen (heading/tabel/dll).
  function findAllMatches(query: string): { from: number; to: number }[] {
    if (!query) return [];
    const results: { from: number; to: number }[] = [];
    const q = query.toLowerCase();
    editor!.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const text = node.text.toLowerCase();
      let idx = text.indexOf(q);
      while (idx !== -1) {
        results.push({ from: pos + idx, to: pos + idx + query.length });
        idx = text.indexOf(q, idx + 1);
      }
    });
    return results;
  }
  function selectMatch(m: { from: number; to: number }) {
    editor!.chain().focus().setTextSelection(m).scrollIntoView().run();
  }
  function findNext(dir: 1 | -1 = 1) {
    const matches = findAllMatches(findQuery);
    if (matches.length === 0) { setMatchInfo({ total: 0, current: 0 }); return; }
    const { from } = editor!.state.selection;
    let idx = matches.findIndex(m => m.from >= from);
    if (dir === 1) idx = idx === -1 ? 0 : (matches[idx].from === from ? (idx + 1) % matches.length : idx);
    else idx = (idx === -1 ? matches.length - 1 : idx - 1 + matches.length) % matches.length;
    selectMatch(matches[idx]);
    setMatchInfo({ total: matches.length, current: idx + 1 });
  }
  function replaceCurrent() {
    const { from, to } = editor!.state.selection;
    const selectedText = editor!.state.doc.textBetween(from, to);
    if (findQuery && selectedText.toLowerCase() === findQuery.toLowerCase()) {
      editor!.chain().focus().insertContentAt({ from, to }, replaceQuery).run();
    }
    findNext();
  }
  function replaceAll() {
    const matches = findAllMatches(findQuery);
    if (matches.length === 0) return;
    let chain = editor!.chain().focus();
    for (let i = matches.length - 1; i >= 0; i--) {
      chain = chain.insertContentAt({ from: matches[i].from, to: matches[i].to }, replaceQuery);
    }
    chain.run();
    setMatchInfo({ total: 0, current: 0 });
  }

  // Toolbar (tab bar + panel Cari&Ganti + ribbon) dirender lewat portal ke slot yang disediakan
  // parent (biasanya sticky, DI LUAR kertas surat) — supaya toolbar benar-benar jadi bar tersendiri
  // seperti ribbon Word/Google Docs, bukan kotak yang menempel di tengah halaman surat.
  const toolbarJsx = (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-md">
      {/* Tab bar navigasi ribbon — gaya Microsoft Word/Google Docs */}
      <div className="relative z-10 flex items-center gap-1 px-3 pt-2 bg-gray-50/70 border-b border-gray-100">
        {TABS.map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`relative px-3 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
              tab === t ? "bg-white text-primary-700 border-primary-600" : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-white/50"
            }`}>
            {t}
          </button>
        ))}
        <button type="button" onClick={() => setShowFind(s => !s)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${showFind ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:bg-white/70"}`}>
          <Search size={13} /> Cari &amp; Ganti
        </button>
      </div>

      {/* Panel Cari & Ganti */}
      {showFind && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-primary-50/60 border-b border-primary-100">
          <div className="flex items-center gap-1.5">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input value={findQuery} onChange={e => { setFindQuery(e.target.value); setMatchInfo({ total: 0, current: 0 }); }}
              onKeyDown={e => { if (e.key === "Enter") findNext(); }}
              placeholder="Cari kata..." className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-40" />
          </div>
          <div className="flex items-center gap-1.5">
            <Replace size={13} className="text-gray-400 shrink-0" />
            <input value={replaceQuery} onChange={e => setReplaceQuery(e.target.value)}
              placeholder="Ganti dengan..." className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-40" />
          </div>
          {matchInfo.total > 0 && <span className="text-[11px] text-gray-400 font-mono">{matchInfo.current}/{matchInfo.total}</span>}
          <button type="button" onClick={() => findNext(-1)} className="p-1.5 rounded-lg text-gray-500 hover:bg-white transition-colors" title="Sebelumnya"><ChevronUp size={14} /></button>
          <button type="button" onClick={() => findNext(1)} className="p-1.5 rounded-lg text-gray-500 hover:bg-white transition-colors" title="Berikutnya"><ChevronDown size={14} /></button>
          <button type="button" onClick={replaceCurrent} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-primary-700 hover:bg-white transition-colors">Ganti</button>
          <button type="button" onClick={replaceAll} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-primary-700 hover:bg-white transition-colors">Ganti Semua</button>
          <button type="button" onClick={() => setShowFind(false)} className="ml-auto p-1.5 rounded-lg text-gray-400 hover:bg-white transition-colors"><X size={14} /></button>
        </div>
      )}

      {/* Ribbon (isi tab) */}
      <div className="flex items-stretch gap-1 flex-wrap px-2 py-2 border-b border-gray-100 bg-white">
        {/* Undo/Redo selalu tampil, seperti Quick Access Toolbar */}
        <Group label="Aksi">
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Urungkan"><Undo2 size={15} /></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Ulangi"><Redo2 size={15} /></ToolbarButton>
        </Group>
        <Divider />

        {tab === "Beranda" && (
          <>
            <Group label="Gaya">
              <select onChange={e => applyStyle(e.target.value)} value={currentStyle()}
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white text-gray-600 shrink-0" title="Gaya Paragraf">
                {STYLE_OPTIONS.map(h => <option key={h.key} value={h.key}>{h.label}</option>)}
              </select>
              <select onChange={e => setFontSize(e.target.value)} defaultValue=""
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white text-gray-600 shrink-0" title="Ukuran Font">
                {FONT_SIZES.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
              </select>
            </Group>
            <Divider />

            <Group label="Huruf">
              <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Tebal"><Bold size={15} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Miring"><Italic size={15} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Garis bawah"><UnderlineIcon size={15} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Coret"><Strikethrough size={15} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive("superscript")} title="Superscript"><SuperscriptIcon size={15} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive("subscript")} title="Subscript"><SubscriptIcon size={15} /></ToolbarButton>
              <div className="relative">
                <ToolbarButton onClick={() => { setShowTextColor(s => !s); setShowHighlight(false); }} title="Warna Teks"><Palette size={15} /></ToolbarButton>
                {showTextColor && (
                  <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex gap-1">
                    {TEXT_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => { editor.chain().focus().setColor(c).run(); setShowTextColor(false); }}
                        className="w-5 h-5 rounded-full border border-gray-200" style={{ background: c }} title={c} />
                    ))}
                    <button type="button" onClick={() => { editor.chain().focus().unsetColor().run(); setShowTextColor(false); }}
                      className="w-5 h-5 rounded-full border border-gray-300 bg-white flex items-center justify-center" title="Hapus warna"><Eraser size={10} /></button>
                  </div>
                )}
              </div>
              <div className="relative">
                <ToolbarButton onClick={() => { setShowHighlight(s => !s); setShowTextColor(false); }} title="Highlight"><Highlighter size={15} /></ToolbarButton>
                {showHighlight && (
                  <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex gap-1">
                    {HIGHLIGHT_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setShowHighlight(false); }}
                        className="w-5 h-5 rounded-full border border-gray-200" style={{ background: c }} title={c} />
                    ))}
                    <button type="button" onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowHighlight(false); }}
                      className="w-5 h-5 rounded-full border border-gray-300 bg-white flex items-center justify-center" title="Hapus highlight"><Eraser size={10} /></button>
                  </div>
                )}
              </div>
              <ToolbarButton onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Bersihkan format"><Eraser size={15} /></ToolbarButton>
            </Group>
            <Divider />

            <Group label="Perataan">
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Rata kiri"><AlignLeft size={15} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Rata tengah"><AlignCenter size={15} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Rata kanan"><AlignRight size={15} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Rata kanan-kiri"><AlignJustify size={15} /></ToolbarButton>
            </Group>
            <Divider />

            <Group label="Paragraf">
              <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Daftar poin"><List size={15} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Daftar nomor"><ListOrdered size={15} /></ToolbarButton>
            </Group>
          </>
        )}

        {tab === "Sisipkan" && (
          <>
            <Group label="Tautan">
              <ToolbarButton onClick={setLink} active={editor.isActive("link")} title="Sisipkan tautan"><Link2 size={15} /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive("link")} title="Hapus tautan"><Link2Off size={15} /></ToolbarButton>
            </Group>
            <Divider />

            <Group label="Gambar">
              <ToolbarButton onClick={() => imageInputRef.current?.click()} disabled={uploadingImage} title="Sisipkan gambar">
                {uploadingImage ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
              </ToolbarButton>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }} />
            </Group>
            <Divider />

            <Group label="Tabel">
              <ToolbarButton onClick={insertTable} title="Sisipkan tabel"><TableIcon size={15} /></ToolbarButton>
              {editor.isActive("table") && (
                <>
                  <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Tambah kolom"><Columns3 size={15} /><Plus size={9} /></ToolbarButton>
                  <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Hapus kolom"><Columns3 size={15} /><Minus size={9} /></ToolbarButton>
                  <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Tambah baris"><Rows3 size={15} /><Plus size={9} /></ToolbarButton>
                  <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="Hapus baris"><Rows3 size={15} /><Minus size={9} /></ToolbarButton>
                  <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Hapus tabel"><Trash2 size={14} /></ToolbarButton>
                </>
              )}
            </Group>
            <Divider />

            <Group label="Lainnya">
              <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Garis pemisah"><HrIcon size={15} /></ToolbarButton>
            </Group>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {toolbarSlot ? createPortal(toolbarJsx, toolbarSlot) : toolbarJsx}
      <div ref={contentWrapRef} className="relative">
        <EditorContent editor={editor} />
        {/* Garis panduan visual pindah halaman — murni indikator, bukan pagination sungguhan */}
        {pageBreaks.map((top, i) => (
          <div key={top} className="absolute left-0 right-0 pointer-events-none flex items-center gap-2 px-4" style={{ top }}>
            <div className="flex-1 border-t-2 border-dashed border-gray-300" />
            <span className="text-[10px] font-semibold text-gray-400 bg-white px-1.5 whitespace-nowrap">Halaman {i + 2}</span>
            <div className="flex-1 border-t-2 border-dashed border-gray-300" />
          </div>
        ))}
      </div>
    </>
  );
}
