// ฟังก์ชันช่วยบันทึกประวัติการใช้งาน (ผู้บันทึก / ผู้แก้ไข)
import { dbRun } from "@/lib/db";

export interface Actor {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

export async function audit(
  actor: Actor | null,
  action: string,
  entity: string,
  entityId: string | number | null,
  detail: string
): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        actor?.id ?? null,
        actor ? `${actor.full_name} (${actor.email})` : "ระบบ",
        action,
        entity,
        entityId === null ? null : String(entityId),
        detail,
        new Date().toISOString(),
      ]
    );
  } catch (err) {
    console.error("[audit] failed", err);
  }
}
