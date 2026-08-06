// Gabungkan slot Schedule BERURUTAN (endTime slot sebelumnya == startTime slot berikutnya) yang
// satu kelompok (ditentukan oleh `keyFn`, mis. sama guru+kelas+mapel) jadi satu "blok" — dipakai
// di Kedisiplinan Guru (Buku Piket) & Jadwal Mengajar Saya supaya guru yang ngajar beberapa JP
// berturut-turut di kelas+mapel yang sama tampil sebagai SATU baris/JP gabungan (mis. "07:15–09:45
// (4 JP)"), bukan satu baris terpisah per JP.
export interface ScheduleSlotLike {
  startTime: string;
  endTime: string;
}

export function groupConsecutiveSchedules<T extends ScheduleSlotLike>(
  slots: T[],
  keyFn: (s: T) => string,
): { items: T[]; first: T; last: T }[] {
  const byKey = new Map<string, T[]>();
  for (const s of slots) {
    const key = keyFn(s);
    const arr = byKey.get(key) ?? [];
    arr.push(s);
    byKey.set(key, arr);
  }

  const blocks: { items: T[]; first: T; last: T }[] = [];
  for (const arr of byKey.values()) {
    arr.sort((a, b) => a.startTime.localeCompare(b.startTime));
    let current: T[] = [];
    const flush = () => {
      if (current.length === 0) return;
      blocks.push({ items: current, first: current[0], last: current[current.length - 1] });
      current = [];
    };
    for (const s of arr) {
      if (current.length > 0 && current[current.length - 1].endTime !== s.startTime) flush();
      current.push(s);
    }
    flush();
  }
  return blocks;
}
