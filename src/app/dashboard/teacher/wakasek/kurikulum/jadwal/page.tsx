"use client";
import SchedulesManager from "@/components/shared/SchedulesManager";

export default function TeacherKurikulumJadwalPage() {
  return (
    <SchedulesManager
      basePath="/dashboard/teacher/wakasek/kurikulum/jadwal"
      classesHref="/dashboard/teacher/wakasek/kurikulum"
      schoolPeriodsHref="/dashboard/teacher/wakasek/kurikulum"
      showPrintLinks={false}
    />
  );
}
