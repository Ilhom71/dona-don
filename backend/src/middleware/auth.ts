import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifyToken } from "../utils/jwt";

export async function requireAuth(c: Context, next: Next) {
  const token = getCookie(c, "donadon_token");

  if (!token) {
    return c.json({ error: "Avtorizatsiyadan o'tilmagan" }, 401);
  }

  try {
    const payload = await verifyToken(token);
    c.set("userId", payload.sub as string);
    await next();
  } catch {
    return c.json({ error: "Token yaroqsiz yoki muddati o'tgan" }, 401);
  }
}
