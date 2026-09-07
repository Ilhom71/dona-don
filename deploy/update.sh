#!/usr/bin/env bash
# Serverda loyihani yangilash: git pull -> backend/frontend install ->
# migratsiya -> build -> PM2 orqali qayta ishga tushirish.
# Ishlatish: bash deploy/update.sh (loyiha tub papkasidan)
set -e

cd "$(dirname "$0")/.."

echo "==> Git pull..."
git pull

echo "==> Backend yangilanmoqda..."
cd backend
bun install
bun run db:migrate
cd ..

echo "==> Frontend yangilanmoqda..."
cd frontend
npm install
npm run build
cd ..

echo "==> PM2 qayta ishga tushirilmoqda..."
pm2 restart donadon-backend donadon-frontend

echo "==> Tayyor. Holatni tekshirish uchun: pm2 status"
