"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, Edit2, Trash2, Save, Eye, EyeOff, Loader2, UserCog, ShieldCheck, GraduationCap, Users, Award, ClipboardList, Printer, LogIn } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import GroupedSection from "@/components/admin/GroupedSection";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";

interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT" | "TAS";
  createdAt: string;
  staffJabatan: { jabatan: { id: string; name: string } }[];
}

interface JabatanOption { id: string; name: string }

interface Major { id: string; name: string; code: string }
interface ClassItem { id: string; name: string; grade: number }

interface FormState {
  id?: string;
  name: string; email: string; password: string;
  role: "ADMIN" | "TEACHER" | "STUDENT" | "TAS";
  // guru
  nip: string; subject: string; phone: string;
  // siswa
  nis: string; nisn: string; majorId: string; classId: string;
}

const emptyForm: FormState = {
  name: "", email: "", password: "", role: "STUDENT",
  nip: "", subject: "", phone: "",
  nis: "", nisn: "", majorId: "", classId: "",
};

export default function UsersPage() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [search, setSearch] = useState("");
  const [fPeran, setFPeran] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [jabatanOptions, setJabatanOptions] = useState<JabatanOption[]>([]);
  const [jabatanModal, setJabatanModal] = useState<User | null>(null);
  const [selectedJabatanIds, setSelectedJabatanIds] = useState<string[]>([]);
  const [savingJabatan, setSavingJabatan] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  async function fetchUsers() {
    setLoading(true);
    try {
      const [uRes, optRes, clsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/classes/options"),
        fetch("/api/admin/classes"),
      ]);
      if (uRes.ok) setUsers(await uRes.json());
      if (optRes.ok) { const { majors: m } = await optRes.json(); setMajors(m); }
      if (clsRes.ok) setClasses(await clsRes.json());
    } catch {
      // biarkan state lama tetap tampil kalau gagal, jangan sampai spinner macet
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
    fetch("/api/admin/jabatan").then(r => r.json()).then(d => { if (Array.isArray(d)) setJabatanOptions(d); }).catch(() => {});
    // Tombol "Masuk sebagai" cuma utk ADMIN sungguhan — TAS/guru-TU bisa buka halaman ini
    // (verifyTasAccess) tapi impersonasi dibatasi lebih ketat, lihat impersonate/route.ts.
    fetch("/api/admin/session-role").then(r => r.json()).then(d => setIsSuperAdmin(d.role === "ADMIN")).catch(() => {});
  }, []);

  async function handleImpersonate(id: string, name: string) {
    if (!await confirmDialog(`Masuk sebagai akun "${name}"? Anda akan login sebagai akun ini sampai memilih "Kembali ke Akun Admin".`)) return;
    setImpersonatingId(id);
    const res = await fetch(`/api/admin/users/${id}/impersonate`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setImpersonatingId(null); toast.error(data.error || "Gagal masuk sebagai akun ini."); return; }
    window.location.href = data.redirectTo || "/dashboard/admin";
  }

  function openJabatan(u: User) {
    setJabatanModal(u);
    setSelectedJabatanIds(u.staffJabatan.map(j => j.jabatan.id));
  }
  function toggleJabatan(id: string) {
    setSelectedJabatanIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  /* Balasan WAJIB diperiksa. Sebelumnya hasilnya diabaikan: bila simpan gagal — misalnya karena
     aplikasi sedang restart saat deploy — modal tetap menutup dan petugas mengira jabatan sudah
     tersimpan, padahal tidak. Untuk perubahan HAK AKSES gagal diam-diam adalah yang paling buruk:
     orangnya tetap tidak punya menu dan tidak ada yang tahu kenapa (kejadian nyata 28 Sep 2026). */
  async function saveJabatan() {
    if (!jabatanModal) return;
    const nama = jabatanModal.name;
    setSavingJabatan(true);
    const res = await fetch(`/api/admin/users/${jabatanModal.id}/jabatan`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jabatanIds: selectedJabatanIds }),
    }).catch(() => null);
    setSavingJabatan(false);
    if (!res?.ok) {
      const d = await res?.json().catch(() => null);
      toast.error(d?.error || "Gagal menyimpan jabatan — coba lagi.");
      return; // modal SENGAJA dibiarkan terbuka supaya centangnya tidak hilang
    }
    setJabatanModal(null);
    toast.success(`Jabatan ${nama} tersimpan.`);
    fetchUsers();
  }

  /* Daftar akun memuat SELURUH peran sekaligus (siswa jauh terbanyak) — saringan peran membuat
     satu kelompok bisa dilihat sendiri (permintaan user 29 September 2026). */
  const filtered = users.filter(u =>
    (u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    && (!fPeran || u.role === fPeran)
  );

  function openCreate() { setForm({ ...emptyForm, majorId: majors[0]?.id ?? "" }); setError(""); setModal(true); }
  function openEdit(u: User) { setForm({ ...emptyForm, id: u.id, name: u.name, email: u.email, role: u.role }); setError(""); setModal(true); }

  // Username (email login) & password login siswa baru otomatis dari NIS — BUKAN lagi dari NISN
  // (keputusan eksplisit user 2026-08-09: NISN belum semua siswa punya, NIS dipakai sbg satu-
  // satunya basis identitas login yang konsisten). Email = NIS disaring dari simbol "/" "."
  // (tidak valid utk email). Cuma isi kalau field masih kosong.
  useEffect(() => {
    if (form.id || form.role !== "STUDENT" || !form.nis) return;
    setForm(p => {
      if (p.email && p.password) return p;
      const emailLocal = p.nis.replace(/[^a-zA-Z0-9]/g, "");
      return {
        ...p,
        email: p.email || (emailLocal ? `${emailLocal}@smkalmunawwir.sch.id` : p.email),
        password: p.password || "Almunawwir1",
      };
    });
  }, [form.id, form.role, form.nis]);

  // NIP guru baru: belum ada satupun NIP asli (18 digit) — semua masih placeholder "TMP-nnn",
  // jadi lanjutkan saja nomor urutnya (lihat /api/admin/buku-induk/guru/next-nip). Fire sekali
  // setiap kali role baru dipilih TEACHER pada akun baru & NIP masih kosong.
  useEffect(() => {
    if (form.id || form.role !== "TEACHER" || form.nip) return;
    fetch("/api/admin/buku-induk/guru/next-nip").then(r => r.json())
      .then(d => { if (d.nip) setForm(p => (p.nip ? p : { ...p, nip: d.nip })); })
      .catch(() => {});
  }, [form.id, form.role, form.nip]);

  // Email login guru baru otomatis dari Nama (pola yg sudah dipakai manual selama ini: nama depan
  // + nama belakang, huruf kecil, buang gelar setelah koma) — cth "Ahmad Azmi Khoirul Umam, S.Pt"
  // -> "ahmad.umam". Password default = "Almunawwir1" (keputusan eksplisit user 2026-08-09, bukan
  // berbasis NIP krn NIP masih placeholder). Cuma isi kalau field masih kosong.
  useEffect(() => {
    if (form.id || form.role !== "TEACHER" || !form.name.trim()) return;
    setForm(p => {
      if (p.email && p.password) return p;
      const namePart = p.name.split(",")[0].trim(); // buang gelar setelah koma
      const words = namePart.split(/\s+/).filter(Boolean).map(w => w.replace(/[^a-zA-Z]/g, "").toLowerCase()).filter(Boolean);
      const base = words.length > 1 ? `${words[0]}.${words[words.length - 1]}` : (words[0] ?? "");
      let candidate = base;
      let n = 2;
      while (base && users.some(u => u.email === `${candidate}@smk-almunawwiriibs.sch.id`)) {
        candidate = `${base}${n}`; n++;
      }
      return {
        ...p,
        email: p.email || (base ? `${candidate}@smk-almunawwiriibs.sch.id` : p.email),
        password: p.password || "Almunawwir1",
      };
    });
  }, [form.id, form.role, form.name, users]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    startTransition(async () => {
      const isEdit = !!form.id;
      const url = isEdit ? `/api/admin/users/${form.id}` : "/api/admin/users";
      const method = isEdit ? "PUT" : "POST";
      const body: Record<string, string> = { name: form.name, email: form.email, role: form.role };
      if (form.password) body.password = form.password;
      if (!isEdit && form.role === "TEACHER") { body.nip = form.nip; body.subject = form.subject; body.phone = form.phone; }
      if (!isEdit && form.role === "STUDENT") { body.nis = form.nis; body.nisn = form.nisn; body.majorId = form.majorId; body.classId = form.classId; }

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Gagal menyimpan"); return; }
      setModal(false); fetchUsers();
    });
  }

  async function handleDelete(id: string, name: string) {
    if (!await confirmDialog(`Hapus pengguna "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    fetchUsers();
  }

  const admins = filtered.filter(u => u.role === "ADMIN");
  const teachersList = filtered.filter(u => u.role === "TEACHER");
  const tasList = filtered.filter(u => u.role === "TAS");
  const studentsList = filtered.filter(u => u.role === "STUDENT");

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<UserCog size={22} />}
        title="Akun Pengguna"
        description="Kelola akun login admin, guru, dan siswa"
      />

      {/* Cari */}
      <div className="baris-alat mb-5">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau email..."
            className="input-field pl-10" />
        </div>
        <div className="alat-saring">
          <Select value={fPeran} onChange={setFPeran} placeholder="Semua peran" options={[
            { value: "", label: "Semua peran" },
            { value: "ADMIN", label: "Admin" },
            { value: "TEACHER", label: "Guru" },
            { value: "TAS", label: "TAS" },
            { value: "STUDENT", label: "Siswa" },
          ]} />
        </div>
        <div className="alat-aksi">
          <Link href="/dashboard/admin/users/cetak-akun"
            className="btn-modal-cancel">
            <Printer size={15} /> Cetak Akun Guru &amp; Pegawai
          </Link>
          <button onClick={openCreate} className="btn-modal-save">
            <Plus size={16} /> Tambah Akun
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak ada pengguna ditemukan" />
      ) : (
        <div className="space-y-6">
          {admins.length > 0 && (
            <GroupedSection title="Admin" count={admins.length} icon={ShieldCheck}>
              <UserTable kunci={search} items={admins} onEdit={openEdit} onDelete={handleDelete} />
            </GroupedSection>
          )}
          {teachersList.length > 0 && (
            <GroupedSection title="Guru" count={teachersList.length} icon={GraduationCap}>
              <UserTable kunci={search} items={teachersList} onEdit={openEdit} onDelete={handleDelete} onImpersonate={isSuperAdmin ? handleImpersonate : undefined} impersonatingId={impersonatingId} />
            </GroupedSection>
          )}
          {tasList.length > 0 && (
            <GroupedSection title="TAS (Tenaga Administrasi Sekolah)" count={tasList.length} icon={ClipboardList}>
              <UserTable kunci={search} items={tasList} onEdit={openEdit} onDelete={handleDelete} onManageJabatan={openJabatan} onImpersonate={isSuperAdmin ? handleImpersonate : undefined} impersonatingId={impersonatingId} />
            </GroupedSection>
          )}
          {studentsList.length > 0 && (
            <GroupedSection title="Siswa" count={studentsList.length} icon={Users}>
              <UserTable kunci={search} items={studentsList} onEdit={openEdit} onDelete={handleDelete} onImpersonate={isSuperAdmin ? handleImpersonate : undefined} impersonatingId={impersonatingId} />
            </GroupedSection>
          )}
          <p className="text-xs text-gray-400">Total: {filtered.length} pengguna</p>
        </div>
      )}

      {/* Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(false)}
        title={form.id ? "Edit Akun" : "Tambah Akun"}
        scrollBody
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="submit" form="editAkunForm" disabled={isPending} className="btn-modal-save flex-1">
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isPending ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
            <form id="editAkunForm" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-field">Nama Lengkap</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" required />
              </div>
              <div>
                <label className="label-field">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input-field" required />
                {!form.id && form.role === "STUDENT" && (
                  <p className="text-xs text-gray-400 mt-1">Terisi otomatis dari NIS begitu diisi.</p>
                )}
                {!form.id && form.role === "TEACHER" && (
                  <p className="text-xs text-gray-400 mt-1">Terisi otomatis dari Nama Lengkap begitu diisi.</p>
                )}
              </div>
              <div>
                <label className="label-field">{form.id ? "Password Baru (kosongkan jika tidak diubah)" : "Password"}</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="input-field pr-10" {...(!form.id && { required: true })} minLength={6} />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {!form.id && form.role === "STUDENT" && (
                  <p className="text-xs text-gray-400 mt-1">Terisi otomatis = &quot;Almunawwir1&quot;. Beri tahu siswa untuk segera ganti password sendiri.</p>
                )}
                {!form.id && form.role === "TEACHER" && (
                  <p className="text-xs text-gray-400 mt-1">Terisi otomatis = &quot;Almunawwir1&quot;. Beri tahu guru untuk segera ganti password sendiri.</p>
                )}
              </div>
              <div>
                <label className="label-field">Role</label>
                <Select
                  value={form.role}
                  onChange={v => setForm(f => ({ ...f, role: v as FormState["role"] }))}
                  options={[
                    { value: "STUDENT", label: "Siswa" },
                    { value: "TEACHER", label: "Guru" },
                    { value: "TAS", label: "TAS (Tenaga Administrasi Sekolah)" },
                    { value: "ADMIN", label: "Admin" },
                  ]}
                />
              </div>

              {/* Field tambahan Guru */}
              {!form.id && form.role === "TEACHER" && (
                <div className="border-t pt-4 space-y-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Profil Guru</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-field">NIP</label>
                      <input value={form.nip} onChange={e => setForm(f => ({ ...f, nip: e.target.value }))} className="input-field font-mono" required placeholder="18 digit (otomatis TMP-xxx kalau belum ada)" />
                    </div>
                    <div>
                      <label className="label-field">No. HP</label>
                      <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" placeholder="08..." />
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Mata Pelajaran Utama</label>
                    <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="input-field" required placeholder="Contoh: Jaringan Komputer" />
                  </div>
                </div>
              )}

              {/* Field tambahan Siswa */}
              {!form.id && form.role === "STUDENT" && (
                <div className="border-t pt-4 space-y-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Profil Siswa</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-field">NIS</label>
                      <input value={form.nis} onChange={e => setForm(f => ({ ...f, nis: e.target.value }))} className="input-field font-mono" required placeholder="Otomatis tersaran setelah pilih Jurusan (bisa diubah)" />
                    </div>
                    <div>
                      <label className="label-field">NISN</label>
                      <input value={form.nisn} onChange={e => setForm(f => ({ ...f, nisn: e.target.value }))} className="input-field font-mono" placeholder="10 digit (opsional)" />
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Jurusan</label>
                    <Select
                      value={form.majorId}
                      onChange={v => {
                        setForm(f => ({ ...f, majorId: v }));
                        const major = majors.find(m => m.id === v);
                        if (major && !form.nis) {
                          fetch(`/api/admin/buku-induk/siswa/next-nis?majorCode=${major.code}`)
                            .then(r => r.json())
                            .then(d => { if (d.nis) setForm(f => ({ ...f, nis: d.nis })); })
                            .catch(() => {});
                        }
                      }}
                      options={majors.map(m => ({ value: m.id, label: `${m.code} — ${m.name}` }))}
                      placeholder="Pilih jurusan"
                    />
                  </div>
                  <div>
                    <label className="label-field">Kelas</label>
                    <Select
                      value={form.classId}
                      onChange={v => setForm(f => ({ ...f, classId: v }))}
                      options={classes.map(c => ({ value: c.id, label: c.name }))}
                      placeholder="— Belum ditentukan —"
                    />
                  </div>
                </div>
              )}

              {error && <p className="error-msg">{error}</p>}
            </form>
      </Modal>

      <Modal
        open={!!jabatanModal}
        onClose={() => setJabatanModal(null)}
        title="Kelola Jabatan"
        description={jabatanModal?.name}
        footer={
          <>
            <button type="button" onClick={() => setJabatanModal(null)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={saveJabatan} disabled={savingJabatan} className="btn-modal-save flex-1">
              {savingJabatan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {jabatanOptions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Belum ada katalog jabatan. Tambahkan lewat menu Jabatan.</p>
        ) : (
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {jabatanOptions.map(j => (
              <label key={j.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selectedJabatanIds.includes(j.id)} onChange={() => toggleJabatan(j.id)}
                  className="w-4 h-4 rounded accent-primary-700" />
                <span className="text-sm text-gray-700">{j.name}</span>
              </label>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function UserTable({ items, kunci, onEdit, onDelete, onManageJabatan, onImpersonate, impersonatingId }: {
  items: User[]; kunci?: string; onEdit: (u: User) => void; onDelete: (id: string, name: string) => void; onManageJabatan?: (u: User) => void;
  onImpersonate?: (id: string, name: string) => void; impersonatingId?: string | null;
}) {
  const hal = usePaginasi(items, 50, kunci);
  return (
    <div>
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Nama</th>
            <th className="hidden sm:table-cell">Email</th>
            <th className="hidden md:table-cell">Bergabung</th>
            {onManageJabatan && <th className="hidden lg:table-cell">Jabatan</th>}
            <th className="text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {hal.potongan.map(u => (
            <tr key={u.id}>
              <td>
                <p className="font-semibold text-primary-900">{u.name}</p>
                <p className="text-gray-400 text-xs sm:hidden mt-0.5">{u.email}</p>
              </td>
              <td className="text-gray-500 hidden sm:table-cell">{u.email}</td>
              <td className="text-gray-400 text-xs hidden md:table-cell">
                {new Date(u.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
              </td>
              {onManageJabatan && (
                <td className="hidden lg:table-cell">
                  {u.staffJabatan.length === 0 ? (
                    <span className="text-gray-300 text-xs">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {u.staffJabatan.map(j => (
                        <span key={j.jabatan.id} className="text-xs font-semibold text-gold bg-primary-900 px-2 py-0.5 rounded-full">{j.jabatan.name}</span>
                      ))}
                    </div>
                  )}
                </td>
              )}
              <td className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {onImpersonate && (
                    <button onClick={() => onImpersonate(u.id, u.name)} disabled={impersonatingId === u.id}
                      className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition disabled:opacity-40" title="Masuk Sebagai Akun Ini">
                      {impersonatingId === u.id ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
                    </button>
                  )}
                  {onManageJabatan && (
                    <button onClick={() => onManageJabatan(u)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition" title="Kelola Jabatan"><Award size={15} /></button>
                  )}
                  <button onClick={() => onEdit(u)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-700 transition"><Edit2 size={15} /></button>
                  <button onClick={() => onDelete(u.id, u.name)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"><Trash2 size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <Paginasi hal={hal} satuan="akun" className="border-t border-gray-100" />
    </div>
  );
}
