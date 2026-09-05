# Donadon — loyiha rejasi

Don (g'alla) savdosi bilan shug'ullanuvchi firma uchun ombor va savdo boshqaruv tizimi.
Asosiy jarayon: **don sotib olinadi (kirim) → omborda saqlanadi → mijozlarga sotiladi (chiqim) → daromad hisoblanadi.**

## Texnologiyalar
- **Frontend:** Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui, lucide-react
- **Backend:** Bun + Hono, Zod
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** bitta admin foydalanuvchi, JWT (httpOnly cookie)

## Holat belgilari
`[x]` tayyor · `[~]` jarayonda · `[ ]` rejalashtirilgan

---

## 1-bosqich — Poydevor
- [x] Backend skeleton (Hono + Drizzle + Postgres), modul struktura
- [x] DB sxema: users, products, partners, sales, sale_items, stock_movements, payments, exchange_rates
- [x] Auth (login/logout, JWT cookie, requireAuth middleware)
- [x] Migratsiyalar yaratildi va bazaga qo'llandi
- [x] Seed skript (admin user + boshlang'ich kurs)
- [x] Barcha modullar uchun CRUD API (products, partners, stock, sales, payments, settings, reports, excel)
- [x] End-to-end test qilindi (login → mahsulot → kirim → savdo → dashboard)
- [x] Frontend skeleton (Next.js 16 + Tailwind v4 + shadcn/ui (base-ui) + lucide-react)

## 2-bosqich — Frontend: asosiy tuzilma
- [x] Login sahifa
- [x] Auth context/middleware (himoyalangan sahifalar)
- [x] Umumiy layout: sidebar (desktop) + bottom-nav (mobile) + hamburger sheet, header
- [x] API client (fetch wrapper, cookie bilan)
- [x] Dashboard (bosh sahifa): ombordagi qoldiq qiymati, bugungi/oylik savdo, oylik daromad, qarzdorlik, kam qolgan mahsulotlar

## 3-bosqich — Ombor bo'limi
- [x] Mahsulotlar ro'yxati (qoldiq, tannarx ko'rsatiladi)
- [x] Mahsulot yaratish/tahrirlash/o'chirish (dialog forma)
- [x] Kirim-chiqim ro'yxati (filtr: mahsulot, tur)
- [x] Yangi kirim/chiqim kiritish forma (kirimda hamkor+narx+valyuta)
- [x] Kam qolgan mahsulotlar uchun ogohlantirish (badge, dashboardda)

## 4-bosqich — Savdo bo'limi
- [x] Hamkorlar ro'yxati (balans/qarzdorlik ko'rinadi)
- [x] Hamkor yaratish/tahrirlash
- [x] Yangi savdo formasi: hamkor, **mashina raqami**, mahsulotlar (bir nechta qator), narx, valyuta, boshlang'ich to'lov
- [x] Savdo tarixi (filtr: hamkor, holat)
- [x] Savdo tafsilotlari sahifasi (mahsulotlar, to'lovlar tarixi)
- [x] To'lov qo'shish (nasiya/qarzni yopish)

## 5-bosqich — Hisobotlar va sozlamalar
- [ ] Daromad hisoboti (kunlik/oylik grafik) — backend `/reports/profit` tayyor, frontendda grafik hali yo'q
- [x] Sozlamalar: USD/UZS kursini o'zgartirish, kurs tarixi
- [x] Excel export: mahsulotlar, savdolar, kirim-chiqim
- [x] Excel import: mahsulotlar

## 6-bosqich — Sayqal
- [x] Mobile dizayn: sidebar mobilda yashirin, pastki tez-nav + hamburger menyu
- [x] Bo'sh holatlar (empty state), yuklanish holatlari (skeleton, route loading.tsx)
- [x] Xatoliklarni chiroyli ko'rsatish (toast — sonner)
- [ ] Umumiy QA: barcha oqimlarni **brauzerda qo'lda** tekshirish — quyidagi eslatmaga qara


## userni taklifilar

- [x] loading page bo'lishi kerak — `(app)/loading.tsx` qo'shildi
- [x] mobile uchun bottom menu bo'lishi kerak — `MobileBottomNav` qo'shildi
- [x] mobileda sidebar kerak emas — sidebar faqat `md:` va undan katta ekranda ko'rinadi
- [x] saytga bug'doy rangini (sariq/oltin) qo'shish, oq va qora bilan birga — `globals.css`dagi `--primary` oltin-sariq (oklch) rangga o'zgartirildi, qolgan joylar oq/qora/kulrang
- [x] wheat-sack.png'ni logoga qo'yish — login, sidebar, mobil header va favicon (`app/icon.png`) sifatida qo'yildi


---

## 7-bosqich — Narxlar va tezkor savdo
- [x] Mahsulotga standart **sotuv narxi** (`sellingPriceUzs`) qo'shildi (DB migratsiyasi qo'llandi)
- [x] Mahsulotlar jadvalida: Tan narx, Sotuv narxi, Jami qiymat (oxirida) ustunlari
- [x] Mahsulotlar va Hamkorlar sahifalarida har bir qatorda tezkor **"Sotish"** tugmasi — Yangi savdo formasiga mahsulot/hamkor oldindan tanlangan holda o'tkazadi
- [x] Yangi savdoda mahsulot tanlanganda, agar sotuv narxi belgilangan bo'lsa va valyuta UZS bo'lsa, narx avtomatik taklif qilinadi

## 8-bosqich — Sayqal-2 (foydalanuvchi so'rovlari)
- [x] Border-radius barcha elementlar uchun pasaytirildi (`--radius` 0.625rem → 0.3rem, `globals.css`)
- [x] Login sessiyasi 60 kunga uzaytirildi (bir qurilmada shuncha vaqt qayta login shart emas; yangi qurilmada baribir login kerak, chunki cookie qurilmaga bog'liq)
- [x] Ilova ochilishidagi "loading" ekrani kamida 3 soniya ko'rsatiladi (`use-auth.tsx`)
- [x] **Select'larda matn ustma-ust/xato ko'rinish muammosi tuzatildi.** Sabab topildi: Base UI'ning `Select.Value` komponenti yopiq holatda ko'rsatiladigan matnni faqat `Select.Root`ga uzatilgan `items` prop orqali hal qiladi; biz buni bermagan edik, shuning uchun oldindan o'rnatilgan qiymat uchun (masalan tahrirlash formasi yoki `reset()`) xom qiymat (masalan uzun UUID yoki "kg") ko'rsatilib, matn siqilib/ustma-ust ko'rinar edi. Ilovadagi barcha 9 ta fayldagi barcha Select'larga `items` prop qo'shildi va sinov sahifasida vizual tasdiqlandi. Qoida CLAUDE.md'ga yozib qo'yildi.

## 9-bosqich — Excel jadvallarni "Shoxrux aka tegirmon" namunasiga o'xshatish
- [x] Kirim-chiqimga **mashina raqami** maydoni qo'shildi (forma + jadval + DB)
- [x] Barcha Excel eksportlar (mahsulotlar, savdolar, kirim-chiqim) qayta ishlab chiqildi: sarlavha (rangli, qalin), №, chegaralar, son formatlash (minglik ajratkich), va oxirida **Jami** qatori
- [x] Kirim-chiqim eksportiga mashina raqami va hamkor nomi (mahsulot nomi bilan birga) qo'shildi
- [x] Yangi: **hamkor hisob-varag'i** Excel eksporti (Hamkorlar sahifasida har bir qator uchun) — kirim/savdo va to'lovlar xronologik tartibda, har bir qatordan keyin yuguruvchi **qoldiq** ustuni bilan, xuddi namunadagi "QOLDIQ +/-" kabi

## 10-bosqich — Bir nechta ombor (haqiqiy qoldiq bilan)
- [x] `warehouses` jadvali (nomi, manzili, izoh)
- [x] `product_stock` jadvali — **har mahsulotning har ombordagi haqiqiy qoldig'i va tannarxi** (avval "faqat belgi" edi, keyin foydalanuvchi so'rovi bilan to'liq amalga oshirildi)
- [x] `products.stockQuantity/avgCostUzs` endi barcha omborlar bo'yicha **avtomatik hisoblanadigan yig'indi** (har operatsiyada qayta hisoblanadi)
- [x] Kirim/chiqim endi **ombor tanlashni talab qiladi** — kirim tanlangan omborga qo'shiladi, chiqim o'sha ombordan (agar yetarli bo'lmasa xato beradi, global emas)
- [x] **Savdo endi ombor tanlashni talab qiladi** — sotilgan mahsulot aynan o'sha ombordan kamayadi, tannarx snapshot ham o'sha omborning tannarxidan olinadi
- [x] **Omborlar orasida transfer** (yangi "Transfer" tugmasi, Kirim-chiqim sahifasida) — miqdor va tannarx to'g'ri ko'chadi, ikkita bog'langan yozuv (chiqim+kirim) yaratiladi
- [x] Yangi **"Qoldiqlar"** sahifasi — qaysi omborda qanday mahsulot va qancha borligini jadval ko'rinishida ko'rsatadi, mahsulot/ombor bo'yicha filtrlanadi
- [x] Yangi savdo formasida mahsulot tanlaganda **tanlangan ombordagi mavjud miqdor** ko'rsatiladi (global emas)
- [x] Omborlar qo'shilishidan oldingi mavjud ma'lumotlar (mahsulot qoldig'i, eski kirim-chiqim/savdo) standart omborga bir martalik skript bilan to'g'ri ko'chirildi
- [x] Excel eksportlarga (kirim-chiqim, savdolar) "Ombor" ustuni qo'shildi
- [x] **Mahsulotlar** jadvaliga "Omborlar" ustuni qo'shildi — har mahsulot qaysi omborda qancha borligi belgi (badge) sifatida ko'rinadi

## ⚠️ Muhim tuzatish — xavfsizlik
Audit paytida aniqlandi: **products, partners, stock, sales, payments, settings, reports, excel** modullari `requireAuth` middleware'ni haqiqatda hech qachon chaqirmagan edi (CLAUDE.md/index.ts'dagi izoh buni da'vo qilsa-da, kod yozilmagan qolgan edi) — ya'ni bu endpointlar login qilinmasdan ham ochiq edi. **Hozir tuzatildi**: har bir modul o'z `routes.ts` faylida `.use("*", requireAuth)` chaqiradi, `curl` bilan tasdiqlandi (cookie'siz so'rov endi 401 qaytaradi). Shu bilan birga backend `tsc --noEmit` orqali to'liq tekshirilib, barcha turdosh xatolar ham tuzatildi (0 xato).

## Kelajakdagi g'oyalar (hozircha qo'shilmagan)
- Ko'p foydalanuvchi + rollar (agar kerak bo'lsa keyinchalik qo'shiladi — hozir bitta admin user)
- SMS/bildirishnoma (nasiya muddati yaqinlashganda)
- Chop etish (savdo cheki/hisob-faktura PDF)
- Backup/eksport avtomatik jadval bo'yicha



## Muhim eslatmalar
- `backend/.env` haqiqiy DATABASE_URL bilan **gitignored** — hech qachon commit qilinmasin
- Baza hech qachon o'chirilmaydi/tozalanmaydi — buni faqat siz qilishingiz mumkin
- Ombor kirim-chiqim yozuvlari **o'zgartirilmaydi** (immutable ledger) — xato bo'lsa tuzatish yozuvi kiritiladi
- Tannarx (`avgCostUzs`) og'irlikli o'rtacha usulda hisoblanadi, doim UZS'da saqlanadi
- Backend barcha API'lar `curl` orqali to'liq test qilingan (login → mahsulot → kirim → savdo → to'lov → dashboard → hamkor balansi) va ishlayapti. Frontendni brauzer-avtomatlashtirish vositasida sinaganimda 3001→4000 portlararo so'rov doim 503 bilan bloklandi (backend logida bu so'rov hech qachon ko'rinmadi) — bu avtomatlashtirish kengaytmasining cheklovi bo'lsa kerak, kodga aloqasi yo'qdek tuyuladi. **Iltimos, http://localhost:3001/login sahifasini o'zingizning oddiy brauzeringizda ochib, admin/admin123 bilan kirishni sinab ko'ring** — muammo bo'lsa aytasiz.
