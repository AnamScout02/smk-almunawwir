"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, NotebookPen, Loader2, Plus, Save, Trash2, ImagePlus } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import DatePicker from "@/components/shared/DatePicker";
import FileUpload from "@/components/shared/FileUpload";
import Select from "@/components/admin/Select";
import LetterheadImage from "@/components/shared/LetterheadImage";
import { useToast } from "@/components/shared/ToastProvider";

interface Person { id: string; name: string; role: string }

function fmtLong(dateStr: string) {
  if (!dateStr) return "…………………………";
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// Input transparan bergaris bawah putus-putus — dipakai supaya field terasa seperti "mengisi blanko
// kertas" langsung (live), bukan kotak form dashboard biasa.
function BlankInput({ value, onChange, placeholder, className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full bg-transparent border-0 border-b border-dotted border-gray-400 focus:border-primary-500 outline-none px-1 py-1 text-sm text-primary-900 placeholder:text-gray-300 placeholder:italic ${className}`} />
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 sm:w-44 shrink-0 text-sm text-primary-900">{label}</span>
      <span className="text-primary-900">:</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export default function NotulenRapatFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [people, setPeople] = useState<Person[]>([]);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [leader, setLeader] = useState("");
  const [topic, setTopic] = useState("");
  const [openedBy, setOpenedBy] = useState("");
  const [greetings, setGreetings] = useState<string[]>(["Kepala Sekolah"]);
  const [decisions, setDecisions] = useState("");
  const [notulis, setNotulis] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [checkedPeople, setCheckedPeople] = useState<Set<string>>(new Set());
  const [extraNames, setExtraNames] = useState<string[]>([""]);
  const [kopAtas, setKopAtas] = useState("");
  const [kopBawah, setKopBawah] = useState("");

  useEffect(() => {
    fetch("/api/admin/notulen-rapat/people").then(r => r.json()).then(d => setPeople(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/settings/school-info").then(r => r.json()).then(d => { setKopAtas(d.kopAtas ?? ""); setKopBawah(d.kopBawah ?? ""); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/admin/notulen-rapat/${id}`).then(async r => {
      if (!r.ok) { setError("Notulen tidak ditemukan"); setLoading(false); return; }
      const d = await r.json();
      setDate(new Date(d.date).toISOString().slice(0, 10));
      setTime(d.time ?? ""); setPlace(d.place ?? ""); setLeader(d.leader ?? ""); setTopic(d.topic ?? "");
      setOpenedBy(d.openedBy ?? ""); setGreetings(d.greetings?.length ? d.greetings : ["Kepala Sekolah"]);
      setDecisions(d.decisions ?? ""); setNotulis(d.notulis ?? ""); setPhotos(d.photos ?? []);
      const names: string[] = d.attendees?.map((a: { name: string }) => a.name) ?? [];
      setPendingAttendeeNames(names);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, [id, isNew]);

  // Setelah daftar people ter-load, pisahkan attendee tersimpan jadi checklist vs nama tambahan.
  const [pendingAttendeeNames, setPendingAttendeeNames] = useState<string[] | null>(null);
  useEffect(() => {
    if (pendingAttendeeNames === null || people.length === 0) return;
    const peopleNames = new Set(people.map(p => p.name));
    setCheckedPeople(new Set(pendingAttendeeNames.filter(n => peopleNames.has(n))));
    const extras = pendingAttendeeNames.filter(n => !peopleNames.has(n));
    setExtraNames(extras.length > 0 ? extras : [""]);
    setPendingAttendeeNames(null);
  }, [pendingAttendeeNames, people]);

  function updateAt<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, i: number, value: T) {
    setter(arr => arr.map((v, idx) => (idx === i ? value : v)));
  }
  function removeAt<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, i: number) {
    setter(arr => arr.filter((_, idx) => idx !== i));
  }
  function togglePerson(name: string) {
    setCheckedPeople(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  async function handleSave() {
    if (!date) { setError("Tanggal rapat wajib diisi."); return; }
    setError("");
    setSaving(true);
    const attendeeNames = [...Array.from(checkedPeople), ...extraNames.filter(n => n.trim())];
    const body = {
      date, time, place, leader, topic, openedBy,
      greetings: greetings.filter(g => g.trim()),
      decisions, notulis, photos: photos.filter(Boolean),
      attendees: attendeeNames.map(name => ({ name })),
    };
    const res = await fetch(isNew ? "/api/admin/notulen-rapat" : `/api/admin/notulen-rapat/${id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    toast.success("Notulen rapat berhasil disimpan");
    router.push("/dashboard/admin/notulen-rapat");
  }

  if (loading) {
    return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  }

  const peopleOptions = people.map(p => ({ value: p.name, label: p.name }));
  const hadirCount = checkedPeople.size + extraNames.filter(n => n.trim()).length;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<NotebookPen size={22} />}
        title={isNew ? "Tambah Notulen Rapat" : "Edit Notulen Rapat"}
        description="Isi langsung di lembar kerja di bawah — tampilannya mengikuti dokumen yang akan dicetak"
      />

      <div className="flex justify-end mb-4">
        <Link href="/dashboard/admin/notulen-rapat" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft size={18} />
        </Link>
      </div>

      {error && <p className="error-msg mb-4">{error}</p>}

      {/* Lembar kerja — Halaman 1: Notulen */}
      <div className="overflow-x-auto mb-6">
      <div className="a4-page print-doc bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mx-auto">
        <LetterheadImage url={kopAtas} alt="Kop Surat" />
        <div className="a4-page-body">
        <h1 className="text-center font-bold text-base uppercase underline mb-6 text-primary-900">Notulen Rapat</h1>

        <div className="space-y-3 mb-6">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            <FieldRow label="Hari/Tanggal">
              <DatePicker value={date} onChange={setDate} />
            </FieldRow>
            <FieldRow label="Waktu">
              <BlankInput value={time} onChange={setTime} placeholder="09.00 - 11.00 WIB" />
            </FieldRow>
            <FieldRow label="Tempat">
              <BlankInput value={place} onChange={setPlace} placeholder="Ruang Guru" />
            </FieldRow>
            <FieldRow label="Pemimpin Rapat">
              <Select value={leader} onChange={setLeader} options={peopleOptions} placeholder="— Pilih —" />
            </FieldRow>
          </div>
          <FieldRow label="Materi Rapat">
            <BlankInput value={topic} onChange={setTopic} placeholder="Evaluasi Semester Ganjil" />
          </FieldRow>

          <div className="pt-2">
            <p className="text-sm text-primary-900 mb-2">Kegiatan Pembukaan</p>
            <div className="pl-4 space-y-2">
              <FieldRow label="a. Dibuka oleh">
                <Select value={openedBy} onChange={setOpenedBy} options={peopleOptions} placeholder="— Pilih —" />
              </FieldRow>
              <div>
                <p className="text-sm text-primary-900 mb-1.5">b. Sambutan dari</p>
                <div className="pl-6 space-y-1.5">
                  {greetings.map((g, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm w-4 shrink-0">{i + 1}.</span>
                      <div className="flex-1"><Select value={g} onChange={v => updateAt(setGreetings, i, v)} options={peopleOptions} placeholder="— Pilih —" /></div>
                      {greetings.length > 1 && (
                        <button onClick={() => removeAt(setGreetings, i)} className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0"><Trash2 size={13} /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setGreetings(g => [...g, ""])} className="mt-1.5 ml-6 text-xs text-primary-600 hover:text-primary-800 font-semibold flex items-center gap-1">
                  <Plus size={11} /> Tambah Sambutan
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mb-6">
          <div className="text-sm text-center min-w-[220px]">
            <p className="mb-1 text-primary-900">Singojuruh, {fmtLong(date)}</p>
            <p className="mb-14 text-primary-900">Kepala SMK Al Munawwir IIBS</p>
            <p className="font-bold underline text-primary-900">&nbsp;</p>
          </div>
        </div>
        <div>
          <p className="text-sm text-primary-900 mb-1">Notulis</p>
          <div className="max-w-xs">
            <Select value={notulis} onChange={setNotulis} options={peopleOptions} placeholder="— Pilih Notulis —" />
          </div>
        </div>
        </div>
        <LetterheadImage url={kopBawah} alt="Kop Bawah" />
      </div>
      </div>

      {/* Lembar kerja — Halaman 2: Dokumentasi & Daftar Hadir */}
      <div className="overflow-x-auto mb-6">
      <div className="a4-page print-doc bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mx-auto">
        <LetterheadImage url={kopAtas} alt="Kop Surat" />
        <div className="a4-page-body">
        <p className="font-heading font-bold text-primary-900 text-sm mb-3 flex items-center gap-2"><ImagePlus size={16} /> Dokumentasi Rapat</p>
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {photos.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1"><FileUpload value={p} onChange={v => updateAt(setPhotos, i, v)} folder="notulen-rapat" label={`Foto ${i + 1}`} accept="image/jpeg,image/png,image/webp" hint="JPG, PNG, WEBP — maks. 5MB" /></div>
              <button onClick={() => removeAt(setPhotos, i)} className="mt-7 p-1.5 text-gray-300 hover:text-red-500 transition-colors shrink-0"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <button onClick={() => setPhotos(p => [...p, ""])} className="mb-6 text-xs text-primary-600 hover:text-primary-800 font-semibold flex items-center gap-1">
          <Plus size={12} /> Tambah Foto
        </button>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-center font-bold text-sm uppercase text-primary-900">Daftar Hadir Peserta Rapat</h2>
          <span className="text-xs font-bold text-emerald-600">{hadirCount} hadir</span>
        </div>
        <div className="border border-gray-800 rounded-lg overflow-hidden mb-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-300">
            <div className="max-h-72 overflow-y-auto">
              {people.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-primary-50/30 cursor-pointer">
                  <input type="checkbox" checked={checkedPeople.has(p.name)} onChange={() => togglePerson(p.name)}
                    className="w-4 h-4 rounded accent-primary-700 shrink-0" />
                  <span className="truncate text-primary-900">{p.name}</span>
                </label>
              ))}
            </div>
            <div className="p-3">
              <p className="text-xs text-gray-400 mb-2">Tambahan (tamu/komite/wali murid di luar guru &amp; pegawai):</p>
              <div className="space-y-1.5">
                {extraNames.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-gray-300 text-sm w-5 shrink-0">{i + 1}.</span>
                    <BlankInput value={a} onChange={v => updateAt(setExtraNames, i, v)} placeholder="Nama tamu" />
                    {extraNames.length > 1 && (
                      <button onClick={() => removeAt(setExtraNames, i)} className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0"><Trash2 size={13} /></button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => setExtraNames(a => [...a, ""])} className="mt-2 text-xs text-primary-600 hover:text-primary-800 font-semibold flex items-center gap-1">
                <Plus size={11} /> Tambah Nama Tamu
              </button>
            </div>
          </div>
        </div>
        </div>
        <LetterheadImage url={kopBawah} alt="Kop Bawah" />
      </div>
      </div>

      {/* Lembar kerja — Halaman 3: Hasil Keputusan */}
      <div className="overflow-x-auto mb-6">
      <div className="a4-page print-doc bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mx-auto">
        <LetterheadImage url={kopAtas} alt="Kop Surat" />
        <div className="a4-page-body">
        <h2 className="text-center font-bold text-sm uppercase mb-4 text-primary-900">Hasil Keputusan Rapat</h2>
        <textarea value={decisions} onChange={e => setDecisions(e.target.value)} rows={12}
          className="w-full bg-transparent outline-none text-sm text-primary-900 resize-none leading-8"
          style={{ backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, #d1d5db 32px)" }}
          placeholder="Tulis hasil keputusan rapat di sini..." />
        </div>
        <LetterheadImage url={kopBawah} alt="Kop Bawah" />
      </div>
      </div>

      <div className="flex justify-center mb-8 max-w-[800px] mx-auto">
        <button onClick={handleSave} disabled={saving} className="btn-gold flex items-center gap-2 text-sm px-8">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Notulen
        </button>
      </div>
    </div>
  );
}
