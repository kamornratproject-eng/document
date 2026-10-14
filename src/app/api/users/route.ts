import { NextResponse } from "next/server";
import { dbAll } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";


/** GET /api/users — รายชื่อผู้ใช้ (เฉพาะผู้ดูแลระบบ) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (user.role !== "admin")
    return NextResponse.json({ ok: false, error: "ต้องเป็นผู้ดูแลระบบ" }, { status: 403 });

  const rows = await dbAll<{
    id: number;
    full_name: string;
    department: string;
    email: string;
    role: string;
    is_active: number;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, full_name, department, email, role, is_active, created_at, updated_at
       FROM users ORDER BY id ASC`
  );
  const docs = await dbAll<{ created_by: number; n: number }>(
    "SELECT created_by, COUNT(*) AS n FROM documents GROUP BY created_by"
  );
  const countMap = new Map(docs.map((d) => [d.created_by, d.n]));

  return NextResponse.json({
    ok: true,
    users: rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      department: r.department,
      email: r.email,
      role: r.role,
      isActive: !!r.is_active,
      createdAt: r.created_at,
      documents: Number(countMap.get(r.id) || 0),
    })),
  });
}
