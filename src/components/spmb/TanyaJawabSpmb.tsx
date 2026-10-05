"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Tanya } from "@/lib/spmb-konten";

export default function TanyaJawabSpmb({ items }: { items: Tanya[] }) {
  const [buka, setBuka] = useState<number | null>(0);
  if (!items.length) return null;

  return (
    <div className="space-y-2">
      {items.map((t, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <button type="button" onClick={() => setBuka(buka === i ? null : i)}
            className="sentuh flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
            <span className="font-heading text-sm font-semibold text-navy">{t.tanya}</span>
            <ChevronDown size={18} className={`shrink-0 text-gray-400 transition ${buka === i ? "rotate-180" : ""}`} />
          </button>
          {buka === i && <p className="border-t border-gray-100 px-5 py-4 text-sm leading-relaxed text-gray-600">{t.jawab}</p>}
        </div>
      ))}
    </div>
  );
}
