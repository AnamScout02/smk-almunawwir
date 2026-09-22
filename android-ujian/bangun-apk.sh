#!/bin/bash
# BANGUN APK Aplikasi Ujian (rilis, ditandatangani) → public/unduh/aplikasi-ujian-smk.apk
# Kunci penandatangan & sandinya di /root/.cache/android-ujian (DI LUAR repo, WAJIB dicadangkan: tanpa kunci yang sama
# versi baru tidak bisa dipasang menimpa versi lama di HP siswa). Naikkan versionCode/versionName di app/build.gradle,
# VERSI di MainActivity.java, dan VERSI_APLIKASI di src/lib/aplikasi-ujian.ts setiap rilis baru.
set -euo pipefail
REPO=$(cd "$(dirname "$0")/.." && pwd)
K=/root/.cache/android-ujian
KERJA=$K/kerja
rm -rf "$KERJA"; mkdir -p "$KERJA" "$K/gradle-home"; cp -r "$REPO/android-ujian/." "$KERJA/"
docker run --rm -v "$KERJA":/proyek -v "$K":/kunci:ro -v "$K/gradle-home":/gradle-home -e GRADLE_USER_HOME=/gradle-home \
  -e KUNCI_JKS=/kunci/kunci-rilis.jks -w /proyek ghcr.io/cirruslabs/android-sdk:34 bash -c '
  set -e
  export KUNCI_SANDI="$(cat /kunci/sandi.txt)"
  G=/gradle-home/gradle-8.10.2
  if [ ! -x $G/bin/gradle ]; then curl -fsSL --retry 5 -o /tmp/g.zip https://services.gradle.org/distributions/gradle-8.10.2-bin.zip && unzip -q /tmp/g.zip -d /gradle-home; fi
  $G/bin/gradle --no-daemon --console=plain assembleRelease
'
mkdir -p "$REPO/public/unduh"
cp "$KERJA/app/build/outputs/apk/release/app-release.apk" "$REPO/public/unduh/aplikasi-ujian-smk.apk"
ls -la "$REPO/public/unduh/aplikasi-ujian-smk.apk"
echo "APK SELESAI"
