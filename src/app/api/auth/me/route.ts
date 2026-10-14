import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/** GET /api/auth/me — ข้อมูลผู้ใช้ที่ login อยู่ */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, user: null }, { status: 401 });
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
