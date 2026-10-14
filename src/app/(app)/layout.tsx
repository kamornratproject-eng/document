import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { requireUser } from "@/lib/auth";
import { dbGet } from "@/lib/db";
import { isoInDays } from "@/lib/dates";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const soonRow = await dbGet<{ n: number }>(
    "SELECT COUNT(*) AS n FROM documents WHERE expiry_date >= ? AND expiry_date <= ?",
    [isoInDays(0), isoInDays(30)]
  ).catch(() => ({ n: 0 }));

  const shellUser = {
    id: user.id,
    fullName: user.full_name,
    department: user.department,
    email: user.email,
    role: user.role,
  };

  return (
    <div className="admin-shell">
      <Sidebar user={shellUser} />
      <div className="admin-main">
        <Navbar user={shellUser} expiringCount={Number(soonRow?.n ?? 0)} />
        <main className="dashboard-content">
          <div className="container-fluid px-3 px-lg-4 py-4">{children}</div>
        </main>
        <footer className="admin-footer">
          <div className="container-fluid px-3 px-lg-4">
            <span>ระบบจัดเก็บเอกสารเพื่อการต่ออายุ © {new Date().getFullYear()}</span>
            <span>แจ้งเตือนล่วงหน้า 30 วันก่อนวันหมดอายุ</span>
            <span>พัฒนาโดย:นายธีรพงศ์ พรหมวัง แผนกเทคโนโลยีสารสนเทศ โรง1</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
