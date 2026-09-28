// TextUP SMS provayderi bilan integratsiya - login/token boshqaruvi va SMS
// yuborish. Hujjat foydalanuvchi tomonidan berilgan (login, alpha-names,
// templates, groups, sms list, send). Balans/limit endpointi hujjatda yo'q,
// shuning uchun "necha SMS yuborilgani" backend/src/modules/sms/service.ts
// ichida o'zimizning sms_logs jadvalimizdan hisoblanadi.

const AUTH_BASE = "https://api-auth.textup.uz/v1";
const SMS_BASE = "https://sms-api.textup.uz/v1";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; phone: string; roleId: string; status: string };
};

type TextupSession = { accessToken: string; userId: string; expiresAt: number };

// Xotirada saqlanadigan token keshi - server qayta ishga tushmaguncha har bir
// SMS uchun qayta login qilinmaydi.
let cached: TextupSession | null = null;

// JWT muddatini o'zimiz dekod qilmasdan, konservativ 25 daqiqa deb olamiz -
// haqiqiy muddat tugashidan oldin qayta login qilinishini kafolatlaydi.
const TOKEN_TTL_MS = 25 * 60 * 1000;

async function login(): Promise<TextupSession> {
  const email = process.env.TEXTUP_EMAIL;
  const password = process.env.TEXTUP_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "TextUP SMS xizmati sozlanmagan - backend/.env fayliga TEXTUP_EMAIL va TEXTUP_PASSWORD kiriting"
    );
  }

  const res = await fetch(`${AUTH_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error("TextUP tizimiga kirishda xatolik - TEXTUP_EMAIL/TEXTUP_PASSWORD ni tekshiring");
  }

  const data = (await res.json()) as LoginResponse;
  cached = {
    accessToken: data.accessToken,
    userId: data.user.id,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  return cached;
}

async function getSession(): Promise<TextupSession> {
  if (cached && cached.expiresAt > Date.now()) return cached;
  return login();
}

/**
 * TextUP'ga avtorizatsiyalangan so'rov yuboradi. Token muddati tugagan
 * bo'lsa (401) - bir marta qayta login qilib qayta urinadi. `build` joriy
 * sessiya (accessToken/userId) asosida `fetch()`ga uzatiladigan parametrlarni tuzadi.
 */
async function authedFetch(build: (session: TextupSession) => Promise<Response>): Promise<Response> {
  let session = await getSession();
  let res = await build(session);

  if (res.status === 401) {
    cached = null;
    session = await login();
    res = await build(session);
  }

  return res;
}

/** Muvaffaqiyatsiz javobdan o'zbekcha xato xabarini chiqaradi. */
async function errorFromResponse(res: Response): Promise<string> {
  let errorMessage = `TextUP xatoligi (${res.status})`;
  try {
    const data = (await res.json()) as { message?: string };
    if (data?.message) errorMessage = String(data.message);
  } catch {
    // javob JSON emas
  }
  return errorMessage;
}

/**
 * TextUP orqali BITTA raqamga SMS yuboradi (standart qisqa raqamdan -
 * nicknameId berilmaydi). Faqat tayyor matn (`message`) bilan yuboriladi -
 * xabar matni backend/src/modules/sms/service.ts'dagi yagona tasdiqlangan
 * shablondan to'ldirib olinadi. Token muddati tugagan bo'lsa (401) - bir
 * marta qayta login qilib qayta urinadi.
 */
export async function sendTextupSms(phone: string, content: { message: string }): Promise<{ smsId: string }> {
  const res = await authedFetch((session) =>
    fetch(`${SMS_BASE}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        userId: session.userId,
        recipients: [phone],
        message: content.message,
      }),
    })
  );

  if (!res.ok) throw new Error(await errorFromResponse(res));

  const data = (await res.json()) as { smsId: string };
  return { smsId: data.smsId };
}
