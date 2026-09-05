import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";

export async function findUserByUsername(username: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return user;
}

export async function verifyPassword(plain: string, hash: string) {
  return Bun.password.verify(plain, hash);
}

export async function hashPassword(plain: string) {
  return Bun.password.hash(plain, { algorithm: "bcrypt", cost: 10 });
}
