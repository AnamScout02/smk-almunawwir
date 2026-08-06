"use client";
import TeachingAssignmentsManager from "@/components/shared/TeachingAssignmentsManager";

export default function TeacherKurikulumPenugasanPage() {
  return (
    <TeachingAssignmentsManager
      basePath="/dashboard/teacher/wakasek/kurikulum/penugasan"
      subjectsHref="/dashboard/teacher/wakasek/kurikulum/mapel"
    />
  );
}
