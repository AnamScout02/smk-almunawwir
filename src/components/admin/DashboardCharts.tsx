"use client";
import React from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface GenderCount { L: number; P: number }
interface MajorStat { code: string; name: string; count: number; color: string }

const GENDER_COLORS = { L: "#1B2B6B", P: "#D4A85A" };

function GenderDonut({ title, data }: { title: string; data: GenderCount }) {
  const total = data.L + data.P;
  const chartData = [
    { name: "Laki-laki", value: data.L, key: "L" as const },
    { name: "Perempuan", value: data.P, key: "P" as const },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-heading font-semibold text-navy text-sm mb-3">{title}</h3>
      <div className="flex items-center gap-4">
        <div className="relative w-32 h-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} paddingAngle={2} strokeWidth={0}>
                {chartData.map((d) => <Cell key={d.key} fill={GENDER_COLORS[d.key]} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v} orang`, ""]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-heading font-bold text-2xl text-primary-900">{total}</span>
            <span className="text-[10px] text-gray-400">Total</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: GENDER_COLORS.L }} />
            <span className="text-gray-500">Laki-laki</span>
            <span className="font-bold text-primary-900 ml-auto">{data.L}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: GENDER_COLORS.P }} />
            <span className="text-gray-500">Perempuan</span>
            <span className="font-bold text-primary-900 ml-auto">{data.P}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MajorBarChart({ data }: { data: MajorStat[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-heading font-semibold text-navy text-sm mb-4">Jumlah Siswa per Konsentrasi Keahlian</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="code" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(15,26,69,0.04)" }}
            formatter={(v) => [`${v} siswa`, ""]}
            labelFormatter={(label) => data.find(d => d.code === label)?.name ?? label}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {data.map((d) => <Cell key={d.code} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DashboardCharts({ studentGender, teacherGender, majorStats }: {
  studentGender: GenderCount; teacherGender: GenderCount; majorStats: MajorStat[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <GenderDonut title="Jumlah Siswa" data={studentGender} />
        <GenderDonut title="Jumlah Guru" data={teacherGender} />
      </div>
      {majorStats.length > 0 && <MajorBarChart data={majorStats} />}
    </div>
  );
}
