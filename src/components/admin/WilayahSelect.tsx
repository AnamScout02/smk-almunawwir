"use client";
import { useEffect, useState } from "react";
import Select from "./Select";

interface Item { id: string; name: string }

const stripRegencyPrefix = (name: string) => name.replace(/^(KABUPATEN|KOTA)\s+/i, "");
const byName = (a: Item, b: Item) => a.name.localeCompare(b.name, "id");
const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "id");
const normalize = (s: string) => s.trim().toUpperCase();

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
}

export default function WilayahSelect({
  province, regency, district, village,
  onProvince, onRegency, onDistrict, onVillage,
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
          onChange={v => { onProvince(v); onRegency(""); onDistrict(""); onVillage(""); }}
          options={[...provinces].sort(byName).map(p => ({ value: p.name, label: p.name }))}
          placeholder="Pilih provinsi"
        />
      </div>
      <div>
        <label className="label-field">Kabupaten/Kota</label>
        <Select
          value={regencyMatch?.name ?? regency}
          onChange={v => { onRegency(v); onDistrict(""); onVillage(""); }}
          options={regencies.map(r => ({ value: r.name, label: stripRegencyPrefix(r.name) })).sort(byLabel)}
          placeholder={province ? "Pilih kabupaten/kota" : "Pilih provinsi dulu"}
          disabled={!province}
        />
      </div>
      <div>
        <label className="label-field">Kecamatan</label>
        <Select
          value={districtMatch?.name ?? district}
          onChange={v => { onDistrict(v); onVillage(""); }}
          options={[...districts].sort(byName).map(d => ({ value: d.name, label: d.name }))}
          placeholder={regency ? "Pilih kecamatan" : "Pilih kabupaten dulu"}
          disabled={!regency}
        />
      </div>
      <div>
        <label className="label-field">Desa/Kelurahan</label>
        <Select
          value={villageMatch?.name ?? village}
          onChange={onVillage}
          options={[...villages].sort(byName).map(v => ({ value: v.name, label: v.name }))}
          placeholder={district ? "Pilih desa/kelurahan" : "Pilih kecamatan dulu"}
          disabled={!district}
        />
      </div>
    </>
  );
}
