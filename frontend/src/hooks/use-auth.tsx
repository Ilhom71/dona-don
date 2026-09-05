"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api, ApiError } from "@/lib/api";

type AuthState = {
  status: "loading" | "authenticated" | "unauthenticated";
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// Ilova ochilganda "loading" ekrani (mantiqiy tekshiruv juda tez tugasa ham)
// kamida shuncha vaqt ko'rsatiladi.
const MIN_LOADING_MS = 3000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const router = useRouter();
  const pathname = usePathname();
  const resolvedRef = useRef<"authenticated" | "unauthenticated" | null>(null);
  const minDelayDoneRef = useRef(false);

  const finishInitialLoad = useCallback(() => {
    if (resolvedRef.current && minDelayDoneRef.current) {
      setStatus(resolvedRef.current);
    }
  }, []);

  const checkSession = useCallback(async () => {
    try {
      await api.get("/auth/me");
      resolvedRef.current = "authenticated";
    } catch {
      resolvedRef.current = "unauthenticated";
    }
    finishInitialLoad();
  }, [finishInitialLoad]);

  useEffect(() => {
    checkSession();
    const timer = setTimeout(() => {
      minDelayDoneRef.current = true;
      finishInitialLoad();
    }, MIN_LOADING_MS);
    return () => clearTimeout(timer);
  }, [checkSession, finishInitialLoad]);

  useEffect(() => {
    if (status === "unauthenticated" && pathname !== "/login") {
      router.replace("/login");
    }
    if (status === "authenticated" && pathname === "/login") {
      router.replace("/");
    }
  }, [status, pathname, router]);

  const login = useCallback(async (username: string, password: string) => {
    await api.post("/auth/login", { username, password });
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setStatus("unauthenticated");
    }
  }, []);

  return (
    <AuthContext.Provider value={{ status, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider ichida ishlatilishi kerak");
  return ctx;
}

export function isUnauthorized(err: unknown) {
  return err instanceof ApiError && err.status === 401;
}
