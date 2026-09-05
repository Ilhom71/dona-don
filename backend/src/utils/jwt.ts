import { sign, verify } from "hono/jwt";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET .env faylida topilmadi");
}
const SECRET: string = process.env.JWT_SECRET;
const ALGORITHM = "HS256";

// Bir qurilmada 60 kun davomida qayta login talab qilinmaydi;
// yangi qurilma/brauzerda cookie bo'lmagani uchun baribir login kerak bo'ladi.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 kun

export async function createToken(payload: { sub: string; username: string }) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  return sign({ ...payload, exp }, SECRET, ALGORITHM);
}

export async function verifyToken(token: string) {
  return verify(token, SECRET, ALGORITHM);
}
