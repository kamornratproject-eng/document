/**
 * การส่งอีเมลแจ้งเตือน
 * รองรับ 4 ช่องทาง (เลือกด้วย env EMAIL_PROVIDER):
 *  - log     : ไม่ส่งจริง ใช้สำหรับพัฒนา (ค่าเริ่มต้น) — บันทึกผลลงตาราง notifications
 *  - gas     : เรียก Google Apps Script (Code.gs) ให้ส่งเมลผ่าน GmailApp — ไม่ต้องมี API key
 *  - resend  : เรียก REST API ของ Resend (หรือ endpoint ที่เข้ากันได้ผ่าน EMAIL_API_URL)
 *  - webhook : POST JSON {to,subject,html} ไปยัง URL ที่กำหนด (Zapier/Make/n8n ฯลฯ)
 */
import { getEnv } from "@/lib/db";
import { errorMessage } from "@/lib/errors";

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface MailResult {
  ok: boolean;
  provider: string;
  detail?: string;
}

export async function sendEmail(input: MailInput): Promise<MailResult> {
  const env = await getEnv();
  const provider = (env.EMAIL_PROVIDER || (env.EMAIL_API_KEY ? "resend" : "log")).toLowerCase();

  if (!input.to || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.to)) {
    return { ok: false, provider, detail: `อีเมลผู้รับไม่ถูกต้อง: ${input.to || "(ว่าง)"}` };
  }

  try {
    switch (provider) {
      case "gas":
        return await sendViaAppsScript(input, env);
      case "resend":
        return await sendViaResend(input, env);
      case "webhook":
        return await sendViaWebhook(input, env);
      case "log":
      default:
        console.log(`[email:log] to=${input.to} subject=${input.subject}`);
        return { ok: true, provider: "log", detail: "โหมดจำลอง (ยังไม่ได้ตั้งค่าส่งเมลจริง)" };
    }
  } catch (err) {
    console.error("[email] error", err);
    return { ok: false, provider, detail: errorMessage(err) || "ส่งอีเมลไม่สำเร็จ" };
  }
}

async function sendViaResend(input: MailInput, env: Record<string, string>): Promise<MailResult> {
  const url = env.EMAIL_API_URL || "https://api.resend.com/emails";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.EMAIL_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM || "Document System <onboarding@resend.dev>",
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, provider: "resend", detail: `${res.status} ${body.slice(0, 300)}` };
  }
  return { ok: true, provider: "resend" };
}

async function sendViaAppsScript(input: MailInput, env: Record<string, string>): Promise<MailResult> {
  const url = env.GAS_WEBAPP_URL;
  if (!url) return { ok: false, provider: "gas", detail: "ยังไม่ได้ตั้งค่า GAS_WEBAPP_URL" };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "sendEmail",
      token: env.GAS_SECRET || "",
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text || "",
    }),
    redirect: "follow",
  });
  const data = await safeJson(res);
  if (!res.ok || data?.ok === false) {
    return { ok: false, provider: "gas", detail: (data?.error as string) || `HTTP ${res.status}` };
  }
  return { ok: true, provider: "gas" };
}

async function sendViaWebhook(input: MailInput, env: Record<string, string>): Promise<MailResult> {
  const url = env.EMAIL_WEBHOOK_URL;
  if (!url) return { ok: false, provider: "webhook", detail: "ยังไม่ได้ตั้งค่า EMAIL_WEBHOOK_URL" };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });
  if (!res.ok) return { ok: false, provider: "webhook", detail: `HTTP ${res.status}` };
  return { ok: true, provider: "webhook" };
}

export async function safeJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const text = await res.text();
    return text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** อีเมลแจ้งเตือนเอกสารใกล้หมดอายุ */
export function reminderMailContent(opts: {
  item: string;
  issueDate: string;
  expiryDate: string;
  expiryLabel: string;
  daysLeft: number;
  responsibleName: string;
  contactLocation: string;
  appUrl: string;
}) {
  const { item, issueDate, expiryLabel, daysLeft, responsibleName, contactLocation, appUrl } = opts;
  const subject =
    daysLeft < 0
      ? `[แจ้งเตือน] เอกสาร "${item}" หมดอายุแล้ว (${expiryLabel})`
      : `[แจ้งเตือน] เอกสาร "${item}" จะหมดอายุในอีก ${daysLeft} วัน (${expiryLabel})`;

  const html = `
  <div style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f5f7fb;padding:24px;color:#1f2937">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dbe4ef">
      <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:20px 24px">
        <h2 style="margin:0;color:#fff;font-size:18px">ระบบจัดเก็บเอกสารเพื่อการต่ออายุ</h2>
        <p style="margin:6px 0 0;color:#dbeafe;font-size:13px">แจ้งเตือนใบอนุญาตใกล้หมดอายุ</p>
      </div>
      <div style="padding:24px">
        <p style="margin:0 0 16px">เรียน <strong>${escapeHtml(responsibleName || "ผู้รับผิดชอบ")}</strong>,</p>
        <p style="margin:0 0 16px">
          รายการเอกสาร <strong>"${escapeHtml(item)}"</strong>
          ${daysLeft < 0
            ? `<span style="color:#dc2626"><strong>หมดอายุแล้ว</strong> ตั้งแต่วันที่ ${expiryLabel}</span>`
            : `จะถึงวันหมดอายุในอีก <span style="color:#dc2626"><strong>${daysLeft} วัน</strong></span> (วันที่ ${expiryLabel})`}
          จึงขอความกรุณาดำเนินการต่ออายุใบอนุญาตให้ทันเวลา
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px;border-bottom:1px solid #eef2f7;color:#6b7280;width:40%">วันที่ออกใบอนุญาต</td><td style="padding:8px;border-bottom:1px solid #eef2f7">${escapeHtml(issueDate || "-")}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eef2f7;color:#6b7280">วันหมดอายุ</td><td style="padding:8px;border-bottom:1px solid #eef2f7"><strong>${expiryLabel}</strong></td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eef2f7;color:#6b7280">คงเหลือ</td><td style="padding:8px;border-bottom:1px solid #eef2f7">${daysLeft < 0 ? "หมดอายุแล้ว" : daysLeft + " วัน"}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eef2f7;color:#6b7280">สถานที่ไปติดต่อ</td><td style="padding:8px;border-bottom:1px solid #eef2f7">${escapeHtml(contactLocation || "-")}</td></tr>
        </table>
        <p style="margin:20px 0 0">
          <a href="${appUrl}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">เปิดระบบจัดเก็บเอกสาร</a>
        </p>
      </div>
      <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #dbe4ef;font-size:12px;color:#6b7280">
        อีเมลนี้เป็นการแจ้งเตือนอัตโนมัติจากระบบจัดเก็บเอกสารเพื่อการต่ออายุ (แจ้งเตือนล่วงหน้า 30 วัน)
      </div>
    </div>
  </div>`;

  const text = `${subject}\n\nเปิดระบบ: ${appUrl}\nสถานที่ไปติดต่อ: ${contactLocation || "-"}`;
  return { subject, html, text };
}

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
