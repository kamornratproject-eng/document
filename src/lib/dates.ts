// ฟังก์ชันวันที่/การคำนวณอายุใบอนุญาต (ทำงานทั้งเซิร์ฟเวอร์และเบราว์เซอร์)

export const DAY_MS = 24 * 60 * 60 * 1000;
export const REMIND_DAYS = 30;

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** วันที่ ISO (YYYY-MM-DD) ล่วงหน้า/ย้อนหลัง n วัน จากวันนี้ */
export function isoInDays(days: number): string {
  return toISODate(new Date(Date.now() + days * DAY_MS));
}

export function parseISO(s: string): Date {
  const [y, m, d] = (s || "").split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

/** จำนวนวันคงเหลือถึงวันหมดอายุ (ค่าติดลบ = หมดอายุแล้ว) */
export function daysUntil(isoDate: string): number {
  const target = parseISO(isoDate);
  const today = parseISO(todayISO());
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

/**
 * อายุใบอนุญาต (ปี) — คำนวณจาก "วันสิ้นสุด/วันหมดอายุ" เทียบกับวันนี้
 * ค่าบวก = ยังใช้ได้คงเหลือ n ปี , ค่าติดลบ = หมดอายุแล้ว
 */
export function licenseYears(expiryISO: string): number {
  const days = daysUntil(expiryISO);
  return Math.round((days / 365.25) * 100) / 100;
}

/** อายุใบอนุญาตแสดงเป็นข้อความ (จำนวนปี) */
export function licenseYearsLabel(expiryISO: string): string {
  const days = daysUntil(expiryISO);
  if (days < 0) return "หมดอายุแล้ว";
  const years = Math.round((days / 365.25) * 100) / 100;
  return `${years.toFixed(2)} ปี`;
}

/** อายุการใช้งานใบอนุญาตตั้งแต่วันออกถึงวันหมดอายุ (ปี) */
export function licenseTermLabel(issueISO: string, expiryISO: string): string {
  if (!issueISO || !expiryISO) return "-";
  const days = Math.round((parseISO(expiryISO).getTime() - parseISO(issueISO).getTime()) / DAY_MS);
  if (days < 0) return "-";
  return `${(days / 365.25).toFixed(2)} ปี`;
}

export type DocStatus = "expired" | "soon" | "active";

export function statusOf(expiryISO: string): DocStatus {
  const days = daysUntil(expiryISO);
  if (days < 0) return "expired";
  if (days <= REMIND_DAYS) return "soon";
  return "active";
}

export const STATUS_LABEL: Record<DocStatus, string> = {
  expired: "หมดอายุแล้ว",
  soon: "ใกล้หมดอายุ",
  active: "ใช้งานปกติ",
};

export const STATUS_BADGE: Record<DocStatus, string> = {
  expired: "text-bg-danger",
  soon: "text-bg-warning",
  active: "text-bg-success",
};

const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export const TH_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** หัวคอลัมน์ปฏิทินภาษาไทย (อาทิตย์→เสาร์) */
export const TH_DAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

/** 14/10/2569 — รูปแบบสำหรับช่องกรอกวันที่ (วัน/เดือน/ปี พ.ศ.) */
export function thaiInputDate(iso: string): string {
  if (!iso) return "";
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${
    d.getFullYear() + 543
  }`;
}

/**
 * แปลงข้อความรูปแบบวัน/เดือน/ปี เป็น ISO (YYYY-MM-DD)
 * รองรับทั้งปี ค.ศ. (2026) และปี พ.ศ. (2569) , คั่นด้วย / - . หรือช่องว่าง
 * คืน null เมื่อรูปแบบ/วันที่ไม่ถูกต้อง (เช่น 31/02/2568)
 */
export function parseThaiInputDate(text: string): string | null {
  const cleaned = (text || "").trim().replace(/[\s./-]+/g, "/");
  const m = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const rawYear = Number(m[3]);
  const year = rawYear > 2400 ? rawYear - 543 : rawYear; // ปี พ.ศ. → ค.ศ.
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return toISODate(d);
}

/** 14/10/2569 */
export function thaiDate(iso: string): string {
  if (!iso) return "-";
  const d = parseISO(iso);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** 14 ต.ค. 2569 */
export function thaiDateShort(iso: string): string {
  if (!iso) return "-";
  const d = parseISO(iso);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")} น.`;
  return `${date} ${time}`;
}

export function monthKey(iso: string): string {
  return (iso || "").slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return `${TH_MONTHS[m - 1]} ${y + 543}`;
}
