"use client";
import { useEffect } from "react";
import { catatJejak } from "@/lib/spmb-jejak";

/** Mencatat tahap pertama corong ("membuka halaman SPMB") sekali per tab — lihat src/lib/spmb-jejak.ts. */
export default function JejakKunjung() {
  useEffect(() => { catatJejak("KUNJUNG"); }, []);
  return null;
}
