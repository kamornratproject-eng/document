import { NextResponse } from "next/server";
import { clearSessionCookie, destroySession, getSessionToken, getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";


/** POST /api/auth/logout */
export async function POST() {
  const token = await getSessionToken();
  const user = await getSessionUser();
  if (user) {
    await audit(
      { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
      "logout",
      "user",
      user.id,
      "ออกจากระบบ"
    );
  }
  await destroySession(token);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}

/** GET /api/auth/me */
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
