"use client";
import { useEffect, useState, type ChangeEvent } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BookMarked, Loader2, Plus, Edit2, Trash2, Save, CheckCircle2, Library, History, QrCode, Download, Upload, ScanLine, Search, IdCard, BookmarkPlus, ArrowRightCircle, Footprints } from "lucide-react";
import Image from "next/image";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Alert from "@/components/admin/Alert";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import DatePicker from "@/components/shared/DatePicker";
import ImageUpload from "@/components/admin/ImageUpload";
import FileUpload from "@/components/shared/FileUpload";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import { PageSkeleton } from "@/components/shared/Skeleton";

interface Book {
  id: string; title: string; author: string | null; publisher: string | null;
  category: string; stock: number; location: string | null; coverUrl: string | null;
  barcode: string | null; barcodeQr: string | null; fileUrl: string | null;
  borrowed: number; available: number;
}
interface ClassOption { id: string; name: string }
interface BorrowerOption { id: string; identifier: string; name: string; classId?: string | null; className?: string | null }
interface Borrowers { classes: ClassOption[]; students: BorrowerOption[]; teachers: BorrowerOption[]; staff: BorrowerOption[] }
type BorrowerType = "SISWA" | "GURU" | "PEGAWAI";
interface Loan {
  id: string; borrowDate: string; dueDate: string; returnDate: string | null; status: string; notes: string | null;
  isOverdue: boolean; daysLate: number; fineAmount: number; finePaid: boolean;
  book: { title: string; barcode: string | null };
  borrower: { name: string; type: BorrowerType; identifier: string; className: string | null };
}

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

interface Reservation {
  id: string; reservedDate: string; status: string; notes: string | null;
  book: { title: string; barcode: string | null; stock: number };
  borrower: { name: string; type: BorrowerType; identifier: string; className: string | null };
}

const BORROWER_TYPE_LABEL: Record<BorrowerType, string> = { SISWA: "Siswa", GURU: "Guru", PEGAWAI: "Pegawai" };

const TABS = [
  { key: "katalog", label: "Katalog Buku", icon: Library },
  { key: "peminjaman", label: "Peminjaman Aktif", icon: BookMarked },
  { key: "reservasi", label: "Reservasi", icon: BookmarkPlus },
  { key: "riwayat", label: "Riwayat", icon: History },
  { key: "kartu", label: "Kartu Anggota", icon: IdCard },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const EMPTY_BOOK_FORM = { title: "", author: "", publisher: "", category: "", stock: "1", location: "", coverUrl: "", barcode: "", fileUrl: "" };

function defaultDueDate(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const EMPTY_LOAN_FORM = { borrowerType: "SISWA" as BorrowerType, classId: "", borrowerId: "", bookId: "", dueDate: defaultDueDate(), notes: "" };
const EMPTY_RESERVATION_FORM = { borrowerType: "SISWA" as BorrowerType, classId: "", borrowerId: "", bookId: "", notes: "" };

function fmt(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function PerpustakaanManager() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const pathname = usePathname();
  const basePath = pathname?.startsWith("/dashboard/teacher") ? "/dashboard/teacher" : "/dashboard/admin";
  const [tab, setTab] = useState<TabKey>("katalog");
  const [books, setBooks] = useState<Book[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [borrowers, setBorrowers] = useState<Borrowers>({ classes: [], students: [], teachers: [], staff: [] });
  const [loading, setLoading] = useState(true);

  const [bookModal, setBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [bookForm, setBookForm] = useState(EMPTY_BOOK_FORM);
  const [bookError, setBookError] = useState("");
  const [savingBook, setSavingBook] = useState(false);

  const [loanModal, setLoanModal] = useState(false);
  const [loanForm, setLoanForm] = useState(EMPTY_LOAN_FORM);
  const [loanError, setLoanError] = useState("");
  const [savingLoan, setSavingLoan] = useState(false);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationModal, setReservationModal] = useState(false);
  const [reservationForm, setReservationForm] = useState(EMPTY_RESERVATION_FORM);
  const [reservationError, setReservationError] = useState("");
  const [savingReservation, setSavingReservation] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertDueDate, setConvertDueDate] = useState(defaultDueDate());

  const [barcodeBook, setBarcodeBook] = useState<Book | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [dendaPerHari, setDendaPerHari] = useState(0);
  const [dendaInput, setDendaInput] = useState("");
  const [savingDenda, setSavingDenda] = useState(false);
  const [masaPeminjamanHari, setMasaPeminjamanHari] = useState(7);
  const [masaInput, setMasaInput] = useState("7");
  const [savingMasa, setSavingMasa] = useState(false);
  const [visitScanInput, setVisitScanInput] = useState("");

  const [scanCardInput, setScanCardInput] = useState("");

  async function handleImportBooks(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImportLoading(true); setImportResult(null);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/perpustakaan/books/import", { method: "POST", body: fd });
    const data = await res.json();
    setImportResult(data); setImportLoading(false); loadAll();
    e.target.value = "";
  }

  function loadAll() {
    setLoading(true);
    Promise.all([
      fetch("/api/perpustakaan/books").then(r => r.json()).catch(() => {}),
      fetch("/api/perpustakaan/loans?status=active").then(r => r.json()).catch(() => {}),
      fetch("/api/perpustakaan/loans").then(r => r.json()).catch(() => {}),
      fetch("/api/perpustakaan/reservations").then(r => r.json()).catch(() => {}),
    ]).then(([b, active, all, res]) => {
      setBooks(Array.isArray(b) ? b : []);
      setActiveLoans(Array.isArray(active) ? active : []);
      setAllLoans(Array.isArray(all) ? all : []);
      setReservations(Array.isArray(res) ? res : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(() => {
    loadAll();
    fetch("/api/perpustakaan/borrowers").then(r => r.json())
      .then(d => setBorrowers({ classes: d.classes ?? [], students: d.students ?? [], teachers: d.teachers ?? [], staff: d.staff ?? [] }))
      .catch(() => {});
    fetch("/api/perpustakaan/settings").then(r => r.json())
      .then(d => {
        setDendaPerHari(d.dendaPerHari ?? 0); setDendaInput(String(d.dendaPerHari ?? 0));
        setMasaPeminjamanHari(d.masaPeminjamanHari ?? 7); setMasaInput(String(d.masaPeminjamanHari ?? 7));
      })
      .catch(() => {});
  }, []);

  async function handleSaveDenda() {
    const val = Number(dendaInput);
    if (isNaN(val) || val < 0) return;
    setSavingDenda(true);
    const res = await fetch("/api/perpustakaan/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dendaPerHari: val }) });
    setSavingDenda(false);
    if (res.ok) { setDendaPerHari(val); loadAll(); }
  }

  async function handleSaveMasa() {
    const val = Number(masaInput);
    if (isNaN(val) || val < 1) return;
    setSavingMasa(true);
    const res = await fetch("/api/perpustakaan/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ masaPeminjamanHari: val }) });
    setSavingMasa(false);
    if (res.ok) setMasaPeminjamanHari(val);
  }

  async function handleMarkPaid(loan: Loan) {
    await fetch(`/api/perpustakaan/loans/${loan.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "MARK_PAID" }) });
    loadAll();
  }


  function handleScanCard(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = scanCardInput.trim();
    setScanCardInput("");
    if (!code) return;
    const student = borrowers.students.find(s => s.identifier === code);
    const teacher = borrowers.teachers.find(t => t.identifier === code);
    const staff = borrowers.staff.find(s => s.identifier === code);
    if (student) {
      setLoanForm(p => ({ ...p, borrowerType: "SISWA", classId: student.classId ?? "", borrowerId: student.id }));
      setLoanError("");
    } else if (teacher) {
      setLoanForm(p => ({ ...p, borrowerType: "GURU", classId: "", borrowerId: teacher.id }));
      setLoanError("");
    } else if (staff) {
      setLoanForm(p => ({ ...p, borrowerType: "PEGAWAI", classId: "", borrowerId: staff.id }));
      setLoanError("");
    } else {
      setLoanError(`Kartu "${code}" tidak dikenali.`);
    }
  }

  async function handleScanVisit(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = visitScanInput.trim();
    setVisitScanInput("");
    if (!code) return;
    const student = borrowers.students.find(s => s.identifier === code);
    const teacher = borrowers.teachers.find(t => t.identifier === code);
    const staff = borrowers.staff.find(s => s.identifier === code);
    const found = student ?? teacher ?? staff;
    if (!found) { toast.error(`Kartu "${code}" tidak dikenali.`); return; }
    const res = await fetch("/api/perpustakaan/visits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: found.id }) });
    const d = await res.json();
    if (res.ok) toast.success(`Kunjungan tercatat: ${d.name}`);
    else toast.error(d.error || "Gagal mencatat kunjungan");
  }

  function openAddBook() { setEditingBook(null); setBookForm(EMPTY_BOOK_FORM); setBookError(""); setBookModal(true); }
  function openEditBook(b: Book) {
    setEditingBook(b);
    setBookForm({ title: b.title, author: b.author ?? "", publisher: b.publisher ?? "", category: b.category, stock: String(b.stock), location: b.location ?? "", coverUrl: b.coverUrl ?? "", barcode: b.barcode ?? "", fileUrl: b.fileUrl ?? "" });
    setBookError(""); setBookModal(true);
  }
  async function handleSaveBook() {
    if (!bookForm.title.trim() || !bookForm.category.trim()) { setBookError("Judul dan kategori wajib diisi."); return; }
    setSavingBook(true);
    const res = editingBook
      ? await fetch(`/api/perpustakaan/books/${editingBook.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bookForm) })
      : await fetch("/api/perpustakaan/books", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bookForm) });
    setSavingBook(false);
    if (!res.ok) { const d = await res.json(); setBookError(d.error || "Gagal menyimpan"); return; }
    setBookModal(false);
    loadAll();
  }
  async function handleDeleteBook(b: Book) {
    if (!(await confirmDialog(`Hapus buku "${b.title}" dari katalog?`))) return;
    await fetch(`/api/perpustakaan/books/${b.id}`, { method: "DELETE" });
    loadAll();
  }

  function openLoan() { setLoanForm({ ...EMPTY_LOAN_FORM, dueDate: defaultDueDate(masaPeminjamanHari) }); setLoanError(""); setScanInput(""); setScanCardInput(""); setLoanModal(true); }

  function handleScanBook(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = scanInput.trim();
    setScanInput("");
    if (!code) return;
    const found = books.find(b => b.barcode === code);
    if (!found) { setLoanError(`Barcode "${code}" tidak ditemukan di katalog.`); return; }
    if (found.available <= 0) { setLoanError(`"${found.title}" sedang tidak ada stok tersedia.`); return; }
    setLoanForm(p => ({ ...p, bookId: found.id }));
    setLoanError("");
  }
  async function handleSaveLoan() {
    if (!loanForm.borrowerId || !loanForm.bookId) { setLoanError("Peminjam dan buku wajib dipilih."); return; }
    setSavingLoan(true);
    const res = await fetch("/api/perpustakaan/loans", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ borrowerId: loanForm.borrowerId, bookId: loanForm.bookId, dueDate: loanForm.dueDate, notes: loanForm.notes }),
    });
    setSavingLoan(false);
    if (!res.ok) { const d = await res.json(); setLoanError(d.error || "Gagal menyimpan"); return; }
    setLoanModal(false);
    loadAll();
  }
  async function handleReturn(loan: Loan) {
    await fetch(`/api/perpustakaan/loans/${loan.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "RETURN" }) });
    loadAll();
  }

  function openReservation() { setReservationForm(EMPTY_RESERVATION_FORM); setReservationError(""); setReservationModal(true); }
  async function handleSaveReservation() {
    if (!reservationForm.borrowerId || !reservationForm.bookId) { setReservationError("Peminjam dan buku wajib dipilih."); return; }
    setSavingReservation(true);
    const res = await fetch("/api/perpustakaan/reservations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ borrowerId: reservationForm.borrowerId, bookId: reservationForm.bookId, notes: reservationForm.notes }),
    });
    setSavingReservation(false);
    if (!res.ok) { const d = await res.json(); setReservationError(d.error || "Gagal menyimpan"); return; }
    setReservationModal(false);
    loadAll();
  }
  async function handleCancelReservation(r: Reservation) {
    if (!(await confirmDialog(`Batalkan reservasi "${r.book.title}" oleh ${r.borrower.name}?`))) return;
    await fetch(`/api/perpustakaan/reservations/${r.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "DIBATALKAN" }) });
    loadAll();
  }
  async function handleConvertReservation(id: string) {
    const res = await fetch(`/api/perpustakaan/reservations/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CONVERT", dueDate: convertDueDate }),
    });
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal memproses"); return; }
    toast.success("Reservasi berhasil dipinjamkan.");
    setConvertingId(null);
    loadAll();
  }

  const totalTitles = books.length;
  const totalStock = books.reduce((a, b) => a + b.stock, 0);
  const totalBorrowed = books.reduce((a, b) => a + b.borrowed, 0);

  return (
    <>
    <div className="p-6 lg:p-8 print:hidden">
      <PageHeader
        icon={<BookMarked size={22} />}
        title="Perpustakaan"
        description="Katalog buku, peminjaman, dan riwayat sirkulasi"
      />

      <div className="flex flex-wrap justify-end gap-2 mb-5">
        {tab === "katalog" ? (
          <>
            <a href={`${basePath}/perpustakaan/cetak-barcode`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-100 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap">
              <QrCode size={15} /> Cetak Semua Barcode
            </a>
            <a href="/api/perpustakaan/books/template"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-100 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap">
              <Download size={15} /> Template
            </a>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-100 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer">
              <Upload size={15} /> {importLoading ? "Mengimpor..." : "Import Excel"}
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportBooks} disabled={importLoading} />
            </label>
            <button onClick={openAddBook} className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-primary-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
              <Plus size={15} /> Tambah Buku
            </button>
          </>
        ) : tab === "peminjaman" ? (
          <button onClick={openLoan} className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-primary-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
            <Plus size={15} /> Pinjamkan Buku
          </button>
        ) : tab === "reservasi" ? (
          <button onClick={openReservation} className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-primary-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
            <Plus size={15} /> Reservasi Baru
          </button>
        ) : null}
      </div>

      {tab === "katalog" && importResult && (
        <Alert variant={importResult.errors.length > 0 ? "warning" : "success"} className="mb-4"
          title={`Hasil import: ${importResult.created} dibuat, ${importResult.updated} diperbarui`}>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 text-red-600 text-xs list-disc list-inside">
              {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              {importResult.errors.length > 5 && <li>...dan {importResult.errors.length - 5} error lainnya</li>}
            </ul>
          )}
        </Alert>
      )}

      {!loading && tab === "katalog" && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatTile color="primary" value={totalTitles} label="Total Judul" icon={Library} />
          <StatTile color="blue" value={totalStock} label="Total Eksemplar" icon={BookMarked} />
          <StatTile color="amber" value={totalBorrowed} label="Sedang Dipinjam" icon={CheckCircle2} />
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3 mb-5">
        <Footprints size={16} className="text-primary-700 shrink-0" />
        <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">Catat Kunjungan:</span>
        <input value={visitScanInput} onChange={e => setVisitScanInput(e.target.value)} onKeyDown={handleScanVisit}
          placeholder="Scan/ketik NIS, NIP, atau ID kartu lalu Enter — untuk kunjungan yang tidak pinjam buku..."
          className="input-field flex-1 py-1.5 text-sm min-w-0" />
      </div>

      {loading ? (
        <PageSkeleton />
      ) : tab === "katalog" ? (
        <>
          {books.length === 0 ? (
            <EmptyState icon={Library} title="Belum Ada Buku" description="Tambahkan buku ke katalog perpustakaan." />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                      {["Judul", "Penulis", "Kategori", "Barcode", "Stok", "Tersedia", "Lokasi", ""].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {books.map(b => (
                      <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {b.coverUrl ? (
                              <Image src={b.coverUrl} alt={b.title} width={32} height={44} className="rounded object-cover shrink-0 w-8 h-11" unoptimized />
                            ) : (
                              <div className="w-8 h-11 rounded bg-gray-100 flex items-center justify-center shrink-0">
                                <Library size={14} className="text-gray-300" />
                              </div>
                            )}
                            <span className="font-semibold text-primary-900">{b.title}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs">{b.author || "-"}</td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{b.category}</td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs font-mono whitespace-nowrap">{b.barcode || "-"}</td>
                        <td className="px-5 py-3.5 text-center text-gray-600">{b.stock}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`font-bold ${b.available > 0 ? "text-emerald-600" : "text-red-500"}`}>{b.available}</span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{b.location || "-"}</td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          {b.fileUrl && (
                            <a href={b.fileUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition" title="Unduh File Digital">
                              <Download size={14} />
                            </a>
                          )}
                          {b.barcode && (
                            <button onClick={() => setBarcodeBook(b)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition" title="Lihat/Cetak Barcode">
                              <QrCode size={14} />
                            </button>
                          )}
                          <button onClick={() => openEditBook(b)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition" title="Ubah">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteBook(b)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition" title="Hapus">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : tab === "peminjaman" ? (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-gray-500">Denda keterlambatan:</span>
            <span className="text-xs text-gray-400">Rp</span>
            <input type="number" min={0} value={dendaInput} onChange={e => setDendaInput(e.target.value)}
              className="input-field w-28 py-1.5 text-sm" />
            <span className="text-xs text-gray-400">/ hari</span>
            <button onClick={handleSaveDenda} disabled={savingDenda || Number(dendaInput) === dendaPerHari}
              className="text-xs font-semibold text-primary-700 hover:text-primary-900 disabled:opacity-40 disabled:cursor-not-allowed">
              {savingDenda ? "Menyimpan..." : "Simpan"}
            </button>
            <span className="w-px h-4 bg-gray-200 mx-1" />
            <span className="text-xs font-semibold text-gray-500">Masa peminjaman:</span>
            <input type="number" min={1} value={masaInput} onChange={e => setMasaInput(e.target.value)}
              className="input-field w-20 py-1.5 text-sm" />
            <span className="text-xs text-gray-400">hari</span>
            <button onClick={handleSaveMasa} disabled={savingMasa || Number(masaInput) === masaPeminjamanHari}
              className="text-xs font-semibold text-primary-700 hover:text-primary-900 disabled:opacity-40 disabled:cursor-not-allowed">
              {savingMasa ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
          {activeLoans.length === 0 ? (
            <EmptyState icon={BookMarked} title="Tidak Ada Peminjaman Aktif" description="Semua buku sudah dikembalikan." />
          ) : (
            <>
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={activeSearch} onChange={e => setActiveSearch(e.target.value)}
                  placeholder="Scan barcode buku atau cari nama peminjam/judul..."
                  className="input-field pl-10 font-mono" />
              </div>
              {(() => {
                const q = activeSearch.trim().toLowerCase();
                const filteredActive = activeLoans.filter(l =>
                  !q || l.book.barcode === activeSearch.trim() || l.book.title.toLowerCase().includes(q) ||
                  l.borrower.name.toLowerCase().includes(q) || l.borrower.identifier.toLowerCase().includes(q)
                );
                return filteredActive.length === 0 ? (
                  <EmptyState icon={BookMarked} title="Tidak ada yang cocok" description="Coba kata kunci lain atau scan ulang." />
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                            {["Siswa", "Buku", "Tgl Pinjam", "Jatuh Tempo", "Status", "Denda", ""].map(h => (
                              <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredActive.map(l => (
                            <tr key={l.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                              <td className="px-5 py-3.5">
                                <p className="font-semibold text-primary-900">{l.borrower.name}</p>
                                <p className="text-gray-400 text-xs">{l.borrower.className ?? BORROWER_TYPE_LABEL[l.borrower.type]} · {l.borrower.identifier}</p>
                              </td>
                              <td className="px-5 py-3.5 text-gray-600">{l.book.title}</td>
                              <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{fmt(l.borrowDate)}</td>
                              <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{fmt(l.dueDate)}</td>
                              <td className="px-5 py-3.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${l.isOverdue ? "bg-red-50 text-red-600 border border-red-200" : "bg-blue-50 text-blue-600 border border-blue-200"}`}>
                                  {l.isOverdue ? "Terlambat" : "Dipinjam"}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                                {l.fineAmount > 0 ? <span className="text-red-600 font-semibold">{fmtRupiah(l.fineAmount)}</span> : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                <button onClick={() => handleReturn(l)}
                                  className="text-xs font-semibold text-primary-700 hover:text-gold transition-colors">
                                  Kembalikan
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      ) : tab === "reservasi" ? (
        reservations.length === 0 ? (
          <EmptyState icon={BookmarkPlus} title="Tidak Ada Reservasi" description="Catat reservasi untuk buku yang sedang habis dipinjam — petugas bisa proses saat eksemplarnya kembali." />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                    {["Peminjam", "Buku", "Tgl Reservasi", "Tersedia?", ""].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reservations.map(r => (
                    <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-primary-900">{r.borrower.name}</p>
                        <p className="text-gray-400 text-xs">{r.borrower.className ?? BORROWER_TYPE_LABEL[r.borrower.type]} · {r.borrower.identifier}</p>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{r.book.title}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{fmt(r.reservedDate)}</td>
                      <td className="px-5 py-3.5">
                        {(() => {
                          const book = books.find(b => b.title === r.book.title);
                          const available = book ? book.available : 0;
                          return available > 0 ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Tersedia ({available})</span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">Belum Tersedia</span>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {convertingId === r.id ? (
                          <div className="flex items-center gap-2 justify-end">
                            <DatePicker value={convertDueDate} onChange={setConvertDueDate} />
                            <button onClick={() => handleConvertReservation(r.id)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-800">Konfirmasi</button>
                            <button onClick={() => setConvertingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Batal</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => { setConvertingId(r.id); setConvertDueDate(defaultDueDate(masaPeminjamanHari)); }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-gold transition-colors">
                              <ArrowRightCircle size={13} /> Pinjamkan
                            </button>
                            <button onClick={() => handleCancelReservation(r)} className="text-xs font-semibold text-red-500 hover:text-red-700">Batalkan</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : tab === "riwayat" ? (
        allLoans.length === 0 ? (
          <EmptyState icon={History} title="Belum Ada Riwayat" description="Riwayat peminjaman akan tampil di sini." />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                    {["Siswa", "Buku", "Tgl Pinjam", "Jatuh Tempo", "Tgl Kembali", "Status", "Denda"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allLoans.map(l => (
                    <tr key={l.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-primary-900">{l.borrower.name}</p>
                        <p className="text-gray-400 text-xs">{l.borrower.className ?? BORROWER_TYPE_LABEL[l.borrower.type]} · {l.borrower.identifier}</p>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{l.book.title}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{fmt(l.borrowDate)}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{fmt(l.dueDate)}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{l.returnDate ? fmt(l.returnDate) : "-"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          l.status === "DIKEMBALIKAN" ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : l.isOverdue ? "bg-red-50 text-red-600 border border-red-200" : "bg-blue-50 text-blue-600 border border-blue-200"
                        }`}>
                          {l.status === "DIKEMBALIKAN" ? "Dikembalikan" : l.isOverdue ? "Terlambat" : "Dipinjam"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                        {l.fineAmount > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-red-600 font-semibold">{fmtRupiah(l.fineAmount)}</span>
                            {l.finePaid ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Lunas</span>
                            ) : (
                              <button onClick={() => handleMarkPaid(l)} className="text-[10px] font-semibold text-primary-600 hover:text-primary-800 underline">
                                Tandai Lunas
                              </button>
                            )}
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 text-gray-400">
          <IdCard size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-500">Sudah Pindah ke Kartu Tanda</p>
          <p className="text-sm mt-1 max-w-md mx-auto">Cetak kartu anggota (siswa/guru/pegawai) sekarang jadi satu di halaman Kartu Tanda — kartu identitas resmi sekolah yang QR-nya tetap bisa dipakai scan di Perpustakaan.</p>
          <Link href="/dashboard/admin/kartu-tanda" className="btn-gold inline-flex items-center gap-2 text-sm mt-4">
            <IdCard size={16} /> Buka Kartu Tanda
          </Link>
        </div>
      )}

      <Modal scrollBody
        open={bookModal}
        onClose={() => setBookModal(false)}
        title={editingBook ? "Ubah Buku" : "Tambah Buku"}
        footer={
          <>
            <button type="button" onClick={() => setBookModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={handleSaveBook} disabled={savingBook} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {savingBook ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {bookError && <p className="error-msg mb-3">{bookError}</p>}
        <div className="space-y-3">
          <ImageUpload value={bookForm.coverUrl} onChange={v => setBookForm(p => ({ ...p, coverUrl: v }))}
            folder="perpustakaan" label="Foto Sampul Buku" aspect="portrait" />
          <div>
            <label className="label-field">Judul Buku</label>
            <input value={bookForm.title} onChange={e => setBookForm(p => ({ ...p, title: e.target.value }))} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Penulis</label>
              <input value={bookForm.author} onChange={e => setBookForm(p => ({ ...p, author: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label-field">Penerbit</label>
              <input value={bookForm.publisher} onChange={e => setBookForm(p => ({ ...p, publisher: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Kategori</label>
              <input value={bookForm.category} onChange={e => setBookForm(p => ({ ...p, category: e.target.value }))} placeholder="cth: Fiksi" className="input-field" />
            </div>
            <div>
              <label className="label-field">Stok (Eksemplar)</label>
              <input type="number" min={0} value={bookForm.stock} onChange={e => setBookForm(p => ({ ...p, stock: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Lokasi/Rak (opsional)</label>
              <input value={bookForm.location} onChange={e => setBookForm(p => ({ ...p, location: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label-field">Barcode (opsional)</label>
              <input value={bookForm.barcode} onChange={e => setBookForm(p => ({ ...p, barcode: e.target.value }))}
                placeholder="Kosongkan = dibuat otomatis" className="input-field" />
            </div>
          </div>
          <FileUpload value={bookForm.fileUrl} onChange={v => setBookForm(p => ({ ...p, fileUrl: v }))}
            folder="perpustakaan/ebook" label="File Digital (PDF, opsional)" accept="application/pdf" hint="PDF — maks. 5MB, untuk modul/e-book" />
        </div>
      </Modal>

      <Modal scrollBody
        open={loanModal}
        onClose={() => setLoanModal(false)}
        title="Pinjamkan Buku"
        footer={
          <>
            <button type="button" onClick={() => setLoanModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={handleSaveLoan} disabled={savingLoan} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {savingLoan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {loanError && <p className="error-msg mb-3">{loanError}</p>}
        <div className="space-y-3">
          <div>
            <label className="label-field flex items-center gap-1.5"><IdCard size={13} /> Scan Kartu Anggota (opsional)</label>
            <input autoFocus value={scanCardInput} onChange={e => setScanCardInput(e.target.value)} onKeyDown={handleScanCard}
              className="input-field font-mono" placeholder="Scan kartu siswa/guru/pegawai untuk isi otomatis..." />
          </div>
          <div>
            <label className="label-field flex items-center gap-1.5"><ScanLine size={13} /> Scan Barcode Buku (opsional)</label>
            <input value={scanInput} onChange={e => setScanInput(e.target.value)} onKeyDown={handleScanBook}
              className="input-field font-mono" placeholder="Arahkan scanner ke sini, atau ketik barcode lalu Enter..." />
          </div>
          <div>
            <label className="label-field">Jenis Peminjam</label>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(["SISWA", "GURU", "PEGAWAI"] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setLoanForm(p => ({ ...p, borrowerType: t, classId: "", borrowerId: "" }))}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${loanForm.borrowerType === t ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
                  {BORROWER_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          {loanForm.borrowerType === "SISWA" && (
            <div>
              <label className="label-field">Kelas</label>
              <Select value={loanForm.classId} onChange={v => setLoanForm(p => ({ ...p, classId: v, borrowerId: "" }))}
                options={borrowers.classes.map(c => ({ value: c.id, label: c.name }))} placeholder="— Pilih Kelas —" />
            </div>
          )}
          <div>
            <label className="label-field">{BORROWER_TYPE_LABEL[loanForm.borrowerType]}</label>
            <Select value={loanForm.borrowerId} onChange={v => setLoanForm(p => ({ ...p, borrowerId: v }))}
              options={(
                loanForm.borrowerType === "SISWA"
                  ? borrowers.students.filter(s => !loanForm.classId || s.classId === loanForm.classId)
                  : loanForm.borrowerType === "GURU" ? borrowers.teachers : borrowers.staff
              ).map(p => ({ value: p.id, label: p.identifier !== "-" ? `${p.name} (${p.identifier})` : p.name }))}
              placeholder={`— Pilih ${BORROWER_TYPE_LABEL[loanForm.borrowerType]} —`} />
          </div>
          <div>
            <label className="label-field">Buku</label>
            <Select value={loanForm.bookId} onChange={v => setLoanForm(p => ({ ...p, bookId: v }))}
              options={books.filter(b => b.available > 0).map(b => ({ value: b.id, label: `${b.title}${b.barcode ? ` [${b.barcode}]` : ""} (tersedia ${b.available})` }))}
              placeholder="— Pilih Buku —" />
          </div>
          <div>
            <label className="label-field">Jatuh Tempo</label>
            <DatePicker value={loanForm.dueDate} onChange={v => setLoanForm(p => ({ ...p, dueDate: v }))} />
          </div>
          <div>
            <label className="label-field">Catatan (opsional)</label>
            <textarea value={loanForm.notes} onChange={e => setLoanForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="input-field resize-none" />
          </div>
        </div>
      </Modal>

      <Modal
        open={reservationModal}
        onClose={() => setReservationModal(false)}
        title="Reservasi Buku"
        footer={
          <>
            <button type="button" onClick={() => setReservationModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={handleSaveReservation} disabled={savingReservation} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {savingReservation ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {reservationError && <p className="error-msg mb-3">{reservationError}</p>}
        <div className="space-y-3">
          <div>
            <label className="label-field">Jenis Peminjam</label>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(["SISWA", "GURU", "PEGAWAI"] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setReservationForm(p => ({ ...p, borrowerType: t, classId: "", borrowerId: "" }))}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${reservationForm.borrowerType === t ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
                  {BORROWER_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          {reservationForm.borrowerType === "SISWA" && (
            <div>
              <label className="label-field">Kelas</label>
              <Select value={reservationForm.classId} onChange={v => setReservationForm(p => ({ ...p, classId: v, borrowerId: "" }))}
                options={borrowers.classes.map(c => ({ value: c.id, label: c.name }))} placeholder="— Pilih Kelas —" />
            </div>
          )}
          <div>
            <label className="label-field">{BORROWER_TYPE_LABEL[reservationForm.borrowerType]}</label>
            <Select value={reservationForm.borrowerId} onChange={v => setReservationForm(p => ({ ...p, borrowerId: v }))}
              options={(
                reservationForm.borrowerType === "SISWA"
                  ? borrowers.students.filter(s => !reservationForm.classId || s.classId === reservationForm.classId)
                  : reservationForm.borrowerType === "GURU" ? borrowers.teachers : borrowers.staff
              ).map(p => ({ value: p.id, label: p.identifier !== "-" ? `${p.name} (${p.identifier})` : p.name }))}
              placeholder={`— Pilih ${BORROWER_TYPE_LABEL[reservationForm.borrowerType]} —`} />
          </div>
          <div>
            <label className="label-field">Buku</label>
            <Select value={reservationForm.bookId} onChange={v => setReservationForm(p => ({ ...p, bookId: v }))}
              options={books.map(b => ({ value: b.id, label: `${b.title} (tersedia ${b.available})` }))}
              placeholder="— Pilih Buku —" />
          </div>
          <div>
            <label className="label-field">Catatan (opsional)</label>
            <textarea value={reservationForm.notes} onChange={e => setReservationForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="input-field resize-none" />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!barcodeBook}
        onClose={() => setBarcodeBook(null)}
        title="Barcode Buku"
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setBarcodeBook(null)} className="btn-modal-cancel flex-1">Tutup</button>
            <button type="button" onClick={() => window.print()} className="btn-modal-save flex-1">Cetak Label</button>
          </>
        }
      >
        {barcodeBook && (
          <div className="text-center">
            <p className="font-semibold text-primary-900 mb-1">{barcodeBook.title}</p>
            {barcodeBook.barcodeQr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={barcodeBook.barcodeQr} alt="Barcode" className="mx-auto w-40 h-40" />
            )}
            <p className="font-mono text-sm text-gray-500 mt-1">{barcodeBook.barcode}</p>
          </div>
        )}
      </Modal>
    </div>

    {barcodeBook && (
      <div className="hidden print:flex print:flex-col print:items-center print:justify-center print:min-h-screen">
        <p className="font-bold text-lg mb-2">{barcodeBook.title}</p>
        {barcodeBook.barcodeQr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={barcodeBook.barcodeQr} alt="Barcode" className="w-56 h-56" />
        )}
        <p className="font-mono text-base mt-2">{barcodeBook.barcode}</p>
      </div>
    )}

    </>
  );
}
