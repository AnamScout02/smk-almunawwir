export type Role = "ADMIN" | "TAS" | "TEACHER" | "STUDENT" | "PARENT";

export interface SessionPayload {
  userId: string;
  role: Role;
  name: string;
  email: string;
  expiresAt: Date;
  /** Id baris `UserSession`. Kosong HANYA pada token lama sebelum sistem sesi server (14 Sep 2026) —
   * token seperti itu dipindahkan otomatis oleh proxy.ts, tidak pernah lolos ke verifySession. */
  sid?: string;
  /** Identitas ADMIN asli selama sedang "Masuk Sebagai" akun ini; null/kosong kalau tidak. */
  imp?: { userId: string; name: string; email: string; role: Role } | null;
}

export interface NavLink {
  name: string;
  href: string;
}

export interface ProgramItem {
  title: string;
  description: string;
  icon: string;
  features: string[];
}

export interface StatItem {
  label: string;
  value: string;
  suffix?: string;
}

export interface TestimonialItem {
  name: string;
  role: string;
  content: string;
  avatar?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  content: string;
  thumbnail: string | null;
  category: string;
  published: boolean;
  createdAt: Date;
}

export interface GradeItem {
  id: string;
  subject: string;
  score: number;
  type: string;
  semester: string;
  createdAt: Date;
}
