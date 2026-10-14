import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDashboardStats, getAuditLogs } from "@/lib/reports";
import { dbAll } from "@/lib/db";


/** GET /api/reports — สถิติสำหรับ Dashboard/หน้ารายงาน */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const [stats, logs] = await Promise.all([getDashboardStats(), getAuditLogs(25)]);
  const notifications = await dbAll(
    `SELECT n.*, d.item AS item FROM notifications n
       LEFT JOIN documents d ON d.id = n.document_id
      ORDER BY n.id DESC LIMIT 20`
  );

  return NextResponse.json({ ok: true, stats, logs, notifications });
}
