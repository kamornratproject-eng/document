// สรุปรายงาน/สถิติสำหรับหน้า Dashboard และหน้ารายงาน (กราฟ)
import { dbAll, dbGet } from "@/lib/db";
import { DocumentRow, toDTO, DocumentDTO, DOC_WITH_SEQ } from "@/lib/documents";
import { todayISO, statusOf, monthKey, monthLabel } from "@/lib/dates";

export interface DashboardStats {
  total: number;
  active: number;
  soon: number;
  expired: number;
  withFile: number;
  monthAdded: number;
  expiringSoon: DocumentDTO[];
  recent: DocumentDTO[];
  byStatus: { label: string; value: number; color: string }[];
  byMonth: { label: string; key: string; count: number }[];
  byResponsible: { label: string; count: number }[];
  byDepartment: { label: string; count: number }[];
  byYear: { label: string; count: number }[];
  createdTrend: { label: string; key: string; count: number }[];
  expiringByMonth: { label: string; key: string; count: number }[];
  notified: { sent: number; failed: number; last: string | null };
  users: number;
}

function addMonths(base: Date, n: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth() + n, 1);
  return d;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const rows = await dbAll<DocumentRow>(DOC_WITH_SEQ);
  const docs = rows.map(toDTO);
  const today = todayISO();

  const active = docs.filter((d) => d.status === "active").length;
  const soon = docs.filter((d) => d.status === "soon").length;
  const expired = docs.filter((d) => d.status === "expired").length;
  const withFile = docs.filter((d) => d.file.id).length;

  const thisMonth = today.slice(0, 7);
  const monthAdded = docs.filter((d) => monthKey(d.createdAt) === thisMonth).length;

  // หมดอายุรายเดือน 12 เดือนนับจากเดือนนี้
  const now = new Date();
  const expiringByMonth: { label: string; key: string; count: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = addMonths(now, i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    expiringByMonth.push({
      key,
      label: monthLabel(key),
      count: docs.filter((x) => monthKey(x.expiryDate) === key).length,
    });
  }

  // แนวโน้มการเพิ่มเอกสาร 12 เดือนย้อนหลัง
  const createdTrend: { label: string; key: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = addMonths(now, -i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    createdTrend.push({
      key,
      label: monthLabel(key),
      count: docs.filter((x) => monthKey(x.createdAt) === key).length,
    });
  }

  const countBy = (arr: DocumentDTO[], pick: (d: DocumentDTO) => string) => {
    const map = new Map<string, number>();
    for (const d of arr) {
      const k = (pick(d) || "").trim() || "-";
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  };

  const usersRow = await dbGet<{ n: number }>("SELECT COUNT(*) AS n FROM users");
  const notifRow = await dbGet<{ sent: number; failed: number; last: string | null }>(
    `SELECT
       SUM(CASE WHEN status = 'sent' OR status = 'logged' THEN 1 ELSE 0 END) AS sent,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
       MAX(sent_at) AS last
     FROM notifications`
  );

  return {
    total: docs.length,
    active,
    soon,
    expired,
    withFile,
    monthAdded,
    expiringSoon: docs
      .filter((d) => d.status === "soon")
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
      .slice(0, 8),
    recent: [...docs].sort((a, b) => b.id - a.id).slice(0, 6),
    byStatus: [
      { label: "ใช้งานปกติ", value: active, color: "#0f766e" },
      { label: "ใกล้หมดอายุ (≤30 วัน)", value: soon, color: "#d97706" },
      { label: "หมดอายุแล้ว", value: expired, color: "#dc2626" },
    ],
    byMonth: expiringByMonth,
    expiringByMonth,
    createdTrend,
    byResponsible: countBy(docs, (d) => d.responsibleName).slice(0, 8),
    byDepartment: countBy(docs, () => "").slice(0, 1),
    byYear: (() => {
      const map = new Map<string, number>();
      for (const d of docs) {
        const y = (d.expiryDate || "").slice(0, 4);
        if (y) map.set(y, (map.get(y) || 0) + 1);
      }
      return [...map.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, count]) => ({ label: `${Number(label) + 543}`, count }));
    })(),
    notified: {
      sent: Number(notifRow?.sent ?? 0),
      failed: Number(notifRow?.failed ?? 0),
      last: notifRow?.last ?? null,
    },
    users: Number(usersRow?.n ?? 0),
  };
}

export async function getAuditLogs(limit = 30) {
  return dbAll<{
    id: number;
    user_name: string | null;
    action: string;
    entity: string;
    entity_id: string | null;
    detail: string;
    created_at: string;
  }>("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", [limit]);
}

/** ข้อมูลสำหรับรายงาน CSV */
export async function getReportRows(): Promise<DocumentDTO[]> {
  const rows = await dbAll<DocumentRow>(
    `${DOC_WITH_SEQ} ORDER BY expiry_date ASC`
  );
  return rows.map(toDTO);
}

export function statusCount(docs: DocumentDTO[]) {
  const map = { active: 0, soon: 0, expired: 0 };
  for (const d of docs) map[d.status]++;
  return map;
}

export { statusOf };
