import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { runReminders } from "@/lib/reminders";
import { audit } from "@/lib/audit";
import { getEnv } from "@/lib/db";


/** POST /api/reminders — รันการตรวจและแจ้งเตือนล่วงหน้า 30 วัน (ต้อง login) */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const result = await runReminders();
  await audit(user, "remind", "system", null, `รันแจ้งเตือน: เข้าเกณฑ์ ${result.candidates} รายการ`);
  return NextResponse.json({ ok: true, result });
}

/** GET /api/reminders — ใช้โดย cron (ตรวจสอบ CRON_SECRET) หรือผู้ที่ login แล้ว */
export async function GET(req: Request) {
  const env = await getEnv();
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") || "";
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = env.CRON_SECRET || "";

  const user = await getSessionUser();
  const allowedBySecret = !!cronSecret && (secret === cronSecret || authHeader === `Bearer ${cronSecret}`);

  if (!allowedBySecret && !user) {
    return NextResponse.json({ ok: false, error: "ไม่ได้รับอนุญาต" }, { status: 401 });
  }

  const result = await runReminders();
  return NextResponse.json({ ok: true, result });
}
