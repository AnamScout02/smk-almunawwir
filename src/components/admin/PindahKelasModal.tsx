"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";

export interface PindahKelasClassOption {
  id: string; name: string; grade: number; major: { id: string; code: string };
}

export interface PindahKelasStudent {
  id: string; nis: string; nisn?: string | null;
  user: { name: string };
  class?: { id: string; name: string } | null;
  major: { id: string };
}

/** Modal "Pindah Kelas" — mengubah `Student.classId` SUNGGUHAN (bukan sekadar catatan teks
 * "Rombel" di Buku Induk, yang cuma riwayat penerimaan & tidak terhubung ke kelas aktual sama
 * sekali — sumber kebingungan admin yang berulang). Dipakai bersama oleh halaman "Kelola Siswa"
 * (`admin/students`) dan "Buku Induk Siswa" (`admin/buku-induk/siswa`) — JANGAN duplikasi modal
 * ini, cukup render sekali per halaman dan kontrol lewat prop `student` (null = tertutup).
 * Efek samping di server (lihat `PUT /api/admin/students/[id]`): majorId ikut menyesuaikan kelas
 * tujuan, tercatat di ActivityLog, StudentClassHistory tahun ajaran aktif ikut disinkron. */
export default function PindahKelasModal({
  student, classes, onClose, onMoved,
}: {
  student: PindahKelasStudent | null;
  classes: PindahKelasClassOption[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const toast = useToast();
  const [targetClassId, setTargetClassId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setTargetClassId(student?.class?.id ?? ""); }, [student]);

  // Pindah kelas HANYA boleh sesama tingkat (mis. dari XII TKJ 1 cuma boleh ke XII lain) — naik/
  // turun tingkat itu urusan proses "Naik Kelas" tahunan, bukan tombol ini (keputusan eksplisit
  // user 2026-08-28, supaya tidak ada yang salah pencet "pindah kelas" padahal maksudnya
  // meluluskan/menaikkan tingkat siswa). Siswa yang BELUM punya kelas sama sekali (`class` null)
  // dikecualikan dari batasan ini — semua tingkat ditampilkan, krn belum ada tingkat acuan.
  const currentClass = classes.find(c => c.id === student?.class?.id);
  const selectableClasses = currentClass ? classes.filter(c => c.grade === currentClass.grade) : classes;

  async function submit() {
    if (!student || !targetClassId) return;
    setSaving(true);
    const targetClass = classes.find(c => c.id === targetClassId);
    try {
      const res = await fetch(`/api/admin/students/${student.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nis: student.nis,
          nisn: student.nisn,
          majorId: targetClass?.major.id ?? student.major.id,
          classId: targetClassId,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${student.user.name} dipindahkan ke ${targetClass?.name ?? "kelas baru"}`);
      onMoved();
    } catch {
      toast.error("Gagal memindahkan kelas siswa");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!student}
      onClose={onClose}
      title="Pindah Kelas"
      description={student ? `${student.user.name} — saat ini di ${student.class?.name ?? "belum ada kelas"}` : undefined}
      size="sm"
      footer={<>
        <button className="btn-modal-cancel" onClick={onClose}>Batal</button>
        <button className="btn-modal-save" disabled={saving || !targetClassId} onClick={submit}>
          {saving ? "Memindahkan..." : "Pindahkan"}
        </button>
      </>}
    >
      <label className="label-field">Kelas Tujuan</label>
      <Select
        value={targetClassId}
        onChange={setTargetClassId}
        options={selectableClasses.map(c => ({ value: c.id, label: `${c.name} · ${c.major.code}` }))}
        placeholder="— Pilih Kelas Tujuan —"
      />
      <p className="text-xs text-gray-400 mt-2">
        Ini memindahkan kelas AKTUAL siswa (bukan sekadar catatan &quot;Rombel&quot; di Buku Induk) — data nilai &amp; absensi sebelumnya tetap tersimpan di kelas lama.
        {currentClass && " Hanya menampilkan kelas tingkat yang sama — untuk naik/turun tingkat, gunakan proses Naik Kelas tahunan."}
      </p>
    </Modal>
  );
}
