"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

/** ปุ่มรันการตรวจสอบและแจ้งเตือนล่วงหน้า 30 วัน */
export default function ReminderButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/reminders", { method: "POST" });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        result?: {
          candidates: number;
          sent: number;
          logged: number;
          skipped: number;
          failed: number;
        };
      };
      if (!res.ok || !data.ok || !data.result) {
        await Swal.fire("รันการแจ้งเตือนไม่สำเร็จ", data.error || "เกิดข้อผิดพลาด", "error");
        return;
      }
      const r = data.result;
      const lines = [
        `ตรวจพบเข้าเกณฑ์ (≤30 วัน): ${r.candidates} รายการ`,
        `ส่งอีเมลสำเร็จ: ${r.sent} • โหมดจำลอง: ${r.logged}`,
        `ข้าม: ${r.skipped} • ล้มเหลว: ${r.failed}`,
      ];
      await Swal.fire({
        icon: r.failed ? "warning" : "success",
        title: "ตรวจสอบการแจ้งเตือนเสร็จสิ้น",
        html: lines.map((l) => `<div>${l}</div>`).join(""),
        confirmButtonText: "ตกลง",
      });
      router.refresh();
    } catch {
      await Swal.fire("เกิดข้อผิดพลาด", "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className={`btn btn-outline-primary btn-sm${compact ? "" : ""}`} onClick={run} disabled={busy}>
      {busy ? (
        <span className="spinner-border spinner-border-sm me-1" role="status" />
      ) : (
        <i className="bi bi-bell me-1" />
      )}
      {busy ? "กำลังตรวจสอบ..." : "แจ้งเตือน 30 วัน"}
    </button>
  );
}
