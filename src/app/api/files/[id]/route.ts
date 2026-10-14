import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { readLocalFile } from "@/lib/storage";


/** GET /api/files/:id — เสิร์ฟไฟล์ที่เก็บแบบ local (ตอนพัฒนาบนเครื่อง) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { id } = await ctx.params;
  const file = await readLocalFile(id);
  if (!file) return NextResponse.json({ ok: false, error: "ไม่พบไฟล์" }, { status: 404 });

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mime: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    txt: "text/plain; charset=utf-8",
    csv: "text/csv; charset=utf-8",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    zip: "application/zip",
  };

  return new Response(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": mime[ext] || "application/octet-stream",
      "Content-Length": String(file.buffer.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
