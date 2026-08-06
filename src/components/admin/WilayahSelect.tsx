"use client";
import { useEffect, useState } from "react";
import Select from "./Select";
import { toProperCase } from "@/lib/text";

interface Item { id: string; name: string }

const stripRegencyPrefix = (name: string) => name.replace(/^(KABUPATEN|KOTA)\s+/i, "");
const byName = (a: Item, b: Item) => a.name.localeCompare(b.name, "id");
const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "id");
const normalize = (s: string) => s.trim().toUpperCase();
/** Data wilayah dari API pemerintah selalu ALL CAPS ("JAWA TIMUR") — tampilkan & simpan
 * Proper Case ("Jawa Timur") supaya konsisten dengan data teks lain di Buku Induk. */
const display = (name: string) => toProperCase(name);

/** Cari item yang cocok secara longgar (trim + case-insensitive, dengan/tanpa prefix Kabupaten/Kota)
 *  agar data lama (input manual sebelum dropdown ini ada) tetap terbaca sebagai terpilih. */
function findLoose(items: Item[], raw: string): Item | undefined {
  if (!raw) return undefined;
  const target = normalize(raw);
  return items.find(i => normalize(i.name) === target || normalize(stripRegencyPrefix(i.name)) === target);
}

interface WilayahSelectProps {
  province: string;
  regency: string;
  district: string;
  village: string;
  onProvince: (v: string) => void;
  onRegency: (v: string) => void;
  onDistrict: (v: string) => void;
  onVillage: (v: string) => void;
  readOnly?: boolean;
}

export default function WilayahSelect({
  province, regency, district, village,
  onProvince, onRegency, onDistrict, onVillage, readOnly = false,
}: WilayahSelectProps) {
  const [provinces, setProvinces] = useState<Item[]>([]);
  const [regencies, setRegencies] = useState<Item[]>([]);
  const [districts, setDistricts] = useState<Item[]>([]);
  const [villages, setVillages] = useState<Item[]>([]);

  useEffect(() => {
    fetch("/api/wilayah/provinces").then(r => r.json()).then(d => Array.isArray(d) && setProvinces(d)).catch(() => {});
  }, []);

  const provinceMatch = findLoose(provinces, province);
  const regencyMatch = findLoose(regencies, regency);
  const districtMatch = findLoose(districts, district);
  const villageMatch = findLoose(villages, village);
  const provinceId = provinceMatch?.id;
  const regencyId = regencyMatch?.id;
  const districtId = districtMatch?.id;

  useEffect(() => {
    if (!provinceId) { setRegencies([]); return; }
    fetch(`/api/wilayah/regencies/${provinceId}`).then(r => r.json()).then(d => Array.isArray(d) && setRegencies(d)).catch(() => {});
  }, [provinceId]);

  useEffect(() => {
    if (!regencyId) { setDistricts([]); return; }
    fetch(`/api/wilayah/districts/${regencyId}`).then(r => r.json()).then(d => Array.isArray(d) && setDistricts(d)).catch(() => {});
  }, [regencyId]);

  useEffect(() => {
    if (!districtId) { setVillages([]); return; }
    fetch(`/api/wilayah/villages/${districtId}`).then(r => r.json()).then(d => Array.isArray(d) && setVillages(d)).catch(() => {});
  }, [districtId]);

  return (
    <>
      <div>
        <label className="label-field">Provinsi</label>
        <Select
          value={provinceMatch?.name ?? province}
          onChange={v => { onProvince(toProperCase(v)); onRegency(""); onDistrict(""); onVillage(""); }}
          options={[...provinces].sort(byName).map(p => ({ value: p.name, label: display(p.name) }))}
          placeholder="Pilih provinsi"
          disabled={readOnly}
        />
      </div>
      <div>
        <label className="label-field">Kabupaten/Kota</label>
        <Select
          value={stripRegencyPrefix(regencyMatch?.name ?? regency)}
          onChange={v => { onRegency(toProperCase(v)); onDistrict(""); onVillage(""); }}
          options={regencies.map(r => ({ value: stripRegencyPrefix(r.name), label: display(stripRegencyPrefix(r.name)) })).sort(byLabel)}
          placeholder={province ? "Pilih kabupaten/kota" : "Pilih provinsi dulu"}
          disabled={readOnly || !province}
        />
      </div>
      <div>
        <label className="label-field">Kecamatan</label>
        <Select
          value={districtMatch?.name ?? district}
          onChange={v => { onDistrict(toProperCase(v)); onVillage(""); }}
          options={[...districts].sort(byName).map(d => ({ value: d.name, label: display(d.name) }))}
          placeholder={regency ? "Pilih kecamatan" : "Pilih kabupaten dulu"}
          disabled={readOnly || !regency}
        />
      </div>
      <div>
        <label className="label-field">Desa/Kelurahan</label>
        <Select
          value={villageMatch?.name ?? village}
          onChange={v => onVillage(toProperCase(v))}
          options={[...villages].sort(byName).map(v => ({ value: v.name, label: display(v.name) }))}
          placeholder={district ? "Pilih desa/kelurahan" : "Pilih kecamatan dulu"}
          disabled={readOnly || !district}
        />
      </div>
    </>
  );
}
