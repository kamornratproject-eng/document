"use client";

/**
 * ช่องกรอกวันที่แบบไทย — แสดงเป็น วัน/เดือน/ปี พ.ศ. (เช่น 14/10/2569)
 *  - พิมพ์เองได้ทั้งปี ค.ศ. และปี พ.ศ. คั่นด้วย / - . หรือช่องว่าง
 *  - มีปฏิทินภาษาไทย (เดือนเต็ม + ปี พ.ศ.) ให้เลือกวันได้จากช่อง input เลย
 *  - ค่าที่ส่งออกผ่าน onChange เป็น ISO (YYYY-MM-DD) เสมอ
 */
import { useEffect, useRef, useState } from "react";
import {
  TH_DAYS_SHORT,
  TH_MONTHS_FULL,
  parseThaiInputDate,
  parseISO,
  thaiInputDate,
  todayISO,
  toISODate,
} from "@/lib/dates";

export default function ThaiDateInput({
  id,
  value,
  onChange,
  placeholder = "วัน/เดือน/ปี",
  invalid = false,
}: {
  id?: string;
  /** ค่าวันที่แบบ ISO (YYYY-MM-DD) */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [text, setText] = useState(() => thaiInputDate(value));
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const d = value ? parseISO(value) : parseISO(todayISO());
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const [prevValue, setPrevValue] = useState(value);

  // เมื่อค่าจากภายนอกเปลี่ยน (เช่น เปิดฟอร์มแก้ไข) ให้ปรับข้อความในช่องตาม
  if (prevValue !== value) {
    setPrevValue(value);
    setText(thaiInputDate(value));
    if (value) {
      const d = parseISO(value);
      if (!Number.isNaN(d.getTime())) setView({ year: d.getFullYear(), month: d.getMonth() });
    }
  }

  // คลิกนอกช่อง → ปิดปฏิทิน
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setText(thaiInputDate(value));
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, value]);

  function commit(raw: string): boolean {
    const iso = parseThaiInputDate(raw);
    if (!iso) return false;
    onChange(iso);
    setText(thaiInputDate(iso));
    return true;
  }

  function pickDay(iso: string) {
    onChange(iso);
    setText(thaiInputDate(iso));
    const d = parseISO(iso);
    setView({ year: d.getFullYear(), month: d.getMonth() });
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function goToday() {
    pickDay(todayISO());
  }

  function clearValue() {
    onChange("");
    setText("");
    setOpen(false);
  }

  const first = new Date(view.year, view.month, 1);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const leading = first.getDay(); // 0 = อาทิตย์
  const selectedISO = value;
  const todayISOStr = todayISO();

  return (
    <div ref={rootRef} className="thai-date-root">
      <div className="input-group">
        <input
          id={id}
          className={`form-control${invalid ? " is-invalid" : ""}`}
          value={text}
          placeholder={placeholder}
          inputMode="numeric"
          autoComplete="off"
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            // ถ้าพิมพ์ครบและถูกต้อง → บันทึกเป็น ISO ทันที
            if (parseThaiInputDate(raw)) commit(raw);
          }}
          onBlur={() => {
            // ยังพิมพ์ไม่ครบ/ไม่ถูกต้อง → คืนค่าเดิมที่ถูกต้องกลับไป
            if (!commit(text)) setText(thaiInputDate(value));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(text);
            }
            if (e.key === "Escape") {
              setOpen(false);
              setText(thaiInputDate(value));
            }
          }}
        />
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => setOpen((o) => !o)}
          aria-label="เปิดปฏิทิน"
          title="เลือกวันที่จากปฏิทิน"
        >
          <i className="bi bi-calendar3" />
        </button>
      </div>

      {open && (
        <div className="thai-date-calendar card shadow-sm" role="dialog" aria-label="ปฏิทินเลือกวันที่">
          <div className="card-body p-2">
            <div className="d-flex align-items-center justify-content-between mb-2 gap-2">
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => shiftMonth(-1)}
                aria-label="เดือนก่อนหน้า"
              >
                <i className="bi bi-chevron-left" />
              </button>
              <strong className="text-center">
                {TH_MONTHS_FULL[view.month]} {view.year + 543}
              </strong>
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => shiftMonth(1)}
                aria-label="เดือนถัดไป"
              >
                <i className="bi bi-chevron-right" />
              </button>
            </div>

            <div className="thai-date-grid">
              {TH_DAYS_SHORT.map((d) => (
                <span key={d} className="thai-date-weekday">
                  {d}
                </span>
              ))}
              {Array.from({ length: leading }, (_, i) => (
                <span key={`blank-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const iso = toISODate(new Date(view.year, view.month, day));
                const isSelected = iso === selectedISO;
                const isToday = iso === todayISOStr;
                return (
                  <button
                    key={day}
                    type="button"
                    className={`thai-date-day${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
                    onClick={() => pickDay(iso)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
              <button type="button" className="btn btn-link btn-sm p-0" onClick={goToday}>
                วันนี้
              </button>
              <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={clearValue}>
                ล้างวันที่
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
