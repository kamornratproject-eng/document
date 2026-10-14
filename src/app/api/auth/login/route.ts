import { NextResponse } from "next/server";
import { dbGet } from "@/lib/db";
import {
  createSession,
  setSessionCookie,
  verifyPassword,
  EMAIL_RE,
} from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";


type LoginBody = Record<string, unknown>;

/** POST /api/auth/login — เข้าสู่ระบบด้วยอีเมล */
export async function POST(req: Request) {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!EMAIL_RE.test(email) || !password)
    return NextResponse.json(
      { ok: false, error: "กรุณากรอกอีเมลและรหัสผ่าน" },
      { status: 400 }
    );

  const user = await dbGet<SessionUser & { password_hash: string }>(
    "SELECT id, full_name, department, email, password_hash, role, is_active FROM users WHERE email = ?",
    [email]
  );

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json(
      { ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" },
      { status: 401 }
    );
  }
  if (!user.is_active) {
    return NextResponse.json(
      { ok: false, error: "บัญชีนี้ถูกระงับการใช้งาน" },
      { status: 403 }
    );
  }

  const token = await createSession(user.id);
  await setSessionCookie(token);
  await audit(
    { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
    "login",
    "user",
    user.id,
    "เข้าสู่ระบบ"
  );

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      fullName: user.full_name,
      department: user.department,
      email: user.email,
      role: user.role,
    },
  });
}
