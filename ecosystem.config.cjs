// PM2 uchun - backend (Bun) va frontend (Next.js) ni bitta joydan boshqarish.
// Ishga tushirish: pm2 start ecosystem.config.cjs (loyiha papkasining tub qismidan)
module.exports = {
  apps: [
    {
      name: "donadon-backend",
      cwd: "./backend",
      script: "bun",
      args: "run start",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "donadon-frontend",
      cwd: "./frontend",
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
