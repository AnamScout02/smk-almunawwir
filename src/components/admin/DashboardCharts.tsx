"use client";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import AgendaCalendar, { AgendaItem } from "@/components/shared/AgendaCalendar";

interface GenderCount { L: number; P: number }
interface MajorStat { code: string; name: string; count: number; color: string }
interface DataGap { label: string; count: number; href: string }

const GENDER_COLORS = { L: "#1B2B6B", P: "#D4A85A" };
const CARD = "bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col";

function CardHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h3 className="font-heading font-semibold text-navy text-xs uppercase tracking-wide">{title}</h3>
      {badge && (
        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 whitespace-nowrap">
          {badge}
        </span>
      )}
    </div>
  );
}

function GenderDonut({ title, data, realTotal }: { title: string; data: GenderCount; realTotal: number }) {
  const missing = realTotal - (data.L + data.P);
  const chartData = [
    { name: "Laki-laki", value: data.L, key: "L" as const },
    { name: "Perempuan", value: data.P, key: "P" as const },
  ];

  return (
    <div className={CARD}>
      <CardHeader title={title} badge={missing > 0 ? `${missing} JK kosong` : undefined} />
      <div className="flex items-center gap-3 flex-1">
        <div className="relative w-20 h-20 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={24} outerRadius={38} paddingAngle={2} strokeWidth={0}>
                {chartData.map((d) => <Cell key={d.key} fill={GENDER_COLORS[d.key]} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v} orang`, ""]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-heading font-bold text-base text-primary-900">{realTotal}</span>
          </div>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: GENDER_COLORS.L }} />
            <span className="text-gray-500">L</span>
            <span className="font-bold text-primary-900 ml-1">{data.L}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: GENDER_COLORS.P }} />
            <span className="text-gray-500">P</span>
            <span className="font-bold text-primary-900 ml-1">{data.P}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataGapsCard({ data }: { data: DataGap[] }) {
  return (
    <div className={CARD}>
      <CardHeader title="Data Perlu Dilengkapi" />
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-emerald-600 font-medium">Semua data sudah lengkap ✓</p>
        </div>
      ) : (
        <div className="space-y-1.5 flex-1">
          {data.map((g, i) => (
            <Link key={i} href={g.href}
              className="flex items-center gap-2 text-xs group hover:bg-amber-50/60 -mx-1 px-1 py-0.5 rounded transition-colors">
              <AlertTriangle size={12} className="text-amber-500 shrink-0" />
              <span className="text-gray-600 truncate flex-1 min-w-0 group-hover:text-navy">{g.label}</span>
              <span className="font-bold text-amber-600 shrink-0">{g.count}</span>
              <ArrowRight size={10} className="text-gray-300 shrink-0 group-hover:text-amber-500" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MajorBarChart({ data }: { data: MajorStat[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 h-full flex flex-col">
      <h3 className="font-heading font-semibold text-navy text-xs uppercase tracking-wide mb-2.5">Jumlah Siswa per Konsentrasi Keahlian</h3>
      <div className="flex-1 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="code" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(15,26,69,0.04)" }}
            formatter={(v) => [`${v} siswa`, ""]}
            labelFormatter={(label) => data.find(d => d.code === label)?.name ?? label}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
            {data.map((d) => <Cell key={d.code} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function DashboardCharts({
  studentGender, teacherGender, studentTotal, teacherTotal, majorStats, dataGaps, agenda,
}: {
  studentGender: GenderCount; teacherGender: GenderCount;
  studentTotal: number; teacherTotal: number; majorStats: MajorStat[];
  dataGaps: DataGap[]; agenda?: AgendaItem[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <GenderDonut title="Jumlah Siswa" data={studentGender} realTotal={studentTotal} />
        <GenderDonut title="Jumlah Guru" data={teacherGender} realTotal={teacherTotal} />
        <DataGapsCard data={dataGaps} />
      </div>
      {majorStats.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2"><MajorBarChart data={majorStats} /></div>
          <div className="lg:col-span-1"><AgendaCalendar agenda={agenda ?? []} /></div>
        </div>
      )}
    </div>
  );
}
