"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Megaphone, Search, Send, Undo2 } from "lucide-react";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

type Opsi = {
  kelas: { id: string; nama: string; jumlah: number }[];
  jurusan: { id: string; label: string; jumlah: number }[];
  siswa: { id: string; nama: string; nis: string; kelas: string }[];
  ruang: { id: string; nama: string; jumlah: number }[];
};
type Pesan = {
  id: string; teks: string; sasaran: string; kelasIds: string[]; jurusanIds: string[]; ruangIds: string[]; siswaIds: string[];
  questionId: string | null; pengirim: string; waktu: string; ditarik: string | null;
};

const TEMPLAT = [
  "Waktu tersisa 10 menit.",
  "Waktu tersisa 5 menit. Periksa kembali jawaban Anda.",
  "Ada ralat pada soal ini — silakan baca ulang soalnya.",
  "Jangan lupa menekan Kumpulkan setelah selesai.",
  "Tetap tenang, jaringan sedang diperbaiki. Jawaban Anda aman tersimpan.",
];

/** PESAN KE PESERTA — dipasang di Papan Pantau (21 September 2026). Pesan sampai ke layar peserta lewat denyut
 * (langsung lewat sinyal, src/lib/sinyal-ujian.ts). Sasaran: semua, kelas, jurusan, siswa, atau ruang; soal terkait diterjemahkan ke nomor soal di layar
 * tiap siswa (urutannya diacak). Lihat src/lib/pesan-ujian.ts. */
export default function PesanPesertaPanel({ examId }: { examId: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<{ pesan: Pesan[]; opsi: Opsi; soal: { id: string; nomor: number; teks: string }[] } | null>(null);
  const [buka, setBuka] = useState(false);
  const [semua, setSemua] = useState(false);
  const [teks, setTeks] = useState("");
  const [sasaran, setSasaran] = useState("SEMUA");
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [cariSiswa, setCariSiswa] = useState("");
  const [soalId, setSoalId] = useState("");
  const [mengirim, setMengirim] = useState(false);

  const muat = useCallback(() => {
    fetch(`/api/teacher/exams/${examId}/pesan`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setData(d); })
      .catch(() => {});
  }, [examId]);
  useEffect(() => { muat(); }, [muat]);

  const namaSasaran = useCallback((p: Pesan) => {
    const o = data?.opsi;
    if (!o || p.sasaran === "SEMUA") return "Semua peserta";
    if (p.sasaran === "KELAS") return p.kelasIds.map(id => o.kelas.find(k => k.id === id)?.nama ?? "?").join(", ");
    if (p.sasaran === "JURUSAN") return `Jurusan ${p.jurusanIds.map(id => o.jurusan.find(j => j.id === id)?.label ?? "?").join(", ")}`;
    if (p.sasaran === "RUANG") return p.ruangIds.map(id => o.ruang.find(r => r.id === id)?.nama ?? "?").join(", ");
    return p.siswaIds.length === 1 ? (o.siswa.find(s => s.id === p.siswaIds[0])?.nama ?? "1 siswa") : `${p.siswaIds.length} siswa`;
  }, [data]);

  const pilihan = useMemo(() => {
    const o = data?.opsi;
    if (!o) return [];
    if (sasaran === "KELAS") return o.kelas.map(k => ({ id: k.id, label: k.nama, ket: `${k.jumlah} siswa` }));
    if (sasaran === "JURUSAN") return o.jurusan.map(j => ({ id: j.id, label: j.label, ket: `${j.jumlah} siswa` }));
    if (sasaran === "RUANG") return o.ruang.map(r => ({ id: r.id, label: r.nama, ket: `${r.jumlah} peserta` }));
    if (sasaran === "SISWA") {
      const q = cariSiswa.trim().toLowerCase();
      return o.siswa.filter(s => !q || s.nama.toLowerCase().includes(q) || s.nis.includes(q) || s.kelas.toLowerCase().includes(q))
        .map(s => ({ id: s.id, label: s.nama, ket: `${s.kelas} · ${s.nis}` }));
    }
    return [];
  }, [data, sasaran, cariSiswa]);

  function bukaForm() {
    setTeks(""); setSasaran("SEMUA"); setPilih(new Set()); setCariSiswa(""); setSoalId(""); setBuka(true);
  }
  async function kirim() {
    if (!teks.trim()) return toast.error("Tulis isi pesannya dulu.");
    if (sasaran !== "SEMUA" && !pilih.size) return toast.error("Pilih sasaran pesannya.");
    setMengirim(true);
    const kunci = { KELAS: "kelasIds", JURUSAN: "jurusanIds", SISWA: "siswaIds", RUANG: "ruangIds" }[sasaran as "KELAS"];
    const r = await fetch(`/api/teacher/exams/${examId}/pesan`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teks, sasaran, questionId: soalId || null, ...(kunci ? { [kunci]: [...pilih] } : {}) }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMengirim(false);
    if (!r?.ok) return toast.error(d?.error ?? "Gagal mengirim pesan.");
    toast.success("Pesan terkirim — tampil di layar peserta dalam beberapa detik.");
    setBuka(false);
    muat();
  }
  async function tarik(p: Pesan) {
    if (!(await confirm(`Tarik pesan "${p.teks.slice(0, 60)}"? Pesan hilang dari layar peserta.`))) return;
    const r = await fetch(`/api/teacher/exams/${examId}/pesan?pesan=${p.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) return toast.error("Gagal menarik pesan.");
    toast.success("Pesan ditarik.");
    muat();
  }

  const daftar = data?.pesan ?? [];
  const soal = data?.soal ?? [];
  const tampil = semua ? daftar : daftar.slice(0, 3);
  return (
    <div className="panel mb-4">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100">
        <span className="panel-ikon"><Megaphone size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="panel-judul">Pesan ke Peserta</p>
          <p className="text-xs text-gray-500">Tampil di layar peserta dalam beberapa detik — untuk semua, per kelas, per jurusan, per ruang, atau per siswa.</p>
        </div>
        <button type="button" onClick={bukaForm} className="btn-modal-save btn-teks"><Send /> Kirim Pesan</button>
      </div>
      {daftar.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-400">Belum ada pesan terkirim.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {tampil.map(p => {
            const nomor = p.questionId ? soal.find(s => s.id === p.questionId)?.nomor : null;
            return (
              <li key={p.id} className={`flex items-start gap-3 px-4 py-2.5 ${p.ditarik ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{p.teks}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(p.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · {namaSasaran(p)}
                    {nomor ? ` · soal no. ${nomor} (urutan asli)` : ""} · {p.pengirim}{p.ditarik ? " · ditarik" : ""}
                  </p>
                </div>
                {!p.ditarik && (
                  <button type="button" onClick={() => tarik(p)} title="Tarik pesan"
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Undo2 size={14} /></button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {daftar.length > 3 && (
        <button type="button" onClick={() => setSemua(v => !v)} className="w-full border-t border-gray-100 px-4 py-2 text-xs font-semibold text-primary-700 hover:bg-gray-50">
          {semua ? "Ringkas" : `Lihat semua (${daftar.length})`}
        </button>
      )}

      <Modal open={buka} onClose={() => setBuka(false)} title="Kirim Pesan ke Peserta" size="lg" scrollBody
        description="Tampil di layar peserta dalam beberapa detik"
        footer={<>
          <button type="button" onClick={() => setBuka(false)} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={kirim} disabled={mengirim} className="btn-modal-save">{mengirim ? <Loader2 className="animate-spin" /> : <Send />} Kirim</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="label-field" htmlFor="pesan-teks">Isi pesan</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {TEMPLAT.map(t => (
                <button key={t} type="button" onClick={() => setTeks(t)}
                  className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-primary-50 hover:text-primary-700">{t}</button>
              ))}
            </div>
            <textarea id="pesan-teks" value={teks} onChange={e => setTeks(e.target.value)} rows={3} maxLength={500}
              className="input-field w-full" placeholder='mis. "Soal no. 5 pilihan C seharusnya 25 cm"' />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-field">Dikirim ke</label>
              <Select value={sasaran} onChange={v => { setSasaran(v); setPilih(new Set()); }}
                options={[
                  { value: "SEMUA", label: `Semua peserta (${data?.opsi.siswa.length ?? 0})` },
                  { value: "KELAS", label: "Kelas tertentu" },
                  { value: "JURUSAN", label: "Jurusan tertentu" },
                  ...((data?.opsi.ruang.length ?? 0) > 0 ? [{ value: "RUANG", label: "Ruang tertentu" }] : []),
                  { value: "SISWA", label: "Siswa tertentu" },
                ]} />
            </div>
            <div>
              <label className="label-field">Terkait soal <span className="font-normal text-gray-400">(opsional)</span></label>
              <Select value={soalId} onChange={setSoalId}
                options={[{ value: "", label: "— tidak terkait soal —" }, ...soal.map(s => ({ value: s.id, label: `No. ${s.nomor} — ${s.teks || "(soal)"}` }))]} />
              <p className="text-xs text-gray-400 mt-1">Soal diacak? Siswa melihat nomor soal di urutannya sendiri + tombol &ldquo;Buka soal&rdquo;.</p>
            </div>
          </div>
          {sasaran !== "SEMUA" && (
            <div>
              {sasaran === "SISWA" && (
                <div className="relative mb-2">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={cariSiswa} onChange={e => setCariSiswa(e.target.value)} placeholder="Cari nama, NIS, atau kelas..." className="input-field pl-10" />
                </div>
              )}
              <div className="max-h-60 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                {pilihan.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">Tidak ada pilihan.</p>}
                {pilihan.map(o => (
                  <label key={o.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={pilih.has(o.id)} className="w-4 h-4 accent-[#1B2B6B]"
                      onChange={e => setPilih(s => { const n = new Set(s); if (e.target.checked) n.add(o.id); else n.delete(o.id); return n; })} />
                    <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{o.label}</span>
                    <span className="text-xs text-gray-400 shrink-0">{o.ket}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">{pilih.size} dipilih</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
