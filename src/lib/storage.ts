/**
 * ที่เก็บไฟล์เอกสาร
 *  - drive : อัปโหลดเข้า Google Drive ผ่าน Google Apps Script (Code.gs) — ใช้ตอนขึ้น Cloudflare
 *  - local : เก็บลงโฟลเดอร์ data/uploads (ใช้ตอนพัฒนาบนเครื่อง หรือเมื่อยังไม่ตั้งค่า GAS)
 * เมื่อมีการ "แก้ไขไฟล์ใหม่" หรือ "ลบเอกสาร" ระบบจะลบไฟล์เดิมออกจาก Drive ทันที
 */
import { randomUUID } from "node:crypto";
import { getEnv, isCloudflareRuntime } from "@/lib/db";
import { errorMessage } from "@/lib/errors";

export const DEFAULT_FOLDER_ID = "1AtnkpeRcZ7KVD2wpgwIi2hNsq8Mt-E2Q";

export interface StoredFile {
  backend: "drive" | "local";
  fileId: string;
  name: string;
  url: string;
  mime: string;
  size: number;
}

export interface IncomingFile {
  name: string;
  type: string;
  base64: string;
}

async function backend(env: Record<string, string>): Promise<"drive" | "local"> {
  if (env.GAS_WEBAPP_URL) return "drive";
  if (env.STORAGE_BACKEND === "drive") return "drive";
  return "local";
}

async function gasCall(
  env: Record<string, string>,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = env.GAS_WEBAPP_URL;
  if (!url) throw new Error("ยังไม่ได้ตั้งค่า GAS_WEBAPP_URL (URL ของ Google Apps Script /exec)");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: env.GAS_SECRET || "", ...payload }),
    redirect: "follow",
  });
  const text = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Apps Script ตอบกลับผิดรูปแบบ (HTTP ${res.status})`);
  }
  if (!res.ok || data?.ok === false) {
    throw new Error((data?.error as string) || `Apps Script ตอบ HTTP ${res.status}`);
  }
  return data;
}

/** บันทึกไฟล์ใหม่ → คืน reference สำหรับเก็บลงฐานข้อมูล */
export async function saveFile(file: IncomingFile): Promise<StoredFile> {
  const env = await getEnv();
  const kind = await backend(env);
  const safeName = (file.name || "file").replace(/[^\wก-๙.\- ()]/g, "_");
  const size = Math.floor((file.base64.length * 3) / 4);

  if (kind === "drive") {
    const data = await gasCall(env, {
      action: "upload",
      folderId: env.GDRIVE_FOLDER_ID || DEFAULT_FOLDER_ID,
      filename: safeName,
      mimeType: file.type || "application/octet-stream",
      content: file.base64,
    });
    return {
      backend: "drive",
      fileId: data.fileId as string,
      name: (data.name as string) || safeName,
      url: (data.url as string) || (data.viewLink as string) || "",
      mime: file.type || "application/octet-stream",
      size: Number(data.size || size),
    };
  }

  // local storage (พัฒนาบนเครื่อง / เซิร์ฟเวอร์ที่มีดิสก์)
  if (await isCloudflareRuntime()) {
    throw new Error(
      "ระบบบน Cloudflare ต้องใช้ Google Drive ในการเก็บไฟล์ — กรุณาตั้งค่า GAS_WEBAPP_URL (URL /exec ของ Apps Script)"
    );
  }
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = process.env.UPLOAD_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const fileId = randomUUID();
  const fileName = `${fileId}_${safeName}`;
  fs.writeFileSync(path.join(dir, fileName), Buffer.from(file.base64, "base64"));
  return {
    backend: "local",
    fileId,
    name: safeName,
    url: `/api/files/${fileId}`,
    mime: file.type || "application/octet-stream",
    size,
  };
}

/** ลบไฟล์ออกจาก Drive (หรือ local) ทันที — ใช้ตอนแก้ไข/ลบเอกสาร */
export async function deleteFile(ref: {
  backend?: string | null;
  fileId?: string | null;
}): Promise<{ ok: boolean; detail?: string }> {
  if (!ref.fileId) return { ok: true, detail: "ไม่มีไฟล์" };
  try {
    if (ref.backend === "local") {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const dir = process.env.UPLOAD_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "uploads");
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.startsWith(String(ref.fileId))) fs.unlinkSync(path.join(dir, f));
      }
      return { ok: true };
    }
    const env = await getEnv();
    if (!env.GAS_WEBAPP_URL) {
      return { ok: false, detail: "ยังไม่ได้ตั้งค่า GAS_WEBAPP_URL — ลบไฟล์จาก Drive ไม่ได้" };
    }
    const data = await gasCall(env, { action: "delete", fileId: ref.fileId });
    return { ok: true, detail: data?.name ? `ลบ ${String(data.name)}` : undefined };
  } catch (err) {
    console.error("[drive] delete failed", err);
    return { ok: false, detail: errorMessage(err) || "ลบไฟล์ไม่สำเร็จ" };
  }
}

/** อ่านไฟล์จาก local storage เพื่อแสดงผล (สำหรับโหมด local) */
export async function readLocalFile(fileId: string): Promise<{
  buffer: Buffer;
  name: string;
} | null> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = process.env.UPLOAD_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "uploads");
  if (!fs.existsSync(dir)) return null;
  const match = fs.readdirSync(dir).find((f) => f.startsWith(fileId));
  if (!match) return null;
  const buffer = fs.readFileSync(path.join(dir, match));
  const name = match.replace(new RegExp(`^${fileId}_`), "");
  return { buffer, name };
}
