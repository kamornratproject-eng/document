"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import type { DocumentDTO } from "@/lib/documents";
import { errorMessage } from "@/lib/errors";

/** ส่งออกข้อมูลเอกสารเป็นไฟล์ CSV (UTF-8 BOM ให้เปิดใน Excel ภาษาไทยได้) */
export default function ExportCsv() {
  const [busy, setBusy] = useState(false);

  async function exportCsv() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/documents?pageSize=500&sortBy=expiry");
      const json = (await res.json()) as { ok: boolean; rows: DocumentDTO[]; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "โหลดข้อมูลไม่สำเร็จ");

      const header = [
        "ลำดับ",
        "รายการ",
        "วันที่ออกใบอนุญาต",
        "วันที่หมดอายุใบอนุญาต",
        "อายุใบอนุญาต(ปี)",
        "สถานะ",
        "สถานที่ไปติดต่อ",
        "ผู้รับผิดชอบ",
        "อีเมล",
        "ไฟล์เอกสาร",
        "ผู้บันทึก",
        "ผู้แก้ไข",
        "วันที่แก้ไขล่าสุด",
      ];

      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [
        header.map(esc).join(","),
        ...json.rows.map((d) =>
          [
            d.seq,
            d.item,
            d.issueDate,
            d.expiryDate,
            d.years,
            d.statusLabel,
            d.contactLocation,
            d.responsibleName,
            d.responsibleEmail,
            d.file.name || "",
            d.createdByName,
            d.updatedByName,
            d.updatedAt || "",
          ]
            .map(esc)
            .join(",")
        ),
      ];

      const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documents-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      Swal.fire({ toast: true, position: "top", icon: "success", title: "ส่งออก CSV แล้ว", showConfirmButton: false, timer: 1800 });
    } catch (err) {
      Swal.fire("ส่งออกไม่สำเร็จ", errorMessage(err) || "เกิดข้อผิดพลาด", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn-outline-secondary btn-sm" onClick={exportCsv} disabled={busy}>
      {busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-download me-1" />}
      ส่งออก CSV
    </button>
  );
}
