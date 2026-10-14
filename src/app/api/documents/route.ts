import { NextResponse } from "next/server";
import { dbRun } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  listDocuments,
  toDTO,
  validateDocumentInput,
  getDocumentWithSeq,
  nextSeqId,
} from "@/lib/documents";
import { saveFile, IncomingFile } from "@/lib/storage";
import { errorMessage } from "@/lib/errors";


const MAX_FILE_MB = 25;

/** GET /api/documents?q=&status=&page=&pageSize=&sortBy= */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const url = new URL(req.url);
  const data = await listDocuments({
    q: url.searchParams.get("q") || "",
    status: url.searchParams.get("status") || "",
    page: Number(url.searchParams.get("page") || 1),
    pageSize: Number(url.searchParams.get("pageSize") || 10),
    sortBy: (url.searchParams.get("sortBy") as "expiry" | "item" | "recent") || "expiry",
  });
  return NextResponse.json({ ok: true, ...data });
}

async function parseForm(req: Request) {
  const form = await req.formData();
  const text = (k: string) => String(form.get(k) ?? "").trim();

  const file = form.get("file");
  let incoming: IncomingFile | null = null;
  if (file && typeof file === "object" && "size" in file && (file as File).size > 0) {
    const f = file as File;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      throw new Error(`ไฟล์ใหญ่เกิน ${MAX_FILE_MB} MB`);
    }
    const buf = Buffer.from(await f.arrayBuffer());
    incoming = {
      name: f.name || "document",
      type: f.type || "application/octet-stream",
      base64: buf.toString("base64"),
    };
  }

  return {
    input: {
      item: text("item"),
      issue_date: text("issue_date"),
      expiry_date: text("expiry_date"),
      contact_location: text("contact_location"),
      responsible_name: text("responsible_name"),
      responsible_email: text("responsible_email").toLowerCase(),
      note: text("note"),
    },
    file: incoming,
    removeFile: text("remove_file") === "1" || text("remove_file") === "true",
  };
}

/** POST /api/documents — เพิ่มเอกสารใหม่ (พร้อมแนบไฟล์ขึ้น Google Drive) */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  let parsed;
  try {
    parsed = await parseForm(req);
  } catch (err) {
    return NextResponse.json({ ok: false, error: errorMessage(err) || "อ่านไฟล์ไม่สำเร็จ" }, { status: 400 });
  }

  const invalid = validateDocumentInput(parsed.input);
  if (invalid) return NextResponse.json({ ok: false, error: invalid }, { status: 400 });

  let stored = null;
  if (parsed.file) {
    try {
      stored = await saveFile(parsed.file);
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `อัปโหลดไฟล์ไม่สำเร็จ: ${errorMessage(err)}` },
        { status: 502 }
      );
    }
  }

  const now = new Date().toISOString();

  // ใช้เลขลำดับว่าง (เลขที่เคยถูกลบ) ก่อน — รายการใหม่จะแทนเลขที่เคยลบไป
  // ถ้าชนกันเพราะมีคน insert พร้อมกัน ให้คำนวณใหม่แล้วลองใหม่
  let res: { changes: number; lastRowId: number } | null = null;
  let insertErr: unknown = null;
  for (let attempt = 0; attempt < 3 && !res; attempt++) {
    const seqId = await nextSeqId();
    try {
      res = await dbRun(
        `INSERT INTO documents
          (id, item, issue_date, expiry_date, contact_location, responsible_name, responsible_email,
           file_id, file_backend, file_name, file_url, file_mime, file_size, note,
           created_by, created_by_name, created_at, updated_by, updated_by_name, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          seqId,
          parsed.input.item,
          parsed.input.issue_date,
          parsed.input.expiry_date,
          parsed.input.contact_location,
          parsed.input.responsible_name,
          parsed.input.responsible_email,
          stored?.fileId ?? null,
          stored?.backend ?? null,
          stored?.name ?? null,
          stored?.url ?? null,
          stored?.mime ?? null,
          stored?.size ?? null,
          parsed.input.note,
          user.id,
          user.full_name,
          now,
          user.id,
          user.full_name,
          now,
        ]
      );
    } catch (err) {
      insertErr = err;
    }
  }
  if (!res) throw insertErr;

  await audit(
    user,
    "create",
    "document",
    res.lastRowId,
    `บันทึกรายการ "${parsed.input.item}"${stored ? ` (แนบไฟล์ ${stored.name})` : ""}`
  );

  const row = await getDocumentWithSeq(res.lastRowId);

  return NextResponse.json({
    ok: true,
    document: row ? toDTO(row) : null,
    message: "บันทึกเอกสารสำเร็จ",
  });
}
