"use client";

/** ปุ่มพิมพ์รายงาน (window.print) */
export default function PrintButton({ label = "พิมพ์รายงาน" }: { label?: string }) {
  return (
    <button className="btn btn-outline-secondary btn-sm" onClick={() => window.print()}>
      <i className="bi bi-printer" /> {label}
    </button>
  );
}
