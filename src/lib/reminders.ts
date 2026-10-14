// ระบบแจ้งเตือนล่วงหน้า 30 วันก่อนวันหมดอายุ (ส่งอีเมลไปยังผู้รับผิดชอบ)
import { dbAll, dbGet, dbRun } from "@/lib/db";
import { DocumentRow, toDTO } from "@/lib/documents";
import { REMIND_DAYS, thaiDate } from "@/lib/dates";
import { reminderMailContent, sendEmail } from "@/lib/email";
import { getEnv } from "@/lib/db";

export interface ReminderItem {
  id: number;
  item: string;
  to: string;
  daysLeft: number;
  status: "sent" | "logged" | "failed" | "skipped";
  detail?: string;
}

export interface ReminderResult {
  checked: number;
  candidates: number;
  sent: number;
  logged: number;
  failed: number;
  skipped: number;
  items: ReminderItem[];
  ranAt: string;
}

async function alreadyNotified(documentId: number, expiryDate: string): Promise<boolean> {
  const row = await dbGet(
    `SELECT id FROM notifications
      WHERE document_id = ? AND expiry_date = ? AND status IN ('sent','logged','skipped')`,
    [documentId, expiryDate]
  );
  return !!row;
}

async function record(
  documentId: number,
  expiryDate: string,
  to: string,
  daysLeft: number,
  status: string,
  detail?: string
): Promise<void> {
  await dbRun(
    `INSERT OR IGNORE INTO notifications
       (document_id, expiry_date, to_email, days_left, channel, status, detail, sent_at)
     VALUES (?, ?, ?, ?, 'email', ?, ?, ?)`,
    [
      documentId,
      expiryDate,
      to,
      daysLeft,
      status,
      detail ?? null,
      new Date().toISOString(),
    ]
  );
}

/**
 * ตรวจเอกสารที่เข้าเกณฑ์ (หมดอายุภายใน 30 วัน หรือหมดอายุแล้วไม่เกิน 30 วัน)
 * และส่งอีเมลแจ้งเตือนไปยังผู้รับผิดชอบ 1 ครั้งต่อ 1 เอกสาร/รอบวันหมดอายุ
 */
export async function runReminders(): Promise<ReminderResult> {
  const env = await getEnv();
  const appUrl = env.APP_URL || "http://localhost:3000";
  const rows = await dbAll<DocumentRow>("SELECT * FROM documents");
  const result: ReminderResult = {
    checked: rows.length,
    candidates: 0,
    sent: 0,
    logged: 0,
    failed: 0,
    skipped: 0,
    items: [],
    ranAt: new Date().toISOString(),
  };

  for (const row of rows) {
    const doc = toDTO(row);
    // เกณฑ์: แจ้งเตือนก่อนหมดอายุ 30 วัน (รวมกรณีหมดอายุแล้วไม่เกิน 30 วัน)
    if (doc.daysLeft > REMIND_DAYS) continue;
    if (doc.daysLeft < -REMIND_DAYS) continue;
    result.candidates++;

    if (await alreadyNotified(doc.id, doc.expiryDate)) {
      result.skipped++;
      result.items.push({
        id: doc.id,
        item: doc.item,
        to: doc.responsibleEmail,
        daysLeft: doc.daysLeft,
        status: "skipped",
        detail: "เคยแจ้งเตือนแล้วในรอบนี้",
      });
      continue;
    }

    if (!doc.responsibleEmail) {
      await record(doc.id, doc.expiryDate, "", doc.daysLeft, "skipped", "ไม่มีอีเมลผู้รับผิดชอบ");
      result.skipped++;
      result.items.push({
        id: doc.id,
        item: doc.item,
        to: "",
        daysLeft: doc.daysLeft,
        status: "skipped",
        detail: "ไม่มีอีเมลผู้รับผิดชอบ",
      });
      continue;
    }

    const mail = reminderMailContent({
      item: doc.item,
      issueDate: thaiDate(doc.issueDate),
      expiryDate: thaiDate(doc.expiryDate),
      expiryLabel: thaiDate(doc.expiryDate),
      daysLeft: doc.daysLeft,
      responsibleName: doc.responsibleName,
      contactLocation: doc.contactLocation,
      appUrl,
    });

    const res = await sendEmail({
      to: doc.responsibleEmail,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    if (res.ok) {
      await record(
        doc.id,
        doc.expiryDate,
        doc.responsibleEmail,
        doc.daysLeft,
        res.provider === "log" ? "logged" : "sent",
        res.detail
      );
      if (res.provider === "log") result.logged++;
      else result.sent++;
      result.items.push({
        id: doc.id,
        item: doc.item,
        to: doc.responsibleEmail,
        daysLeft: doc.daysLeft,
        status: res.provider === "log" ? "logged" : "sent",
        detail: res.detail,
      });
    } else {
      // ไม่บันทึก → ระบบจะลองใหม่ในรอบถัดไป
      result.failed++;
      result.items.push({
        id: doc.id,
        item: doc.item,
        to: doc.responsibleEmail,
        daysLeft: doc.daysLeft,
        status: "failed",
        detail: res.detail,
      });
    }
  }

  return result;
}
