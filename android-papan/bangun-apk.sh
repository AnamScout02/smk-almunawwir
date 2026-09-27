#!/bin/bash
# BANGUN APK MyAlwis Papan (rilis, ditandatangani) → public/unduh/myalwis-papan.apk
#
# Aplikasi TV sekolah: satu WebView layar penuh, alamatnya dikirim dari dashboard. Memakai KUNCI PENANDATANGAN
# YANG SAMA dengan MyAlwis Mobile (/root/.cache/android-ujian) supaya pengelolaan kuncinya tetap satu tempat —
# kunci itu DI LUAR repo dan wajib dicadangkan.
set -euo pipefail
REPO=$(cd "$(dirname "$0")/.." && pwd)
K=/root/.cache/android-ujian
KERJA=$K/kerja-papan
rm -rf "$KERJA"; mkdir -p "$KERJA" "$K/gradle-home"; cp -r "$REPO/android-papan/." "$KERJA/"
docker run --rm -v "$KERJA":/proyek -v "$K":/kunci:ro -v "$K/gradle-home":/gradle-home -e GRADLE_USER_HOME=/gradle-home \
  -e KUNCI_JKS=/kunci/kunci-rilis.jks -w /proyek ghcr.io/cirruslabs/android-sdk:34 bash -c '
  set -e
  export KUNCI_SANDI="$(cat /kunci/sandi.txt)"
  G=/gradle-home/gradle-8.10.2
  if [ ! -x $G/bin/gradle ]; then curl -fsSL --retry 5 -o /tmp/g.zip https://services.gradle.org/distributions/gradle-8.10.2-bin.zip && unzip -q /tmp/g.zip -d /gradle-home; fi
  $G/bin/gradle --no-daemon --console=plain assembleRelease
'
mkdir -p "$REPO/public/unduh"
cp "$KERJA/app/build/outputs/apk/release/app-release.apk" "$REPO/public/unduh/myalwis-papan.apk"
ls -lh "$REPO/public/unduh/myalwis-papan.apk" | awk '{print "APK siap: "$5" — "$9}'
