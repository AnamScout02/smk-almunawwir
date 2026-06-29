export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export interface SessionPayload {
  userId: string;
  role: Role;
  name: string;
  email: string;
  expiresAt: Date;
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
