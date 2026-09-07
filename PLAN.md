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
- [x] USD/UZS kursini o'zgartirish, kurs tarixi (14-bosqichda alohida "Sozlamalar" sahifasidan Kassa/bosh sahifaga ko'chirildi)
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

## 11-bosqich — Hamkor hisob-varag'i (ekranda), yuk puli va savdoni bekor qilish
- [x] `sale_items`ga **yuk puli** (`freightCostUzs`, doim UZS) ustuni qo'shildi — Yangi savdo formasida har bir mahsulot qatorida alohida kiritiladi, hamkorning umumiy qarziga (`totalAmountUzs`) qo'shiladi
- [x] Yangi sahifa: **Savdo tarixi → hamkor nomini bosish → hamkorning to'liq hisob-varag'i** (`/savdo/hamkorlar/[id]`) — har bir sotilgan mahsulot qatori (mashina raqami, kg, narx, yuk puli) va har bir to'lov, sana bo'yicha ketma-ket, yuguruvchi **Qoldiq** ustuni bilan (image.png namunasidagi "Shoxrux aka tegirmon" jadvaliga o'xshash). Hamkorlar sahifasidagi nomdan ham shu sahifaga o'tiladi
- [x] Savdo tarixida checkbox bilan bir nechta qator tanlash: **tanlanganlarni Excel'ga eksport** yoki **tanlanganlarni bekor qilish (storno)**
- [x] Savdoni bekor qilish (storno): yozuv o'chirilmaydi/tahrirlanmaydi (immutable ledger qoidasi) — sotilgan mahsulot o'sha tannarx bilan omborga qaytariladi (teskari kirim yozuvi, `source: "sale_reversal"`), `sales.cancelledAt`/`cancelReason` to'ldiriladi, holati "Bekor qilingan" bo'ladi. Bekor qilingan savdolar hisobot/balans/qarzdorlik hisob-kitoblaridan chiqarib tashlanadi (lekin avval qilingan haqiqiy to'lovlar hamkor balansida qoladi)
- [x] Savdo tafsilotlari sahifasida (`/savdo/tarix/[id]`) ham "Bekor qilish" tugmasi va yuk puli ustuni qo'shildi

## 12-bosqich — Kassa va xarajatlar
- [x] `expenses` jadvali (kategoriya, hamkor, summa, valyuta+kurs snapshot, to'lov usuli, tavsif, sana)
- [x] Backend: `expenses` moduli (`POST/GET /expenses`, kategoriya/sana bo'yicha filtr) va `cash` moduli (`GET /cash/ledger`, `GET /cash/summary`)

## 13-bosqich — Kassa markazlashtirilishi, xarid (kirim) va ombor birlashtirilishi
- [x] **Omborga kirim (xarid) to'liq qayta qurildi** — yangi `purchases`/`purchase_items` jadvallari (`sales`/`sale_items`ga parallel). Yangi sahifa `/ombor/kirim`: hamkor (yetkazib beruvchi), bir nechta mahsulot qatori (kg, narx/kg, yuk puli), mashina raqami, sana, yetkazib beruvchiga to'lov — jami summalar avtomatik hisoblanadi. **Yuk puli tannarxga qo'shiladi** (landed cost: (mahsulot summasi + yuk puli) / miqdor) — bu keyingi savdolarda daromadni to'g'ri hisoblaydi. Yetkazib beruvchiga to'lov mavjud `expenses` (`category: "supplier_payment"`) orqali yoziladi, shu bilan avtomatik Kassa lentasida ko'rinadi
- [x] **Hamkor balansi** endi ikkala yo'nalishni birlashtiradi: `balanceUzs = (savdolar - to'lovlar) - (xaridlar - yetkazib beruvchiga to'lovlar)`. Musbat = hamkor bizga qarzdor, manfiy = biz hamkorga qarzdormiz. Hamkor hisob-varag'i sahifasida (`/savdo/hamkorlar/[id]`) xarid va yetkazib beruvchiga to'lov qatorlari ham ko'rinadi
- [x] **Ombor + Qoldiqlar bitta sahifaga birlashtirildi** (`/ombor/omborlar`) — omborlar kartalar ko'rinishida (jami og'irlik + jami qiymat bilan), kartaga bosilganda o'sha ombordagi mahsulotlar alohida oynada (dialog) ko'rinadi, u yerdan bevosita "Kirim qilish"ga o'tiladi. Alohida "Qoldiqlar" sahifasi o'chirildi
- [x] Hamkorlar ro'yxatida aniq **"Tarix"** tugmasi qo'shildi (ilgari faqat nomni bosish orqali o'tilardi)
- [x] Barcha jadvallarda toq/juft qatorlar farqlanadi (zebra-striping, `ui/table.tsx`)
- [ ] **Qamrovdan tashqarida (keyingi bosqich):** SMS orqali qarzdorlik eslatmasi (provayder hali tanlanmagan), xaridni bekor qilish (storno) va xarid tafsilot sahifasi

## 14-bosqich — Arxiv, Kassa = bosh sahifa, Sozlamalar olib tashlandi
- [x] **"O'chirish" endi arxivlash** — Mahsulotlar, Hamkorlar, Omborlarda "O'chirish" bosilganda yozuv butunlay o'chirilmaydi, `archivedAt` bilan belgilanadi (ro'yxatlarda ko'rinmay qoladi, lekin tarixiy savdo/xarid/kirim-chiqim yozuvlaridagi bog'lanish buzilmaydi). Hamkorlar sahifasiga ilgari yo'q bo'lgan "O'chirish" tugmasi ham qo'shildi
- [x] Yangi **Arxiv** sahifasi (`/arxiv`) — arxivlangan mahsulot/hamkor/ombor ro'yxati, har biri uchun **"Tiklash"** tugmasi (butunlay o'chirish yo'q — hammasi tiklanishi mumkin bo'lishi kerak degan qaror bilan)
- [x] **Kassa endi ilovaning bosh sahifasi** (`/`) — alohida "Bosh sahifa" va "Kassa" sahifalari birlashtirildi. Umumiy holat kartalari, kam qolgan mahsulotlar, **foyda-zarar hisoboti** (daromad, tannarx, yalpi/sof foyda, xarajatlar kategoriya bo'yicha — ilgari yozilgan-u hech qayerda ko'rinmagan `getAccountingReport` endi `/reports/accounting`ga ulandi), USD/UZS kursi (tahrirlash + tarix)
- [x] **Sozlamalar sahifasi olib tashlandi** — undagi yagona funksiya (USD/UZS kursi) Kassa/bosh sahifaga ko'chirildi
- [x] **Kassa bo'limining o'z ichki nav-tab qatori** (`KassaSubNav`, sidebar'dan tashqari, sahifa tepasida) — 4 ta alohida to'liq sahifa: **Kassa** (`/`, umumiy holat), **Kassa amaliyotlari** (`/kassa/amaliyotlari` — kirim/chiqim/xarajat tugmalari + to'liq kassa lentasi, ilgari bosh sahifada turgan qism shu yerga ko'chdi), **Savdolar** (`/kassa/savdolar` — barcha savdolar summa/to'langan/qoldiq balans ustunlari bilan, mavjud "Savdo tarixi"dan farqli, sof moliyaviy ko'rinish), **Hamkorlar** (`/kassa/hamkorlar` — har hamkor uchun mijoz qarzi / bizning qarzimiz / umumiy balans, mavjud "Hamkorlar"dan farqli, sof moliyaviy ko'rinish)
- [x] Nav endi: **Kassa** (bosh sahifa), Ombor, Savdo, **Arxiv** — "Bosh sahifa", "Moliya", "Sozlamalar" alohida bandlar sifatida yo'q

## 15-bosqich — Kassa amaliyotlarini bekor qilish/tiklash, bekor qilinganlar Arxivda
- [x] `expenses`, `cash_transactions` va `payments` jadvallariga `cancelledAt`/`cancelReason` qo'shildi (sales'dagi storno naqshiga parallel). To'lov bekor qilinsa/tiklansa, bog'liq savdoning `paidAmountUzs`/holati ham qaytadan hisoblanadi
- [x] **Kassa amaliyotlari** sahifasida **har bir** yozuv (mijozdan to'lov, xarajat, qo'lda kirim/chiqim — barchasi) uchun **"Bekor qilish"** tugmasi. Bekor qilingan yozuv ro'yxatdan **butunlay chiqib ketadi** (faqat Arxivda ko'rinadi) — kassa qoldig'i va hamkor balansidan ham chiqarib tashlanadi
- [x] **Savdolar** (Kassa bo'limi) sahifasida ham har bir savdo uchun **"Bekor qilish"** tugmasi qo'shildi (mavjud `/sales/:id/cancel`ni qayta ishlatadi); bekor qilingan savdo shu ro'yxatdan ham chiqib ketadi
- [x] **Arxiv** sahifasiga 2 ta yangi bo'lim: **"Bekor qilingan savdolar"** (faqat ko'rish — ombor bilan bog'liq bo'lgani uchun tiklanmaydi) va **"Bekor qilingan kassa amaliyotlari"** (**"Tiklash"** bilan — to'lov/xarajat/qo'lda yozuv yana faollashadi, shu jumladan to'lov qaytarilsa savdo holati ham to'g'irlanadi)
- [x] Foyda-zarar hisoboti va hamkor balansi hisob-kitoblari bekor qilingan xarajatlarni chiqarib tashlaydi
- [x] Qo'lda kassa kirim/chiqim yozuvlariga **hamkor tanlash** (ixtiyoriy) qo'shildi (`cash_transactions.partnerId`) — masalan hamkordan naqd qarz olindi/berildi kabi holatlar uchun
- [x] Savdo tarixi jadvaliga **"Mahsulot(lar)"** ustuni qo'shildi (`listSales` endi `items`ni ham qaytaradi) — har bir savdoda nima sotilgani ro'yxatda, detalga kirmasdan ko'rinadi
- [x] Kassa (bosh sahifa) foyda-zarar hisobotiga **Kunlik/Oylik/Yillik** tezkor tugmalar qo'shildi — sana oralig'ini bir bosishda o'rnatadi

## 16-bosqich — Ombor va Savdo bo'limlarida ham bekor qilish/arxiv
- [x] **Xaridni bekor qilish** (`cancelPurchase`, sales'dagi storno naqshiga parallel) — ombordan qaytadan ayiriladi (`source: "purchase_reversal"`), xarid tiklanmaydi (bir tomonlama, sales bilan bir xil sababga ko'ra). Kirim-chiqim jadvalida xarid manbali qatorlarda "Bekor qilish" tugmasi (butun xaridni bekor qiladi)
- [x] **Qo'lda kiritilgan ombor yozuvlari** (`stock_movements`, faqat `source: "manual"`) uchun ham "Bekor qilish" + **Arxivdan "Tiklash"** — qoldiq teskari yo'nalishda qaytariladi/qayta qo'llanadi
- [x] Kirim-chiqim va Savdo tarixi ro'yxatlaridan bekor qilingan yozuvlar endi **butunlay chiqib ketadi** (faqat Arxivda ko'rinadi) — avvalgi "xira/belgili" ko'rinish o'rniga, boshqa ro'yxatlar bilan bir xil naqsh
- [x] Arxivga 2 ta yangi bo'lim: **"Bekor qilingan xaridlar"** (faqat ko'rish) va **"Bekor qilingan ombor amaliyotlari"** (**"Tiklash"** bilan)
- [x] Tuzatildi: `getPartnerLedger` va `listPartnersWithBalance` bekor qilingan to'lov/yetkazib beruvchiga to'lovlarni balans hisobidan chiqarib tashlamayotgan edi (xato bor edi, endi to'g'irlandi)
- [x] **Hamkor tanlangan qo'lda kassa kirim/chiqim** endi hamkor balansiga ta'sir qiladi — naqd kirim to'lovga o'xshab qarzni kamaytiradi, naqd chiqim yetkazib beruvchiga to'lovga o'xshab bizning qarzimizni kamaytiradi (masalan: savdo bekor qilingandan keyin mijozga naqd pul qaytarilganda, Kassa → "Chiqim" orqali hamkor tanlab yozib qo'yilsa, balans avtomatik to'g'irlanadi)
- [x] Hamkor balans ko'rinishi soddalashtirildi — "Biz X so'm qarzdormiz" degan gap o'rniga endi faqat summaning o'zi (manfiy holatda "-" belgisi bilan)
- [x] **Qaror:** savdo bekor qilinganda pul avtomatik qaytarilmaydi (kassa qoldig'i o'zgarmaydi) — faqat balans "biz qarzdormiz" tomonga o'tadi; pul jismonan qaytarilganda buni Kassa → "Chiqim" orqali (hamkor tanlab) qo'lda yozib qo'yish kerak
- [x] Kirim-chiqimda **"sale" manbali qatorlarga ham "Bekor qilish" tugmasi** qo'shildi (avval faqat "purchase" va "manual"da bor edi, "ba'zilarida bor, ba'zilarida yo'q" muammosi shu edi) — bosilsa butun savdo bekor qilinadi

## 17-bosqich — Arxivlash izchilligi bo'yicha to'liq audit
Bitta joyni tuzatgandan keyin boshqa joyda xuddi shu turdagi xato chiqib turgani uchun, barcha arxivlash bilan bog'liq so'rovlar bir yo'la tekshirildi va tuzatildi:
- [x] `listProductStock` (Qoldiqlar/Omborlar ko'rinishi) endi arxivlangan **ombor**ning qoldig'ini ham chiqarib tashlaydi (ilgari faqat arxivlangan mahsulot filtrlangan edi)
- [x] Bosh sahifadagi **"Ombordagi qoldiq qiymati"** va **"Kam qolgan mahsulotlar"** endi `product_stock`dan to'g'ridan-to'g'ri (arxivlangan mahsulot/ombor filtri bilan) hisoblanadi — ilgari `products.stockQuantity/avgCostUzs`dagi tayyor (va arxivlashga sezgir bo'lmagan) yig'indidan olinardi
- [x] Mahsulotlar Excel eksporti endi arxivlangan mahsulotlarni chiqarib tashlaydi
- [x] Mahsulot/Omborni "o'chirish" (arxivlash) endi tegishli `stock-levels`/`dashboard` so'rovlarini ham yangilaydi (ilgari sahifani qayta yuklamaguncha eski holat ko'rinib turardi)
- [x] Yangi: **mahsulot miqdorini to'g'irlash** (inventarizatsiya) — Omborlar sahifasidagi har bir mahsulot qatorida, haqiqiy (fizik hisoblangan) miqdorni kiritish orqali, farqi avtomatik oddiy kirim/chiqim yozuvi sifatida qayd etiladi (bekor qilinishi/tiklanishi ham mumkin, boshqa qo'lda yozuvlar kabi)
- [x] Yangi: **mahsulotni tahrirlashda tan narxni qo'lda to'g'irlash** — qiymat mahsulotning barcha omborlardagi qoldiq yozuvlariga ham yoziladi (aks holda keyingi kirim/xaridda avtomatik eski qiymatga qaytib ketardi)
- [x] **`/reports/accounting` (Kassa'dagi foyda-zarar) doim 500 xato qaytarayotgan edi** — sababi topildi: sana oralig'ini solishtirishda `Date` obyekti `sql` shabloniga to'g'ridan-to'g'ri qo'yilgan edi, postgres drayveri buni parametr sifatida serializatsiya qila olmasdi. `gte`/`lte` bilan to'g'irlandi (`getProfitReport`dagi xuddi shu xato ham)
- [x] **"Mijozlar qarzdorligi" (Kassa) va "Qarzdorlik (hozirgi)" (foyda-zarar)** endi Hamkorlar sahifasi bilan **bir xil manbadan** (`listPartnersWithBalance`) hisoblanadi — ilgari faqat rasmiy savdo/to'lovlardan hisoblanardi, shuning uchun Kassadan qo'lda hamkor tanlab kiritilgan to'lov/qarz qaytarish bu raqamga ta'sir qilmasdi
- [x] **Muhim topilgan xato: hamkor hisob-varag'i sahifasidagi (`/savdo/hamkorlar/[id]`) balans belgisi Hamkorlar ro'yxatidagi bilan mos kelmasdi** — sababi: `getPartner(id)` (bitta hamkorni olish) balansni umuman hisoblamasdi, faqat xom `partners` qatorini qaytarardi. Shuning uchun savdo bekor qilingandan keyin ham bu sahifada eski (noto'g'ri) balans ko'rinib turardi. `listPartnersWithBalance`ni bitta hamkor bo'yicha filtrlanadigan qilib qayta qurib, `getPartner` shundan foydalanadigan bo'ldi — endi ikkalasi (ro'yxat va bitta hamkor sahifasi) doim bir xil balansni ko'rsatadi
- [x] Kassa bosh sahifasidagi asosiy kartalarga qisqa tavsif (izoh) qo'shildi - har biri nimani anglatishini tushuntiradi (masalan "Oylik daromad" endi "Sof foyda (tannarx ayirilgan)" deb aniq belgilangan)
- [x] Mahsulotlar va Xarajatlar Excel importi uchun **"Shablon"** tugmasi qo'shildi (`ExcelActions`ga `templatePath`) — kutilgan ustunlarni ko'rsatuvchi bo'sh fayl, bitta namuna qator bilan
- [x] Hamkor balansi endi **rang va ikonka bilan aniq farqlanadi** — qizil + yuqoriga o'q (hamkor bizga qarzdor) va ko'k + pastga o'q (biz hamkorga qarzdormiz), oldingi faqat "-" belgi bilan farqlanishi yetarlicha aniq emas edi. Bu mantiq endi bitta umumiy `BalanceBadge` komponentida (`components/balance-badge.tsx`) — avval 3 ta faylda alohida-alohida yozilgan edi (aynan shu sabab bilan bir joyda tuzatilib, boshqasida unutilib qolgan edi)
- [x] `BalanceBadge` ishorasi foydalanuvchi so'roviga ko'ra almashtirildi: endi **qarz (mijoz bizga qarzdor) — qizil, "−" belgi bilan**; **bizda turgan pul (biz hamkorga qarzdormiz) — yashil, "+" belgi bilan** (yaxshi holat sifatida ko'rsatiladi)

## 18-bosqich — Buxgalteriya (joriy hisob) ajratildi, Kassa faqat kunlik savdo
Foydalanuvchi so'rovi: "Kassa" faqat kunlik naqd savdo kassasi bo'lsin, firmaning rasmiy/joriy hisobi uchun alohida "Buxgalteriya" bo'limi qo'shilsin, u yerdan pul chiqarish (yoki kassadan o'tkazish) imkoniyati bo'lsin — hammasi **dinamik** (jonli) hisoblansin, qattiq kodlangan qiymat bo'lmasin.
- [x] `cash_transactions` jadvaliga yangi `account` ustuni qo'shildi (`"kassa"` | `"buxgalteriya"` enum, standart `"kassa"` — eski yozuvlar avtomatik Kassaga tegishli bo'lib qoladi)
- [x] Backend: `cash/service.ts` bitta umumiy `getLedgerForAccount`/`getSummaryForAccount` funksiyasiga qayta qurildi — `getCashLedger`/`getCashSummary` (Kassa, `payments`+`expenses`+qo'lda "kassa" yozuvlari) va yangi `getAccountingLedger`/`getAccountingSummary` (Buxgalteriya, faqat "buxgalteriya" hisobiga tegishli qo'lda yozuvlar) shu bitta manbadan ishlaydi — ikkalasi ham har doim **jonli** hisoblanadi (qoldiq saqlanmaydi, har so'rovda ledgerdan yig'iladi)
- [x] Yangi `transferToAccounting()` — bitta amalda ikkita bog'liq yozuv yaratadi (kassadan chiqim + buxgalteriyaga kirim), shuning uchun ikkala qoldiq har doim bir-biriga mos keladi
- [x] Yangi `withdrawFromAccounting()` — Buxgalteriyadan pul chiqarish (faqat buxgalteriya qoldig'iga ta'sir qiladi)
- [x] Yangi route'lar: `GET /cash/accounting/ledger`, `GET /cash/accounting/summary`, `POST /cash/accounting/transfer-in`, `POST /cash/accounting/withdraw`. Bekor qilish/tiklash mavjud `/cash/transactions/:id/cancel|restore`dan qayta ishlatiladi (bir xil jadval)
- [x] Frontend: `KassaSubNav`ga 5-tab **"Buxgalteriya"** qo'shildi (`/kassa/buxgalteriya`)
- [x] Yangi sahifa `app/(app)/kassa/buxgalteriya/page.tsx` — joriy hisob qoldig'i, davr kirim/chiqim, "Kassadan o'tkazish"/"Pul chiqarish" tugmalari, harakat jadvali (bekor qilish bilan), **Foyda-zarar hisoboti** va **USD/UZS kursi** kartalari shu yerga ko'chirildi (ilgari Kassa bosh sahifasida edi — endi "rasmiy hisob"ga tegishli joyda)
- [x] Kassa bosh sahifasi (`/`) qayta qurildi — endi faqat **kunlik**: Joriy kassa qoldig'i, Bugungi savdo, Bugungi kirim, Bugungi chiqim + kam qolgan mahsulotlar ogohlantirishi. Davr tanlash tugmalari, foyda-zarar va kurs kartalari olib tashlandi (Buxgalteriyaga ko'chdi)
- [x] Arxiv sahifasiga **"Bekor qilingan buxgalteriya amaliyotlari"** bo'limi qo'shildi (Kassa uchun mavjud bo'lgan bo'limga parallel, alohida `/cash/accounting/ledger` manbasidan)
- [x] Migratsiya: `backend/drizzle/0012_married_mentor.sql` (`cash_account` enum + `cash_transactions.account` ustuni, standart `'kassa'` — mavjud yozuvlar xavfsiz)

## 19-bosqich — To'liq audit: bag va logik xatolarni tekshirish

Foydalanuvchi so'rovi bo'yicha ("loyihani tekshirib chiq bag'lar yo'q xatolar yo'q logik xatolar shularni ko'rib chiq va to'g'irlavor") barcha backend modullar (partners, sales, purchases, payments, stock, expenses, reports, cash, excel) va frontend so'rov-invalidatsiya zanjirlari qayta ko'rib chiqildi. Topilgan va tuzatilgan xatolar:

- [x] **Buxgalteriya o'tkazmasini bekor qilishda faqat bitta tomon bekor bo'lardi** — `transferToAccounting()` kassadan-chiqim + buxgalteriyaga-kirim deb 2 ta bog'liq-bo'lmagan yozuv yaratardi. Agar foydalanuvchi shu yozuvni istalgan tomondan ("Kassa amaliyotlari" yoki "Buxgalteriya" sahifasidan) bekor qilsa, faqat o'sha tomon bekor bo'lib, ikkinchi tomon eskicha qolib ketardi — ikki hisob orasida pul "yo'qolib qolar" yoki "ikki marta hisoblanib qolar" edi. Tuzatildi: `cash_transactions`ga `transferGroupId` ustuni qo'shildi (`stock_movements.transfer_group_id`ga parallel), bekor qilish/tiklash endi guruh bo'yicha ikkalasini birga qamrab oladi (migratsiya `0013_new_loa.sql`)
- [x] **Foyda-zarar hisobotida (`getAccountingReport`) "Yetkazib beruvchiga to'lov" xarajat sifatida ikki marta hisoblanardi** — xariddagi tannarx allaqachon savdo qilinganda COGS (`costPriceUzsSnapshot`) orqali hisobga olinadi; shu bilan birga xarid uchun to'langan pul ham umumiy "Xarajatlar" summasiga qo'shilib, sof foydani sun'iy ravishda kamaytirib turardi. Endi "Yetkazib beruvchiga to'lov" P&L xarajatlar hisobidan chiqarildi (lekin naqd pul oqimi - `cashOutUzs` - hisobida qoladi, chunki bu haqiqiy pul harakati)
- [x] **Hamkor Excel hisob-varag'i (`/excel/partners/:id/statement`) ekrandagi bilan mos kelmasdi** — eski, alohida (eskirgan) hisob-kitob ishlatilardi: bekor qilingan xaridlar ham qarz sifatida chiqib turardi, xarid/qo'lda kassa yozuvlari umuman hisobga kirmasdi. Endi ekrandagi hamkor hisob-varag'i bilan **bir xil manba** (`getPartnerLedger`) ishlatiladi
- [x] Kassa/Buxgalteriya o'rtasidagi query-invalidatsiya zanjirlari to'ldirildi — bitta tomonni bekor qilish/tiklash ikkinchi hisobga ham ta'sir qilishi mumkinligi uchun, Kassa amaliyotlari va Buxgalteriya va Arxiv sahifalaridagi mutatsiyalar endi bir-birining so'rovlarini ham yangilaydi
- [x] **"Ombordagi qoldiq qiymati" bosh sahifadan Buxgalteriya ajratilganda butunlay yo'qolib qolgan edi** — Kassa "faqat kunlik savdo"ga qisqartirilganda bu ko'rsatkich hech qayerga ko'chirilmagan edi. Buxgalteriya sahifasiga qo'shildi

**Tekshirilgan va xato emas deb tasdiqlangan:** kunlik ("bugungi") sana chegaralari serverning/bazaning timezone sozlamasiga bog'liq (`current_date`, `toISOString().slice(0,10)`) — foydalanuvchi tasdiqladi, server/DB **Asia/Tashkent (UTC+5)**da ishlaydi, shuning uchun "bugungi savdo/kirim/chiqim" kabi hisoblar to'g'ri ishlaydi, tuzatish kerak emas.

## Kelajakdagi g'oyalar (hozircha qo'shilmagan)
- Ko'p foydalanuvchi + rollar (agar kerak bo'lsa keyinchalik qo'shiladi — hozir bitta admin user)
- SMS/bildirishnoma (nasiya muddati yaqinlashganda) — provayder (Eskiz.uz va h.k.) tanlangach qo'shiladi
- Chop etish (savdo cheki/hisob-faktura PDF)
- Backup/eksport avtomatik jadval bo'yicha
- Xarid tafsilot sahifasi (hozircha yo'q — xaridlar faqat Kirim-chiqim jadvalida ko'rinadi)
- Arxivdan **butunlay** o'chirish (hozircha ataylab qo'shilmagan — foydalanuvchi qarori: faqat tiklash bo'lsin)
- Transfer (omborlar orasida ko'chirish) yozuvlarini bekor qilish (hozircha qo'shilmagan)



## Muhim eslatmalar
- Serverga qo'yish (VPS, Nginx, PM2, SSL) — to'liq bosqichma-bosqich qo'llanma [DEPLOY.md](./DEPLOY.md)da, tayyor konfiguratsiya fayllari `ecosystem.config.cjs` va `deploy/`da
- `backend/.env` haqiqiy DATABASE_URL bilan **gitignored** — hech qachon commit qilinmasin
- Baza hech qachon o'chirilmaydi/tozalanmaydi — buni faqat siz qilishingiz mumkin
- Ombor kirim-chiqim yozuvlari **o'zgartirilmaydi** (immutable ledger) — xato bo'lsa tuzatish yozuvi kiritiladi
- Tannarx (`avgCostUzs`) og'irlikli o'rtacha usulda hisoblanadi, doim UZS'da saqlanadi
- Backend barcha API'lar `curl` orqali to'liq test qilingan (login → mahsulot → kirim → savdo → to'lov → dashboard → hamkor balansi) va ishlayapti. Frontendni brauzer-avtomatlashtirish vositasida sinaganimda 3001→4000 portlararo so'rov doim 503 bilan bloklandi (backend logida bu so'rov hech qachon ko'rinmadi) — bu avtomatlashtirish kengaytmasining cheklovi bo'lsa kerak, kodga aloqasi yo'qdek tuyuladi. **Iltimos, http://localhost:3001/login sahifasini o'zingizning oddiy brauzeringizda ochib, admin/admin123 bilan kirishni sinab ko'ring** — muammo bo'lsa aytasiz.
