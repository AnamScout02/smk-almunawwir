"use client";
import { useState } from "react";
import { FileText, Search } from "lucide-react";
import AdmissionsForm from "@/components/sections/AdmissionsForm";
import AdmissionsStatusCheck from "@/components/sections/AdmissionsStatusCheck";

export default function AdmissionsTabSection() {
  const [tab, setTab] = useState<"form" | "status">("form");

  return (
    <div>
      <div className="flex gap-2 mb-5 p-1 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <button
          onClick={() => setTab("form")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            tab === "form"
              ? "bg-primary-700 text-white shadow-sm"
              : "text-gray-500 hover:text-primary-700"
          }`}
        >
          <FileText size={15} />
          Formulir Pendaftaran
        </button>
        <button
          onClick={() => setTab("status")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            tab === "status"
              ? "bg-primary-700 text-white shadow-sm"
              : "text-gray-500 hover:text-primary-700"
          }`}
        >
          <Search size={15} />
          Cek Status
        </button>
      </div>
      {tab === "form" ? <AdmissionsForm /> : <AdmissionsStatusCheck />}
    </div>
  );
}
