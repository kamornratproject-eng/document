// ระบบสมาชิก: สมัครสมาชิก, เข้าสู่ระบบ (อีเมล), Session cookie, สิทธิ์ admin
import { cookies } from "next/headers";
import { dbGet, dbRun } from "@/lib/db";

export const SESSION_COOKIE = "docmgmt_session";
export const SESSION_DAYS = 30;

const ITERATIONS = 100000;
const te = new TextEncoder();

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** เข้ารหัสรหัสผ่านด้วย PBKDF2-SHA256 (รองรับทั้ง Node และ Cloudflare Workers) */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(bits)}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, iterStr, saltB64, hashB64] = (stored || "").split("$");
    if (scheme !== "pbkdf2") return false;
    const iterations = Number(iterStr) || ITERATIONS;
    const salt = fromB64(saltB64);
    const expected = fromB64(hashB64);
    const key = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, [
      "deriveBits",
    ]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      key,
      256
    );
    return timingSafeEqual(new Uint8Array(bits), expected);
  } catch {
    return false;
  }
}

export interface SessionUser {
  id: number;
  full_name: string;
  department: string;
  email: string;
  role: string;
  is_active: number;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createSession(userId: number): Promise<string> {
  const token = randomToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await dbRun(
    "DELETE FROM sessions WHERE expires_at < ?",
    [now.toISOString()]
  );
  await dbRun(
    "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    [token, userId, expires.toISOString(), now.toISOString()]
  );
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function destroySession(token?: string | null): Promise<void> {
  if (!token) return;
  await dbRun("DELETE FROM sessions WHERE token = ?", [token]);
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** คืนข้อมูลผู้ใช้ที่ login อยู่ (อ่านจาก cookie → ตาราง sessions) */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const row = await dbGet<SessionUser & { expires_at: string }>(
    `SELECT u.id, u.full_name, u.department, u.email, u.role, u.is_active, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`,
    [token]
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await destroySession(token);
    return null;
  }
  if (!row.is_active) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    department: row.department,
    email: row.email,
    role: row.role,
    is_active: row.is_active,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return user!;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard");
  }
  return user;
}

export function isAdmin(user: SessionUser | null | undefined): boolean {
  return !!user && user.role === "admin";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
