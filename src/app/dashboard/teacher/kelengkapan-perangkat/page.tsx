import KelengkapanPerangkat from "@/components/jabatan/KelengkapanPerangkat";

/** Guru biasa melihat baris miliknya saja (API membatasi); Wakil Kepala Kurikulum melihat semua guru. */
export default function Page() {
  return <KelengkapanPerangkat protaHref="/dashboard/teacher/rencana-ajar" rppHref="/dashboard/teacher/rpp" />;
}
