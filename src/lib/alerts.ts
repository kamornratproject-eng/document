"use client";

import Swal from "sweetalert2";

/** Toast แจ้งผลสำเร็จ/ผิดพลาด (SweetAlert2) */
export const toast = {
  success(title: string, text?: string) {
    return Swal.fire({ toast: true, position: "top", icon: "success", title, text, showConfirmButton: false, timer: 2600 });
  },
  error(title: string, text?: string) {
    return Swal.fire({ toast: true, position: "top", icon: "error", title, text, showConfirmButton: false, timer: 3200 });
  },
  info(title: string, text?: string) {
    return Swal.fire({ toast: true, position: "top", icon: "info", title, text, showConfirmButton: false, timer: 2600 });
  },
};

export async function confirmDelete(itemName: string): Promise<boolean> {
  const res = await Swal.fire({
    title: "ยืนยันการลบเอกสาร?",
    html: `รายการ <strong>${escapeHtml(itemName)}</strong><br/><span class="small text-muted">ไฟล์แนบจะถูกลบออกจาก Google Drive ทันที</span>`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#64748b",
    confirmButtonText: "ลบเลย",
    cancelButtonText: "ยกเลิก",
  });
  return res.isConfirmed;
}

export async function confirmAction(
  title: string,
  html: string,
  confirmText = "ยืนยัน"
): Promise<boolean> {
  const res = await Swal.fire({
    title,
    html,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "ยกเลิก",
  });
  return res.isConfirmed;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
