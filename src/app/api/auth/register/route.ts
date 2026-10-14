import { NextResponse } from "next/server";
import { dbGet, dbRun } from "@/lib/db";
import {
  createSession,
  hashPassword,
  setSessionCookie,
  EMAIL_RE,
} from "@/lib/auth";
import { audit } from "@/lib/audit";


/** POST /api/auth/register — ลงทะเบียนใช้งาน (ชื่อ-สกุล, แผนก, อีเมล, รหัสผ่าน) */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const fullName = String(body.fullName || body.full_name || "").trim();
  const department = String(body.department || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const confirm = String(body.confirm || body.confirmPassword || password);

  if (fullName.length < 2)
    return NextResponse.json({ ok: false, error: "กรุณาระบุชื่อ-สกุล" }, { status: 400 });
  if (!department)
    return NextResponse.json({ ok: false, error: "กรุณาระบุแผนก" }, { status: 400 });
  if (!EMAIL_RE.test(email))
    return NextResponse.json({ ok: false, error: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
  if (password.length < 6)
    return NextResponse.json(
      { ok: false, error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" },
      { status: 400 }
    );
  if (password !== confirm)
    return NextResponse.json({ ok: false, error: "รหัสผ่านไม่ตรงกัน" }, { status: 400 });

  const exists = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
  if (exists)
    return NextResponse.json(
      { ok: false, error: "อีเมลนี้ถูกลงทะเบียนแล้ว" },
      { status: 409 }
    );

  const countRow = await dbGet<{ n: number }>("SELECT COUNT(*) AS n FROM users");
  const role = Number(countRow?.n ?? 0) === 0 ? "admin" : "user";
  const now = new Date().toISOString();
  const hash = await hashPassword(password);

  const res = await dbRun(
    `INSERT INTO users (full_name, department, email, password_hash, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [fullName, department, email, hash, role, now, now]
  );

  const token = await createSession(res.lastRowId);
  await setSessionCookie(token);

  const user = {
    id: res.lastRowId,
    fullName,
    department,
    email,
    role,
  };
  await audit(
    { id: user.id, full_name: fullName, email, role },
    "register",
    "user",
    user.id,
    `ลงทะเบียนใช้งาน (${department})`
  );

  return NextResponse.json({
    ok: true,
    user,
    isFirstUser: role === "admin",
    message:
      role === "admin"
        ? "ลงทะเบียนสำเร็จ — คุณคือผู้ดูแลระบบ (Admin)"
        : "ลงทะเบียนสำเร็จ",
  });
}
