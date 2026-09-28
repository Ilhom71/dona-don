// PM2 uchun - backend (Bun) va frontend (Next.js) ni bitta joydan boshqarish.
// Ishga tushirish: pm2 start ecosystem.config.cjs (loyiha papkasining tub qismidan)
const path = require("path");

// Bun odatda ~/.bun/bin ga o'rnatiladi, lekin PM2 ilovani interaktiv bo'lmagan
// shellda ishga tushiradi - unda ~/.bashrc o'qilmaydi, ya'ni bu papka PATH'ga
// qo'shilmay qoladi. Bundan tashqari PM2 `script` qiymatini PATH'dan qidirmaydi
// (uni cwd'ga nisbatan fayl yo'li deb hisoblaydi), shuning uchun bun'ning to'liq
// yo'li beriladi va PATH ham env orqali to'ldiriladi.
const bunBin = path.join(process.env.HOME || "", ".bun", "bin", "bun");
const PATH_WITH_BUN = `${path.dirname(bunBin)}:${process.env.PATH || ""}`;

module.exports = {
  apps: [
    {
      name: "donadon-backend",
      // Absolut yo'l - `pm2 start` qaysi papkadan chaqirilishidan qat'i nazar
      // to'g'ri ishlashi uchun (nisbiy "./backend" faqat tub papkadan ishlardi).
      cwd: path.join(__dirname, "backend"),
      script: bunBin,
      args: "run start",
      // bun binar fayl - PM2 uni node bilan ishga tushirishga urinmasin
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        PATH: PATH_WITH_BUN,
        // PORT backend/.env faylidan o'qiladi (4000)
      },
    },
    {
      name: "donadon-frontend",
      cwd: path.join(__dirname, "frontend"),
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        // 3000 serverda boshqa ilova tomonidan band - shuning uchun 3030.
        // Nginx konfiguratsiyasidagi port bilan bir xil bo'lishi shart.
        PORT: "3030",
      },
    },
  ],
};
