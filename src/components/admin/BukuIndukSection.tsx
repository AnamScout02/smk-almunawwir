"use client";
import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface SectionProps {
  title: string;
  icon: React.ElementType;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  accent?: string;
}

export default function Section({ title, icon: Icon, open, onToggle, children, accent }: SectionProps) {
  return (
    <div className="border border-primary-100 rounded-xl shadow-sm">
      <button type="button"
        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${open ? "rounded-t-xl" : "rounded-xl"}`}
        style={{ background: open ? "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" : "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}
        onClick={onToggle}>
        <span className={`flex items-center gap-2 font-semibold text-sm ${open ? "text-white" : "text-primary-800"}`}>
          <Icon size={15} className={open ? "text-gold" : (accent ?? "text-primary-600")} />{title}
        </span>
        {open ? <ChevronUp size={15} className="text-white/60" /> : <ChevronDown size={15} className="text-primary-400" />}
      </button>
      {open && <div className="p-4 grid grid-cols-2 gap-3 bg-white rounded-b-xl">{children}</div>}
    </div>
  );
}
