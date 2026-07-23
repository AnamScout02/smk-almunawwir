"use client";
import { useState } from "react";
import { FileText, Search } from "lucide-react";
import AdmissionsForm from "@/components/sections/AdmissionsForm";
import AdmissionsStatusCheck from "@/components/sections/AdmissionsStatusCheck";
import type { Lang } from "@/lib/lang";

const ui = {
  id: { form: "Formulir Pendaftaran", status: "Cek Status" },
  en: { form: "Registration Form", status: "Check Status" },
};

export default function AdmissionsTabSection({ lang = "id" }: { lang?: Lang }) {
  const [tab, setTab] = useState<"form" | "status">("form");
  const t = ui[lang];

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
          {t.form}
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
          {t.status}
        </button>
      </div>
      {tab === "form" ? <AdmissionsForm lang={lang} /> : <AdmissionsStatusCheck lang={lang} />}
    </div>
  );
}
