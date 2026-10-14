// ข้อมูลเอกสาร (Repository) + การแปลงเป็น DTO ที่มีการคำนวณอายุใบอนุญาต
import { dbAll, dbGet } from "@/lib/db";
import {
  daysUntil,
  licenseTermLabel,
  licenseYears,
  licenseYearsLabel,
  statusOf,
  STATUS_BADGE,
  STATUS_LABEL,
  todayISO,
} from "@/lib/dates";

export interface DocumentRow {
  id: number;
  /** เลขลำดับที่คำนวณแบบต่อเนื่อง (1..N เรียงตาม id) — คอลัมน์เสริมจาก query ที่มี ROW_NUMBER */
  seq?: number;
  item: string;
  issue_date: string;
  expiry_date: string;
  contact_location: string;
  responsible_name: string;
  responsible_email: string;
  file_id: string | null;
  file_backend: string | null;
  file_name: string | null;
  file_url: string | null;
  file_mime: string | null;
  file_size: number | null;
  note: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_by: number | null;
  updated_by_name: string | null;
  updated_at: string | null;
}

export interface DocumentDTO {
  id: number;
  seq: number;
  item: string;
  issueDate: string;
  expiryDate: string;
  years: number;             // อายุใบอนุญาต (ปี) คำนวณจากวันหมดอายุ
  yearsLabel: string;
  termLabel: string;         // อายุการใช้งานรวม (ปี)
  daysLeft: number;
  status: "expired" | "soon" | "active";
  statusLabel: string;
  statusBadge: string;
  contactLocation: string;
  responsibleName: string;
  responsibleEmail: string;
  file: {
    id: string | null;
    backend: string | null;
    name: string | null;
    url: string | null;
    mime: string | null;
    size: number | null;
  };
  note: string;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedBy: number | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

export function toDTO(row: DocumentRow): DocumentDTO {
  const status = statusOf(row.expiry_date);
  return {
    id: row.id,
    seq: row.seq ?? row.id,
    item: row.item,
    issueDate: row.issue_date,
    expiryDate: row.expiry_date,
    years: licenseYears(row.expiry_date),
    yearsLabel: licenseYearsLabel(row.expiry_date),
    termLabel: licenseTermLabel(row.issue_date, row.expiry_date),
    daysLeft: daysUntil(row.expiry_date),
    status,
    statusLabel: STATUS_LABEL[status],
    statusBadge: STATUS_BADGE[status],
    contactLocation: row.contact_location,
    responsibleName: row.responsible_name,
    responsibleEmail: row.responsible_email,
    file: {
      id: row.file_id,
      backend: row.file_backend,
      name: row.file_name,
      url: row.file_url,
      mime: row.file_mime,
      size: row.file_size,
    },
    note: row.note,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
    updatedAt: row.updated_at,
  };
}

/**
 * เลขลำดับแบบต่อเนื่อง 1..N เรียงตามลำดับการสร้าง (id)
 * - ลบรายการไปแล้ว รายการที่เหลือจะถูกเรียงเลขใหม่ทันที (ไม่มีช่องว่างว่าง)
 * - ต้องห่อ subquery เพราะ window function หลัง WHERE จะนับเฉพาะแถวที่ผ่านเงื่อนไข
 */
export const DOC_WITH_SEQ =
  "SELECT * FROM (SELECT *, ROW_NUMBER() OVER (ORDER BY id) AS seq FROM documents) d";

/** ดึงเอกสาร 1 รายการพร้อมเลขลำดับต่อเนื่อง */
export async function getDocumentWithSeq(id: number): Promise<DocumentRow | null> {
  return dbGet<DocumentRow>(`${DOC_WITH_SEQ} WHERE id = ?`, [id]);
}

/**
 * หาเลขลำดับว่างชุดถัดไป (เลขที่เคยถูกลบไป) เพื่อให้รายการใหม่ "แทนเลขที่เคยลบ"
 * เช่น มี 1,2,3 → ลบ 2 → รายการใหม่ที่เพิ่มจะได้เป็นลำดับ 2 (ไม่ใช่ 4)
 */
export async function nextSeqId(): Promise<number> {
  const row = await dbGet<{ next_id: number | null }>(
    `SELECT MIN(t.id) AS next_id FROM (
       SELECT 1 AS id
       UNION ALL
       SELECT id + 1 FROM documents
     ) t
     WHERE t.id NOT IN (SELECT id FROM documents)`
  );
  return Number(row?.next_id ?? 1);
}

export interface ListParams {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "expiry" | "item" | "recent";
}

export async function listDocuments(params: ListParams = {}): Promise<{
  rows: DocumentDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const q = (params.q || "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(params.pageSize) || 10));
  const today = todayISO();
  const limit30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const where: string[] = [];
  const args: unknown[] = [];

  if (q) {
    where.push(
      "(item LIKE ? OR responsible_name LIKE ? OR contact_location LIKE ? OR responsible_email LIKE ?)"
    );
    const like = `%${q}%`;
    args.push(like, like, like, like);
  }
  if (params.status === "expired") {
    where.push("expiry_date < ?");
    args.push(today);
  } else if (params.status === "soon") {
    where.push("expiry_date >= ? AND expiry_date <= ?");
    args.push(today, limit30);
  } else if (params.status === "active") {
    where.push("expiry_date > ?");
    args.push(limit30);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql =
    params.sortBy === "item"
      ? "ORDER BY item COLLATE NOCASE ASC"
      : params.sortBy === "recent"
        ? "ORDER BY id DESC"
        : "ORDER BY expiry_date ASC, id ASC";

  const totalRow = await dbGet<{ n: number }>(
    `SELECT COUNT(*) AS n FROM documents ${whereSql}`,
    args
  );
  const total = Number(totalRow?.n ?? 0);
  const offset = (page - 1) * pageSize;

  const rows = await dbAll<DocumentRow>(
    `${DOC_WITH_SEQ} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
    [...args, pageSize, offset]
  );

  return {
    rows: rows.map(toDTO),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getDocument(id: number): Promise<DocumentRow | null> {
  return dbGet<DocumentRow>("SELECT * FROM documents WHERE id = ?", [id]);
}

export interface DocumentInput {
  item: string;
  issue_date: string;
  expiry_date: string;
  contact_location: string;
  responsible_name: string;
  responsible_email: string;
  note: string;
}

export function validateDocumentInput(input: Partial<DocumentInput>): string | null {
  if (!input.item || !input.item.trim()) return "กรุณาระบุรายการเอกสาร";
  if (!input.issue_date) return "กรุณาระบุวันที่ออกใบอนุญาต";
  if (!input.expiry_date) return "กรุณาระบุวันที่หมดอายุใบอนุญาต";
  if (input.expiry_date < input.issue_date)
    return "วันที่หมดอายุต้องมากกว่าหรือเท่ากับวันที่ออกใบอนุญาต";
  if (input.responsible_email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.responsible_email))
    return "รูปแบบอีเมลผู้รับผิดชอบไม่ถูกต้อง";
  return null;
}
