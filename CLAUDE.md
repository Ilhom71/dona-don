# Donadon

Don (g'alla) savdosi bilan shug'ullanuvchi firma uchun **ombor + savdo** boshqaruv tizimi.
Asosiy biznes jarayoni: don sotib olinadi (kirim) → omborda saqlanadi → mijozlarga sotiladi (chiqim) → daromad hisoblanadi.

To'liq funksional reja va progress uchun [PLAN.md](./PLAN.md) ga qara — yangi feature qo'shganda yoki tugatganda o'sha faylni ham yangilab bor.

## Loyiha tuzilishi

Monorepo, ikkita alohida ilova:
- `backend/` — Bun + Hono API server
- `frontend/` — Next.js ilova

Ikkalasi ham mustaqil `package.json`/`bun.lock` ga ega, birga bog'lanmagan (workspace emas).

## Texnologiyalar

| Qatlam | Texnologiya |
|---|---|
| Frontend | Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui, lucide-react |
| Backend | Bun runtime, Hono, Zod (validatsiya) |
| Database | PostgreSQL, Drizzle ORM |
| Auth | Bitta admin foydalanuvchi, JWT httpOnly cookie (rollar yo'q) |

## Ishga tushirish

```bash
# Backend (http://localhost:4000)
cd backend
cp .env.example .env   # DATABASE_URL va JWT_SECRET to'ldiring
bun install
bun run db:migrate     # migratsiyalarni qo'llash
bun run seed           # admin user + boshlang'ich kurs yaratish
bun run dev

# Frontend (http://localhost:3000)
cd frontend
npm install
npm run dev
```

---

## Umumiy qoidalar

- **Til:** Kod (o'zgaruvchi/funksiya/jadval nomlari, kommentariyalar) — inglizcha. UI matnlari, xato xabarlari, validatsiya xabarlari — **o'zbekcha** (foydalanuvchi shu tilda ishlaydi). Domen atamalari (kirim/chiqim/savdo) enum qiymatlarida inglizcha (`in`/`out`), lekin frontendda o'zbekcha labelga map qilinadi.
- **Pul birliklari:** faqat `UZS` va `USD`. Har qanday pul bilan bog'liq yozuv (savdo, to'lov, kirim-chiqim) valyutani va o'sha paytdagi kursni (`exchangeRateSnapshot`) o'zida saqlaydi — keyinchalik kurs o'zgarsa ham tarixiy hisobotlar noto'g'ri bo'lib qolmasligi kerak.
- **O'lchov birligi:** mahsulotlar faqat `kg` yoki `ton` da hisoblanadi.
- **Immutable ledger:** `stock_movements` (kirim-chiqim) va `sale_items`/`sales` yozuvlari yaratilgandan keyin o'chirilmaydi/tahrirlanmaydi. Xato bo'lsa — teskari operatsiya (tuzatish yozuvi) kiritiladi. Bu moliyaviy audit trail uchun muhim.
- Yangi feature qo'shganda yoki katta o'zgarish qilganda **PLAN.md**dagi tegishli bandni yangilab qo'y (checkbox belgisi + kerak bo'lsa yangi band qo'shish).

---

## Backend qoidalari (`backend/`)

- **Struktura:** har bir domen o'z papkasida (`src/modules/<domen>/`), ichida `routes.ts` (Hono routerlar, validatsiya) va `service.ts` (biznes logika, DB so'rovlari). Route handlerlar to'g'ridan-to'g'ri DB'ga murojaat qilmaydi — har doim `service.ts` orqali.
- **Validatsiya:** har bir POST/PUT endpoint kirish ma'lumotini Zod sxema bilan tekshiradi (`safeParse`, xato bo'lsa 400 + o'zbekcha xabar).
- **Auth:** himoyalanishi kerak bo'lgan har bir modul sub-router o'zining `routes.ts` faylida `.use("*", requireAuth)` qo'shadi (global `/*` middleware ishlatilmaydi — Hono'da bu public route'lar bilan tartib nizosini keltirib chiqarishi mumkin).
- **Pul bilan bog'liq operatsiyalar** (savdo yaratish, to'lov, kirim-chiqim) — bir nechta jadvalga yozadigan bo'lsa har doim `db.transaction()` ichida, va parallel yozuvlardan himoyalanish uchun kerak bo'lsa `.for("update")` bilan qatorni bloklaydi (masalan mahsulot qoldig'ini yangilashda race condition oldini olish uchun).
- **Drizzle `sql` shablonidan foydalanishda ehtiyot bo'l:** `sql\`...${table.column}...\`` ustunni jadval prefiksisiz chiqaradi. Bu **correlated subquery** ichida tashqi jadval ustuniga murojaat qilganda va ichki jadvalda xuddi shunday nomli ustun bo'lsa (masalan ikkala jadvalda ham `id`) — noto'g'ri (shadowing) natija berishi mumkin, hech qanday xato chiqarmasdan. Bunday hollarda subquery o'rniga guruhlangan **derived table** (`.as()`) + `leftJoin` ishlatilsin (`backend/src/modules/partners/service.ts` dagi `listPartnersWithBalance` namunaga qara).
- **Tannarx hisobi:** `products.avgCostUzs` — og'irlikli o'rtacha tannarx, doim UZS'da saqlanadi, faqat kirim (`type: "in"`) operatsiyasida yangilanadi. Savdo qilinganda `sale_items.costPriceUzsSnapshot`ga o'sha paytdagi qiymat "suratga olinadi" (snapshot) — bu daromad hisobotining tarixiy to'g'riligini ta'minlaydi.
- Yangi modul qo'shsang — `src/index.ts`da `app.route(...)` bilan ro'yxatdan o'tkazishni unutma.

## Frontend qoidalari (`frontend/`)

- **UI komponentlar:** shadcn/ui (Tailwind ustida) ishlatiladi — yangi UI element kerak bo'lsa avval shadcn'da mavjudligini tekshir (`npx shadcn@latest add <component>`), noldan yozishdan oldin. Bu loyihadagi shadcn "base-nova" uslubi **Radix emas, [Base UI](https://base-ui.com/react)** primitivlariga asoslangan — `asChild` mavjud emas (`render` prop ishlatiladi, yoki oddiygina `buttonVariants()` klassi bilan boshqa elementni stillash osonroq).
- **`<Select>` har doim `items` prop bilan ishlatilsin:** Base UI'da `Select.Value` yopiq holatda ko'rsatiladigan matnni faqat `Select.Root`ga uzatilgan `items` prop orqali to'g'ri hal qiladi (`items={[{value, label}, ...]}`). Agar `items` berilmasa, oldindan/dastur orqali o'rnatilgan qiymat uchun (masalan tahrirlash formasida) **xom qiymat** (masalan UUID) ko'rsatiladi — bu foydalanuvchiga uzun/tushunarsiz matn sifatida ko'rinadi. `SelectItem` bilan qatorma-qator bir xil ro'yxatni `items` massiviga ham yozib qo'yish shart (`src/components/movement-form-dialog.tsx`dagi namunaga qara).
- **Ikonkalar:** faqat `lucide-react`.
- **Stil:** Tailwind utility-class asosida, alohida CSS fayl yozilmaydi (global.css faqat token/reset uchun).
- **Responsive:** har bir sahifa mobil ekranda (~375px) ham to'g'ri ko'rinishi shart — desktopda sidebar navigatsiya, mobilda pastki tab-bar yoki hamburger menyu.
- **API bilan ishlash:** markaziy `lib/api.ts` fetch wrapper orqali (cookie avtomatik yuboriladi, xatolarni birxil formatda ushlaydi). To'g'ridan-to'g'ri sahifa ichida `fetch()` chaqirilmaydi.
- **Pul formatlash:** UZS va USD alohida formatlovchi funksiyalar bilan ko'rsatiladi (`lib/format.ts`), doim valyuta belgisi/kodi bilan birga.
- **Forma validatsiyasi:** react-hook-form + zod (backend sxemasiga mos).
- **Sana/vaqt:** foydalanuvchiga ko'rinadigan joyda mahalliy (Toshkent) formatda, lekin serverga ISO formatda yuboriladi.

## Ma'lumotlar bazasi qoidalari

- Sxema yagona manba — `backend/src/db/schema.ts`. Har qanday jadval o'zgarishi shu faylda qilinadi, so'ng:
  ```bash
  bun run db:generate   # migratsiya SQL faylini yaratadi
  bun run db:migrate    # bazaga qo'llaydi
  ```

  `drizzle-kit push` ishlatilmaydi (production'ga mos emas, interaktiv tasdiqlash talab qiladi) — har doim `generate` + `migrate`.
- Barcha jadvallar `uuid` primary key (`defaultRandom()`) ishlatadi.
- Pul ustunlari `numeric` turida (float emas — yaxlitlash xatolarining oldini olish uchun); kodda JS `number`ga faqat hisoblash vaqtida o'giriladi, DB'da har doim string sifatida saqlanadi/qaytariladi.
- `.env` fayl **hech qachon** commit qilinmaydi (haqiqiy DB parol/JWT_SECRET saqlanadi). Yangi muhit o'zgaruvchisi qo'shsang — `.env.example`ni ham yangilab, faqat placeholder qiymat qo'y.
- hech qachon database o'chirma buni faqat user o'chirish mumkin 


umimy qoidalar 
- user qilyotga ishlar ko'rsatib tur 
- claude icont template va boshqa emojilarda foydalanman 
- codelar commet bilan yoz 
- user loyiha server joylash dan oldin sen code xatolar ko'rbi chiq
- nima o'rnatgan larni va boshqa nimalar qilyotgani userga aytib tur
- user har doim run qilib tekshiradi o'zin run qilma backend va frontendni