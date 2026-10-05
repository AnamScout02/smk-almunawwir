#!/bin/bash
# BANGUN MyAlwis Ujian (Windows x64, portabel) → zip di volume unggahan aplikasi: /uploads/unduh/myalwis-ujian-windows.zip
# Dibangun di Linux tanpa wine: @electron/packager (tanpa ikon) lalu ikon & info versi .exe dipasang `resedit` (JS murni).
# Unduhan Electron disinggahkan di /root/.cache/windows-ujian supaya build berikutnya tidak mengunduh ulang.
set -euo pipefail
REPO=$(cd "$(dirname "$0")/.." && pwd)
K=/root/.cache/windows-ujian
rm -rf "$K/kerja"; mkdir -p "$K/kerja/app" "$K/electron" "$K/npm"
cp "$REPO"/windows-ujian/{package.json,main.js,preload.js,preload-pin.js,pin.html,offline.html} "$K/kerja/app/"
cp "$REPO/public/icons/icon-512.png" "$K/kerja/ikon.png"
docker run --rm -v "$K/kerja":/kerja -v "$K/electron":/root/.cache/electron -v "$K/npm":/root/.npm -w /kerja node:20-alpine sh -c '
  set -e
  apk add --no-cache zip >/dev/null
  npm i --no-audit --no-fund --silent @electron/packager@18 resedit@2 png-to-ico@2 sharp@0.33 >/dev/null
  npx electron-packager app MyAlwisUjian --platform=win32 --arch=x64 --electron-version=33.4.11 --out=out --overwrite \
    --app-copyright="SMK Al-Munawwir IIBS" --app-version=1.0.0 --win32metadata.CompanyName="SMK Al-Munawwir IIBS" \
    --win32metadata.FileDescription="MyAlwis Ujian" --win32metadata.ProductName="MyAlwis Ujian" >/dev/null
  node -e "
    const sharp=require(\"sharp\"), pngToIco=require(\"png-to-ico\").default ?? require(\"png-to-ico\"), fs=require(\"fs\"), ResEdit=require(\"resedit\");
    (async()=>{
      const ukuran=[16,24,32,48,64,128,256];
      const png=await Promise.all(ukuran.map(n=>sharp(\"ikon.png\").resize(n,n).png().toBuffer()));
      const ico=await pngToIco(png); fs.writeFileSync(\"ikon.ico\",ico);
      const exe=\"out/MyAlwisUjian-win32-x64/MyAlwisUjian.exe\";
      const e=ResEdit.NtExecutable.from(fs.readFileSync(exe),{ignoreCert:true});
      const r=ResEdit.NtExecutableResource.from(e);
      const ikon=ResEdit.Data.IconFile.from(ico);
      ResEdit.Resource.IconGroupEntry.replaceIconsForResource(r.entries,1,1033,ikon.icons.map(i=>i.data));
      r.outputResource(e); fs.writeFileSync(exe,Buffer.from(e.generate()));
      console.log(\"ikon terpasang\");
    })().catch(x=>{console.error(x);process.exit(1)});
  "
  cd out && rm -f /kerja/myalwis-ujian-windows.zip && mv MyAlwisUjian-win32-x64 MyAlwisUjian && zip -qr9 /kerja/myalwis-ujian-windows.zip MyAlwisUjian
'
docker exec smk_almunawwir_app mkdir -p /app/public/uploads/unduh
docker cp "$K/kerja/myalwis-ujian-windows.zip" smk_almunawwir_app:/app/public/uploads/unduh/myalwis-ujian-windows.zip
ls -la "$K/kerja/myalwis-ujian-windows.zip"
echo "EXE SELESAI"
