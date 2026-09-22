"use client";
import React from "react";

type AlertVariant = "info" | "warning" | "success" | "error";

const VARIANT_STYLES: Record<AlertVariant, { box: string; icon: string; title: string; body: string }> = {
  info:    { box: "bg-blue-50 border-blue-200",       icon: "text-blue-600",    title: "text-blue-800",    body: "text-blue-700" },
  warning: { box: "bg-amber-50 border-amber-200",     icon: "text-amber-600",   title: "text-amber-800",   body: "text-amber-700" },
  success: { box: "bg-emerald-50 border-emerald-200", icon: "text-emerald-600", title: "text-emerald-800", body: "text-emerald-700" },
  error:   { box: "bg-red-50 border-red-200",         icon: "text-red-600",     title: "text-red-800",     body: "text-red-700" },
};

interface AlertProps {
  variant: AlertVariant;
  icon?: React.ElementType;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}

/** Kotak notice/alert seragam (info/warning/success/error) — dipakai di seluruh panel admin. */
export default function Alert({ variant, icon: Icon, title, children, className = "" }: AlertProps) {
  const s = VARIANT_STYLES[variant];
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${s.box} ${className}`}>
      {Icon && <Icon size={18} className={`shrink-0 mt-0.5 ${s.icon}`} />}
      <div className={`text-sm flex-1 min-w-0 [overflow-wrap:anywhere] ${s.body}`}>
        {title && <p className={`font-semibold mb-0.5 ${s.title}`}>{title}</p>}
        {children}
      </div>
    </div>
  );
}
