import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dbAll, dbGet } from "@/lib/db";
import { formatDateTime, isoInDays, thaiDateShort } from "@/lib/dates";
import { getAuditLogs } from "@/lib/reports";

interface UserRow {
  id: number;
  full_name: string;
  department: string;
  email: string;
  role: string;
  is_active: number;
  created_at: string;
}

export default async function UsersPage() {
  const me = await requireUser();
  const isAdmin = me.role === "admin";

  const users = isAdmin
    ? await dbAll<UserRow>(
        `SELECT id, full_name, department, email, role, is_active, created_at FROM users ORDER BY id ASC`
      )
    : await dbAll<UserRow>(
        `SELECT id, full_name, department, email, role, is_active, created_at FROM users WHERE id = ?`,
        [me.id]
      );

  const counts = await dbAll<{ created_by: number; n: number }>(
    "SELECT created_by, COUNT(*) AS n FROM documents GROUP BY created_by"
  );
  const countMap = new Map(counts.map((c) => [c.created_by, c.n]));

  const myDocs = Number(countMap.get(me.id) || 0);
  const mySoon = await dbGet<{ n: number }>(
    "SELECT COUNT(*) AS n FROM documents WHERE created_by = ? AND expiry_date >= ? AND expiry_date <= ?",
    [me.id, isoInDays(0), isoInDays(30)]
  );
  const logs = await getAuditLogs(10);

  return (
    <>
      <div className="page-heading">
        <div className="page-heading-copy">
          <span className="page-icon">
            <i className="bi bi-people" />
          </span>
          <div>
            <p className="eyebrow mb-1">บัญชีผู้ใช้</p>
            <h1 className="h3 mb-1">{isAdmin ? "ผู้ใช้งานในระบบ" : "โปรไฟล์ของฉัน"}</h1>
            <p className="text-muted mb-0">
              {isAdmin
                ? "รายชื่อสมาชิกที่ลงทะเบียนใช้งาน แผนก และสิทธิ์การใช้งาน"
                : "ข้อมูลบัญชีและเอกสารที่คุณเป็นผู้บันทึก"}
            </p>
          </div>
        </div>
        <div className="heading-actions">
          <Link href="/register" className="btn btn-primary btn-sm">
            <i className="bi bi-person-plus" /> ลงทะเบียนผู้ใช้ใหม่
          </Link>
        </div>
      </div>

      <section className="row g-3 mt-1">
        <div className="col-12 col-sm-6 col-xl-3">
          <article className="metric-card metric-primary">
            <div className="metric-top">
              <span className="metric-label">เอกสารของคุณ</span>
              <span className="metric-icon">
                <i className="bi bi-journal-text" />
              </span>
            </div>
            <div className="metric-value">{myDocs}</div>
            <div className="metric-meta">
              <span className="text-primary">รายการ</span>
              <span>ที่คุณเป็นผู้บันทึก</span>
            </div>
          </article>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <article className="metric-card metric-warning">
            <div className="metric-top">
              <span className="metric-label">ใกล้หมดอายุ</span>
              <span className="metric-icon">
                <i className="bi bi-hourglass-split" />
              </span>
            </div>
            <div className="metric-value">{Number(mySoon?.n ?? 0)}</div>
            <div className="metric-meta">
              <span className="text-warning">≤30 วัน</span>
              <span>ต้องดำเนินการ</span>
            </div>
          </article>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <article className="metric-card metric-success">
            <div className="metric-top">
              <span className="metric-label">ผู้ใช้ทั้งหมด</span>
              <span className="metric-icon">
                <i className="bi bi-people" />
              </span>
            </div>
            <div className="metric-value">{users.length}</div>
            <div className="metric-meta">
              <span className="text-success">
                {isAdmin ? "บัญชีในระบบ" : "บัญชีของคุณ"}
              </span>
            </div>
          </article>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <article className="metric-card metric-danger">
            <div className="metric-top">
              <span className="metric-label">สิทธิ์ของคุณ</span>
              <span className="metric-icon">
                <i className="bi bi-shield-check" />
              </span>
            </div>
            <div className="metric-value" style={{ fontSize: 22 }}>
              {isAdmin ? "Admin" : "User"}
            </div>
            <div className="metric-meta">
              <span className={isAdmin ? "text-danger" : "text-muted"}>
                {isAdmin ? "ลบ/แก้ไขได้ทุกรายการ" : "ลบ/แก้ไขได้เฉพาะของตัวเอง"}
              </span>
            </div>
          </article>
        </div>
      </section>

      <section className="panel mt-3">
        <div className="panel-header">
          <div>
            <h2 className="h5 mb-1 section-title">
              <i className="bi bi-table" /> <span>{isAdmin ? "รายชื่อผู้ใช้" : "บัญชีของฉัน"}</span>
            </h2>
            <p className="text-muted mb-0">ข้อมูล ชื่อ-สกุล, แผนก, อีเมล และวันที่ลงทะเบียน</p>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table align-middle mb-0 doc-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>ชื่อ-สกุล</th>
                <th>แผนก</th>
                <th>อีเมล</th>
                <th>สิทธิ์</th>
                <th>เอกสารที่บันทึก</th>
                <th>วันที่ลงทะเบียน</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id}>
                  <td>{i + 1}</td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span
                        className="avatar-img avatar-sm d-inline-flex align-items-center justify-content-center text-white fw-bold"
                        style={{ background: u.role === "admin" ? "#2563eb" : "#0f766e" }}
                      >
                        {(u.full_name || "?").charAt(0)}
                      </span>
                      <div>
                        <p className="fw-semibold mb-0">{u.full_name}</p>
                        <p className="cell-sub mb-0">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>{u.department || "-"}</td>
                  <td>
                    <a href={`mailto:${u.email}`} className="text-decoration-none">
                      {u.email}
                    </a>
                  </td>
                  <td>
                    <span className={`badge ${u.role === "admin" ? "text-bg-primary" : "text-bg-secondary"}`}>
                      {u.role === "admin" ? "ผู้ดูแลระบบ" : "สมาชิก"}
                    </span>
                  </td>
                  <td>{Number(countMap.get(u.id) || 0)} รายการ</td>
                  <td>{thaiDateShort((u.created_at || "").slice(0, 10))}</td>
                  <td>
                    <span className={`badge ${u.is_active ? "text-bg-success" : "text-bg-danger"}`}>
                      {u.is_active ? "ใช้งาน" : "ระงับ"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel mt-3">
        <div className="panel-header">
          <div>
            <h2 className="h5 mb-1 section-title">
              <i className="bi bi-clock-history" /> <span>ประวัติการใช้งานล่าสุด</span>
            </h2>
            <p className="text-muted mb-0 small">ผู้บันทึก / ผู้แก้ไข / การลบ / การแจ้งเตือน</p>
          </div>
        </div>
        <ul className="list-unstyled mb-0">
          {logs.length === 0 && <li className="text-muted text-center py-4">ยังไม่มีกิจกรรม</li>}
          {logs.map((l) => (
            <li key={l.id} className="d-flex gap-2 align-items-start py-2 border-bottom">
              <span
                className={`badge ${
                  l.action === "delete"
                    ? "text-bg-danger"
                    : l.action === "create"
                      ? "text-bg-success"
                      : l.action === "remind"
                        ? "text-bg-info"
                        : "text-bg-primary"
                }`}
              >
                {l.action}
              </span>
              <div className="flex-grow-1">
                <p className="mb-0" style={{ fontSize: 13.5 }}>
                  {l.detail}
                </p>
                <p className="cell-sub mb-0">
                  {l.user_name || "ระบบ"} • {formatDateTime(l.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
