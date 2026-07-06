#!/bin/bash
set -e
cd /root/smk-almunawwir

echo ">> Menarik kode terbaru dari GitHub..."
git pull origin main

echo ">> Build & restart container..."
docker compose up -d --build

echo ">> Bersihkan image lama yang menganggur..."
docker image prune -f

echo ">> Status container:"
docker compose ps
