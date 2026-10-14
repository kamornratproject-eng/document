import { NextResponse } from "next/server";
import { dbRun } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  getDocument,
  getDocumentWithSeq,
  toDTO,
  validateDocumentInput,
} from "@/lib/documents";
import { deleteFile, saveFile, IncomingFile } from "@/lib/storage";
import { errorMessage } from "@/lib/errors";


const MAX_FILE_MB = 25;

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/documents/:id */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { id } = await ctx.params;
  const row = await getDocumentWithSeq(Number(id));
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบเอกสาร" }, { status: 404 });
  return NextResponse.json({ ok: true, document: toDTO(row) });
}

/** PUT /api/documents/:id — แก้ไข (ถ้าแนบไฟล์ใหม่ จะลบไฟล์เดิมออกจาก Drive ทันที) */
export async function PUT(req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await getDocument(Number(id));
  if (!existing) return NextResponse.json({ ok: false, error: "ไม่พบเอกสาร" }, { status: 404 });

  if (String(existing.created_by) !== String(user.id) && user.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "คุณไม่มีสิทธิ์แก้ไขเอกสารนี้ (เจ้าของเอกสารหรือผู้ดูแลเท่านั้น)" },
      { status: 403 }
    );
  }

  const form = await req.formData();
  const text = (k: string) => String(form.get(k) ?? "").trim();
  const input = {
    item: text("item"),
    issue_date: text("issue_date"),
    expiry_date: text("expiry_date"),
    contact_location: text("contact_location"),
    responsible_name: text("responsible_name"),
    responsible_email: text("responsible_email").toLowerCase(),
    note: text("note"),
  };

  const invalid = validateDocumentInput(input);
  if (invalid) return NextResponse.json({ ok: false, error: invalid }, { status: 400 });

  const formFile = form.get("file");
  let incoming: IncomingFile | null = null;
  if (formFile && typeof formFile === "object" && "size" in formFile && (formFile as File).size > 0) {
    const f = formFile as File;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: `ไฟล์ใหญ่เกิน ${MAX_FILE_MB} MB` },
        { status: 400 }
      );
    }
    incoming = {
      name: f.name || existing.file_name || "document",
      type: f.type || existing.file_mime || "application/octet-stream",
      base64: Buffer.from(await f.arrayBuffer()).toString("base64"),
    };
  }
  const removeFile = text("remove_file") === "1" || text("remove_file") === "true";

  let stored: Awaited<ReturnType<typeof saveFile>> | null = null;
  const fileChanged = !!incoming || removeFile;

  if (incoming) {
    try {
      stored = await saveFile(incoming);
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `อัปโหลดไฟล์ใหม่ไม่สำเร็จ: ${errorMessage(err)}` },
        { status: 502 }
      );
    }
    // ลบไฟล์เดิมออกจาก Drive ทันทีหลังอัปโหลดไฟล์ใหม่สำเร็จ
    if (existing.file_id) {
      const del = await deleteFile({ backend: existing.file_backend, fileId: existing.file_id });
      if (!del.ok) {
        console.warn("[documents] ลบไฟล์เดิมไม่สำเร็จ:", del.detail);
      }
    }
  } else if (removeFile && existing.file_id) {
    await deleteFile({ backend: existing.file_backend, fileId: existing.file_id });
  }

  const now = new Date().toISOString();
  const nextFile = stored
    ? {
        file_id: stored.fileId,
        file_backend: stored.backend,
        file_name: stored.name,
        file_url: stored.url,
        file_mime: stored.mime,
        file_size: stored.size,
      }
    : removeFile
      ? {
          file_id: null,
          file_backend: null,
          file_name: null,
          file_url: null,
          file_mime: null,
          file_size: null,
        }
      : {
          file_id: existing.file_id,
          file_backend: existing.file_backend,
          file_name: existing.file_name,
          file_url: existing.file_url,
          file_mime: existing.file_mime,
          file_size: existing.file_size,
        };

  await dbRun(
    `UPDATE documents SET
       item = ?, issue_date = ?, expiry_date = ?, contact_location = ?,
       responsible_name = ?, responsible_email = ?, note = ?,
       file_id = ?, file_backend = ?, file_name = ?, file_url = ?, file_mime = ?, file_size = ?,
       updated_by = ?, updated_by_name = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.item,
      input.issue_date,
      input.expiry_date,
      input.contact_location,
      input.responsible_name,
      input.responsible_email,
      input.note,
      nextFile.file_id,
      nextFile.file_backend,
      nextFile.file_name,
      nextFile.file_url,
      nextFile.file_mime,
      nextFile.file_size,
      user.id,
      user.full_name,
      now,
      existing.id,
    ]
  );

  // บันทึกประวัติผู้แก้ไข
  await audit(
    user,
    fileChanged ? "update_with_file" : "update",
    "document",
    existing.id,
    `แก้ไขรายการ "${input.item}"${stored ? ` (แทนที่ไฟล์ด้วย ${stored.name})` : removeFile ? " (ลบไฟล์แนบ)" : ""}`
  );

  const row = await getDocumentWithSeq(existing.id);
  return NextResponse.json({
    ok: true,
    document: row ? toDTO(row) : null,
    message: "แก้ไขเอกสารสำเร็จ",
    fileReplaced: !!stored,
    fileRemoved: removeFile && !stored,
  });
}

/** DELETE /api/documents/:id — ลบเอกสาร (และลบไฟล์เดิมจาก Drive ทันที) */
export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await getDocument(Number(id));
  if (!existing) return NextResponse.json({ ok: false, error: "ไม่พบเอกสาร" }, { status: 404 });

  if (String(existing.created_by) !== String(user.id) && user.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "คุณไม่มีสิทธิ์ลบเอกสารนี้ (เจ้าของเอกสารหรือผู้ดูแลเท่านั้น)" },
      { status: 403 }
    );
  }

  // 1) ลบไฟล์ออกจาก Google Drive ทันที
  let fileDeleted = true;
  let fileDetail = "";
  if (existing.file_id) {
    const del = await deleteFile({ backend: existing.file_backend, fileId: existing.file_id });
    fileDeleted = del.ok;
    fileDetail = del.detail || "";
  }

  // 2) ลบข้อมูลในตาราง
  await dbRun("DELETE FROM documents WHERE id = ?", [existing.id]);
  await dbRun("DELETE FROM notifications WHERE document_id = ?", [existing.id]);

  await audit(
    user,
    "delete",
    "document",
    existing.id,
    `ลบรายการ "${existing.item}"${existing.file_id ? ` และไฟล์ ${existing.file_name} (${existing.file_id})` : ""}`
  );

  return NextResponse.json({
    ok: true,
    message: "ลบเอกสารสำเร็จ",
    fileDeleted,
    fileDetail,
  });
}
