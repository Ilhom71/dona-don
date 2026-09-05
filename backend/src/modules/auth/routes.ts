import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import { findUserByUsername, verifyPassword } from "./service";
import { createToken, SESSION_MAX_AGE_SECONDS } from "../../utils/jwt";
import { requireAuth } from "../../middleware/auth";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const authRoutes = new Hono();

authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Login yoki parol noto'g'ri kiritildi" }, 400);
  }

  const { username, password } = parsed.data;
  const user = await findUserByUsername(username);
  if (!user) {
    return c.json({ error: "Login yoki parol xato" }, 401);
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return c.json({ error: "Login yoki parol xato" }, 401);
  }

  const token = await createToken({ sub: user.id, username: user.username });

  setCookie(c, "donadon_token", token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return c.json({ id: user.id, username: user.username });
});

authRoutes.post("/logout", (c) => {
  deleteCookie(c, "donadon_token", { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth, async (c) => {
  // requireAuth c.set("userId", ...) qiladi; umumiy Context turi buni bilmagani
  // uchun bu yerda xavfsiz cast qilinadi.
  const userId = c.get("userId" as never) as string;
  return c.json({ userId });
});
