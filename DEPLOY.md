# Donadon - VPS'ga qo'yish (deploy) qo'llanmasi

Bu qo'llanma **toza Ubuntu VPS** (22.04/24.04, root yoki sudo huquqi bilan) uchun.
`domeningiz.uz` - o'zingizning domen nomingizga almashtiring (domen bo'lmasa, IP orqali ham ishlaydi, faqat SSL bosqichini o'tkazib yuborasiz).

Har bir buyruq **serverda, SSH orqali** ishga tushiriladi (`ssh root@server-ip`).

---

## 1-qadam: Tizimni tayyorlash

```bash
apt update && apt upgrade -y
apt install -y git curl build-essential nginx postgresql postgresql-contrib ufw
```

## 2-qadam: Node.js (frontend uchun) o'rnatish

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v   # v22.x ko'rinishi kerak
```

## 3-qadam: Bun (backend uchun) o'rnatish

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun -v
```

## 4-qadam: PM2 (jarayonlarni doim ishlab turishi uchun) o'rnatish

```bash
npm install -g pm2
```

## 5-qadam: PostgreSQL - baza va foydalanuvchi yaratish

```bash
sudo -u postgres psql
```

PostgreSQL konsolida:

```sql
CREATE DATABASE donadon;
CREATE USER donadon_user WITH ENCRYPTED PASSWORD 'kuchli-parol-shu-yerga';
GRANT ALL PRIVILEGES ON DATABASE donadon TO donadon_user;
\c donadon
GRANT ALL ON SCHEMA public TO donadon_user;
\q
```

## 6-qadam: Loyihani serverga olib kelish

```bash
mkdir -p /var/www && cd /var/www
git clone <sizning-git-repo-manzilingiz> donadon
cd donadon
```

(Agar hali GitHub/GitLab'da bo'lmasa - lokal kompyuterdan `scp -r` bilan ham ko'chirish mumkin, lekin `git` qulayroq, keyingi yangilanishlar uchun ham kerak bo'ladi.)

## 7-qadam: Backend sozlash

```bash
cd /var/www/donadon/backend
cp .env.example .env
nano .env
```

`.env` faylida to'ldiring:

```
DATABASE_URL=postgresql://donadon_user:kuchli-parol-shu-yerga@localhost:5432/donadon
JWT_SECRET=<kamida 32 ta belgidan iborat tasodifiy satr>
PORT=4000
FRONTEND_ORIGIN=https://domeningiz.uz
```

`JWT_SECRET` uchun tasodifiy qiymat generatsiya qilish:

```bash
openssl rand -base64 48
```

So'ng:

```bash
bun install
bun run db:migrate    # barcha migratsiyalarni bazaga qo'llaydi
bun run seed          # admin user + boshlang'ich kurs yaratadi
```

**Muhim:** `seed` skripti admin login/parolni terminalga chiqaradi (yoki koddan ko'rasiz) - shuni yozib qo'ying, keyin frontenddan shu bilan kirasiz.

## 8-qadam: Frontend sozlash

```bash
cd /var/www/donadon/frontend
cat > .env.production <<'EOF'
NEXT_PUBLIC_API_URL=https://domeningiz.uz/api
EOF
npm install
npm run build
```

(IP orqali ishlatilsa, `https://domeningiz.uz/api` o'rniga `http://server-ip/api` yoziladi.)

## 9-qadam: PM2 bilan ikkalasini ham ishga tushirish

Loyiha tub papkasida (`/var/www/donadon`) tayyor `ecosystem.config.cjs` fayli bor - shundan foydalaning:

```bash
cd /var/www/donadon
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup    # server qayta yuklansa ham avtomatik ishga tushishi uchun - chiqadigan buyruqni nusxalab bajaring
```

Tekshirish:

```bash
pm2 status
pm2 logs donadon-backend
pm2 logs donadon-frontend
```

## 10-qadam: Nginx sozlash (reverse proxy)

`deploy/nginx.conf.example` faylidagi tayyor konfiguratsiyani ishlatamiz:

```bash
cp /var/www/donadon/deploy/nginx.conf.example /etc/nginx/sites-available/donadon
nano /etc/nginx/sites-available/donadon   # "domeningiz.uz" ni haqiqiy domeningizga almashtiring
ln -s /etc/nginx/sites-available/donadon /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default    # standart sahifani o'chirish (ixtiyoriy)
nginx -t                                  # xatolik yo'qligini tekshiradi
systemctl restart nginx
```

## 11-qadam: Domen DNS

Domen boshqaruv panelingizda (masalan Cloudflare, Reg.uz) **A yozuvi** qo'shing:
`domeningiz.uz` → server IP manzili (va xohlasangiz `www` uchun ham xuddi shunday).
O'zgarish tarqalishi bir necha daqiqadan bir necha soatgacha (odatda tez) davom etishi mumkin.

## 12-qadam: SSL (HTTPS) - Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d domeningiz.uz -d www.domeningiz.uz
```

Certbot Nginx konfiguratsiyasini avtomatik HTTPS'ga moslab qo'yadi va sertifikatni har 90 kunda o'zi yangilab turadi.

## 13-qadam: Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## Tayyor! Tekshirish

- `https://domeningiz.uz` - frontend ochilishi kerak, login sahifasi ko'rinadi
- `seed` bosqichida yozib olgan login/parol bilan kiring

---

## Keyingi yangilanishlarni serverga qo'yish

Loyihaga yangi o'zgarish (yangi feature/tuzatish) qo'shilgach, serverni yangilash:

```bash
cd /var/www/donadon
git pull

cd backend
bun install
bun run db:migrate     # agar yangi migratsiya bo'lsa
pm2 restart donadon-backend

cd ../frontend
npm install
npm run build
pm2 restart donadon-frontend
```

Bularni har safar qo'lda yozmaslik uchun `deploy/update.sh` skriptidan foydalaning:

```bash
bash /var/www/donadon/deploy/update.sh
```

---

## Muammo bo'lsa

- `pm2 logs donadon-backend` / `pm2 logs donadon-frontend` - xatoliklarni ko'rish uchun birinchi joy
- `systemctl status nginx` va `nginx -t` - Nginx muammolarini tekshirish uchun
- `sudo -u postgres psql -d donadon -c '\dt'` - baza jadvallari to'g'ri yaratilganini tekshirish
