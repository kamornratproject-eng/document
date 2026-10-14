import { NextResponse } from "next/server";
import { runReminders } from "@/lib/reminders";
import { getEnv } from "@/lib/db";


/**
 * GET/POST /api/cron — จุดที่ Cloudflare Cron Trigger หรือ external scheduler เรียก
 * ต้องส่ง CRON_SECRET ผ่าน ?secret= หรือ header Authorization: Bearer <secret>
 */
async function handler(req: Request) {
  const env = await getEnv();
  const cronSecret = env.CRON_SECRET || "";
  const url = new URL(req.url);
  const params = url.searchParams;
  const secret = params.get("secret") || "";
  const authHeader = req.headers.get("authorization") || "";

  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "ยังไม่ได้ตั้งค่า CRON_SECRET ใน environment" },
      { status: 503 }
    );
  }
  if (secret !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Secret ไม่ถูกต้อง" }, { status: 401 });
  }

  const result = await runReminders();
  return NextResponse.json({ ok: true, result });
}

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}
