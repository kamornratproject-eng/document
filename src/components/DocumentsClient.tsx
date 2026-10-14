"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";
import { confirmDelete, toast } from "@/lib/alerts";
import type { DocumentDTO } from "@/lib/documents";
import { daysUntil, formatDateTime, licenseTermLabel, thaiDateShort } from "@/lib/dates";
import ThaiDateInput from "@/components/ThaiDateInput";

interface ListResponse {
  ok: boolean;
  rows: DocumentDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
}

const EMPTY_FORM = {
  item: "",
  issue_date: "",
  expiry_date: "",
  contact_location: "",
  responsible_name: "",
  responsible_email: "",
  note: "",
};

type FormState = typeof EMPTY_FORM;

function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog">
        <div
          className="modal-backdrop fade show"
          onClick={onClose}
          style={{ zIndex: 0 }}
        />
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" style={{ zIndex: 1050 }}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title d-flex align-items-center gap-2">
                <i className="bi bi-journal-text" /> {title}
              </h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
    </>
  );
}

function DocumentsInner({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [sortBy, setSortBy] = useState("expiry");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentDTO | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        status,
        page: String(page),
        pageSize: "10",
        sortBy,
      });
      const res = await fetch(`/api/documents?${params.toString()}`);
      const json: ListResponse = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "โหลดข้อมูลไม่สำเร็จ");
      } else {
        setError("");
        setData(json);
      }
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  }, [q, status, page, sortBy]);

  useEffect(() => {
    const t = setTimeout(load, q ? 280 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // เปิดฟอร์มเพิ่มใหม่อัตโนมัติเมื่อมาพร้อม ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreate();
      router.replace("/documents");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFile(null);
    setRemoveFile(false);
    if (fileRef.current) fileRef.current.value = "";
    setModalOpen(true);
  }

  function openEdit(doc: DocumentDTO) {
    setEditing(doc);
    setForm({
      item: doc.item,
      issue_date: doc.issueDate,
      expiry_date: doc.expiryDate,
      contact_location: doc.contactLocation,
      responsible_name: doc.responsibleName,
      responsible_email: doc.responsibleEmail,
      note: doc.note,
    });
    setFile(null);
    setRemoveFile(false);
    if (fileRef.current) fileRef.current.value = "";
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (!form.item.trim()) return toast.error("กรุณาระบุรายการเอกสาร");
    if (!form.issue_date || !form.expiry_date) return toast.error("กรุณาระบุวันที่ให้ครบ");
    if (form.expiry_date < form.issue_date)
      return toast.error("วันหมดอายุต้องมากกว่าหรือเท่ากับวันที่ออก");
    if (form.responsible_email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.responsible_email))
      return toast.error("รูปแบบอีเมลไม่ถูกต้อง");
    if (editing && !editing.file.id && file) {
      // no-op
    }

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append("file", file);
      if (editing && removeFile && !file) fd.append("remove_file", "1");

      const url = editing ? `/api/documents/${editing.id}` : "/api/documents";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        body: fd,
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || !json.ok) {
        await Swal.fire({
          icon: "error",
          title: editing ? "แก้ไขไม่สำเร็จ" : "บันทึกไม่สำเร็จ",
          text: json.error || "เกิดข้อผิดพลาด",
          confirmButtonText: "ตกลง",
        });
        return;
      }

      setModalOpen(false);
      // รีเฟรชรายการทันที (ไม่ต้องรอ toast)
      const refresh = load();
      router.refresh();
      await toast.success(editing ? "แก้ไขเอกสารสำเร็จ" : "เพิ่มเอกสารสำเร็จ", json.message);
      await refresh;
    } catch {
      await Swal.fire("เกิดข้อผิดพลาด", "บันทึกข้อมูลไม่สำเร็จ", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(doc: DocumentDTO) {
    if (!canEdit && doc.status) return;
    const ok = await confirmDelete(doc.item);
    if (!ok) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    const json = (await res.json()) as {
      ok: boolean;
      error?: string;
      fileDeleted?: boolean;
      fileDetail?: string;
    };
    if (!res.ok || !json.ok) {
      await Swal.fire("ลบไม่สำเร็จ", json.error || "เกิดข้อผิดพลาด", "error");
      return;
    }
    // รีเฟรชรายการทันที แล้วค่อยแสดงผลลัพธ์
    const refresh = load();
    router.refresh();
    await Swal.fire({
      icon: json.fileDeleted === false ? "warning" : "success",
      title: "ลบเอกสารสำเร็จ",
      html:
        json.fileDeleted === false
          ? `ลบข้อมูลแล้ว แต่ลบไฟล์จาก Drive ไม่สำเร็จ<br/><span class="small">${json.fileDetail || ""}</span>`
          : "ลบข้อมูลและไฟล์แนบออกจาก Google Drive แล้ว",
      confirmButtonText: "ตกลง",
    });
    await refresh;
  }

  const rows = data?.rows ?? [];
  const pages = data?.totalPages ?? 1;

  // อายุใบอนุญาตที่คำนวณจากวันที่กรอกในฟอร์ม (แสดงในช่อง input อ่านอย่างเดียว)
  const expiryDays = form.expiry_date ? daysUntil(form.expiry_date) : null;
  const licenseAgeLabel =
    expiryDays === null
      ? "-"
      : expiryDays < 0
        ? `หมดอายุแล้ว (เลยกำหนด ${Math.abs(expiryDays)} วัน)`
        : `เหลือ ${expiryDays} วัน ≈ ${(expiryDays / 365.25).toFixed(2)} ปี (อายุการใช้งานรวม ${licenseTermLabel(
            form.issue_date,
            form.expiry_date
          )})`;

  const statusTabs = [
    { key: "", label: "ทั้งหมด" },
    { key: "active", label: "ใช้งานปกติ" },
    { key: "soon", label: "ใกล้หมดอายุ" },
    { key: "expired", label: "หมดอายุแล้ว" },
  ];

  return (
    <>
      <div className="page-heading">
        <div className="page-heading-copy">
          <span className="page-icon">
            <i className="bi bi-journal-text" />
          </span>
          <div>
            <p className="eyebrow mb-1">ทะเบียน</p>
            <h1 className="h3 mb-1">ทะเบียนเอกสารใบอนุญาต</h1>
            <p className="text-muted mb-0">
              เก็บข้อมูลใบอนุญาต วันหมดอายุ อายุใบอนุญาต (คำนวณจากวันสิ้นสุด) ผู้รับผิดชอบ และไฟล์เอกสาร
            </p>
          </div>
        </div>
        <div className="heading-actions">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => load()}>
            <i className="bi bi-arrow-clockwise" /> รีเฟรช
          </button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <i className="bi bi-plus-lg" /> เพิ่มเอกสาร
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="h5 mb-1 section-title">
              <i className="bi bi-table" /> <span>รายการเอกสาร</span>
            </h2>
            <p className="text-muted mb-0 small">
              {data ? `พบ ${data.total} รายการ` : "กำลังโหลดข้อมูล..."}
            </p>
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <input
              className="form-control form-control-sm table-search"
              type="search"
              placeholder="ค้นหา รายการ/ผู้รับผิดชอบ/สถานที่"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              aria-label="ค้นหาเอกสาร"
            />
            <select
              className="form-select form-select-sm"
              style={{ width: 170 }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="เรียงลำดับ"
            >
              <option value="expiry">เรียงตามวันหมดอายุ</option>
              <option value="recent">เรียงรายการใหม่สุด</option>
              <option value="item">เรียงตามชื่อรายการ</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <i className="bi bi-plus-lg" /> เพิ่มเอกสาร
            </button>
          </div>
        </div>

        <div className="px-3 pt-2 d-flex flex-wrap gap-2">
          {statusTabs.map((t) => (
            <button
              key={t.key}
              className={`btn btn-sm ${status === t.key ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => {
                setStatus(t.key);
                setPage(1);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="alert alert-danger mt-3 mx-3 mb-0" role="alert">
            <i className="bi bi-exclamation-triangle me-2" />
            {error}
          </div>
        )}

        <div className="table-responsive mt-2">
          <table className="table align-middle mb-0 doc-table">
            <thead>
              <tr>
                <th style={{ width: 56 }}>ลำดับ</th>
                <th>รายการ</th>
                <th>วันที่ออกใบอนุญาต</th>
                <th>วันที่หมดอายุ</th>
                <th>อายุใบอนุญาต</th>
                <th>สถานที่ไปติดต่อ</th>
                <th>ผู้รับผิดชอบ</th>
                <th>อีเมล</th>
                <th>ไฟล์เอกสาร</th>
                <th>ผู้บันทึก / ผู้แก้ไข</th>
                <th className="text-end">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr>
                  <td colSpan={11} className="text-center py-5 text-muted">
                    <span className="spinner-border spinner-border-sm me-2" />
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-5 text-muted">
                    ไม่พบข้อมูลเอกสาร
                  </td>
                </tr>
              )}
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>{d.seq}</td>
                  <td>
                    <p className="cell-main mb-0">{d.item}</p>
                    <p className="cell-sub mb-0">
                      <span className={`badge ${d.statusBadge}`}>{d.statusLabel}</span>
                    </p>
                  </td>
                  <td className="text-nowrap">{thaiDateShort(d.issueDate)}</td>
                  <td className="text-nowrap">
                    <strong>{thaiDateShort(d.expiryDate)}</strong>
                    <p className="cell-sub mb-0">
                      {d.daysLeft >= 0 ? `เหลือ ${d.daysLeft} วัน` : `เลยกำหนด ${Math.abs(d.daysLeft)} วัน`}
                    </p>
                  </td>
                  <td>
                    <span
                      className={`years-pill ${d.status === "expired" ? "is-expired" : d.status === "soon" ? "is-soon" : ""}`}
                      title={`อายุการใช้งานรวมตั้งแต่วันออกถึงวันหมดอายุ: ${d.termLabel}`}
                    >
                      <i className="bi bi-clock-history" />
                      {d.yearsLabel}
                    </span>
                    <p className="cell-sub mb-0">อายุการใช้งาน {d.termLabel}</p>
                  </td>
                  <td>{d.contactLocation || "-"}</td>
                  <td>{d.responsibleName || "-"}</td>
                  <td>
                    {d.responsibleEmail ? (
                      <a href={`mailto:${d.responsibleEmail}`} className="text-decoration-none">
                        {d.responsibleEmail}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {d.file.id ? (
                      <a
                        href={d.file.url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        title={d.file.name || ""}
                        className="file-thumb-link"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://drive.google.com/thumbnail?id=${d.file.id}&sz=w80`}
                          alt={d.file.name || "ไฟล์เอกสาร"}
                          className="file-thumb"
                          onError={(e) => {
                            const el = e.currentTarget as HTMLImageElement;
                            el.style.display = "none";
                            const fallback = el.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = "inline-flex";
                          }}
                        />
                        <span className="file-thumb-fallback" style={{ display: "none" }}>
                          <i className="bi bi-file-earmark-text" />
                        </span>
                      </a>
                    ) : (
                      <span className="no-file">ไม่มีไฟล์แนบ</span>
                    )}
                  </td>
                  <td>
                    <p className="cell-sub mb-0">
                      <i className="bi bi-person-check" /> {d.createdByName || "-"}
                    </p>
                    <p className="cell-sub mb-0">
                      <i className="bi bi-pencil" /> {d.updatedByName || "-"}
                      {d.updatedAt ? ` • ${formatDateTime(d.updatedAt)}` : ""}
                    </p>
                  </td>
                  <td className="text-end text-nowrap">
                    <button
                      className="btn btn-light btn-sm me-1"
                      onClick={() => openEdit(d)}
                      title="แก้ไข"
                    >
                      <i className="bi bi-pencil-square" />
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => remove(d)}
                      title="ลบ"
                    >
                      <i className="bi bi-trash3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 mt-3 px-3 pb-3">
          <p className="text-muted small mb-0">
            {data
              ? `แสดง ${(data.page - 1) * data.pageSize + (rows.length ? 1 : 0)} ถึง ${(data.page - 1) * data.pageSize + rows.length} จาก ${data.total} รายการ`
              : "-"}
          </p>
          <nav aria-label="pagination">
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${page <= 1 ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  ก่อนหน้า
                </button>
              </li>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                let p = i + 1;
                if (pages > 7 && page > 4) p = Math.min(pages - 6 + i, page - 3 + i);
                return (
                  <li key={p} className={`page-item ${p === page ? "active" : ""}`}>
                    <button className="page-link" onClick={() => setPage(p)}>
                      {p}
                    </button>
                  </li>
                );
              })}
              <li className={`page-item ${page >= pages ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                  ถัดไป
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </section>

      <Modal
        open={modalOpen}
        title={editing ? `แก้ไขเอกสาร #${editing.seq}` : "เพิ่มเอกสารใบอนุญาต"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setModalOpen(false)} type="button">
              ยกเลิก
            </button>
            <button className="btn btn-primary" form="docForm" disabled={saving} type="submit">
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <i className="bi bi-save me-1" /> {editing ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}
                </>
              )}
            </button>
          </>
        }
      >
        <form id="docForm" onSubmit={submit}>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label fw-semibold" htmlFor="item">
                รายการ <span className="text-danger">*</span>
              </label>
              <input
                id="item"
                className="form-control"
                placeholder="เช่น ใบอนุญาตประกอบกิจการสถานีบริการน้ำมัน"
                value={form.item}
                onChange={(e) => setForm({ ...form, item: e.target.value })}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="issue_date">
                วันที่ออกใบอนุญาต (วัน/เดือน/ปี) <span className="text-danger">*</span>
              </label>
              <ThaiDateInput
                id="issue_date"
                value={form.issue_date}
                onChange={(iso) => setForm({ ...form, issue_date: iso })}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="expiry_date">
                วันที่หมดอายุใบอนุญาต (วัน/เดือน/ปี) <span className="text-danger">*</span>
              </label>
              <ThaiDateInput
                id="expiry_date"
                value={form.expiry_date}
                onChange={(iso) => setForm({ ...form, expiry_date: iso })}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="license_age">
                อายุใบอนุญาต (คำนวณจากวันหมดอายุ)
              </label>
              <input id="license_age" className="form-control" readOnly value={licenseAgeLabel} />
            </div>

            <div className="col-12">
              <label className="form-label fw-semibold" htmlFor="contact_location">
                สถานที่ไปติดต่อ
              </label>
              <input
                id="contact_location"
                className="form-control"
                placeholder="เช่น สำนักงานเขตพื้นที่..."
                value={form.contact_location}
                onChange={(e) => setForm({ ...form, contact_location: e.target.value })}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="responsible_name">
                ผู้รับผิดชอบ
              </label>
              <input
                id="responsible_name"
                className="form-control"
                placeholder="ชื่อผู้รับผิดชอบ"
                value={form.responsible_name}
                onChange={(e) => setForm({ ...form, responsible_name: e.target.value })}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="responsible_email">
                อีเมลผู้รับผิดชอบ
              </label>
              <input
                id="responsible_email"
                type="email"
                className="form-control"
                placeholder="ใช้สำหรับแจ้งเตือนก่อนหมดอายุ 30 วัน"
                value={form.responsible_email}
                onChange={(e) => setForm({ ...form, responsible_email: e.target.value })}
              />
            </div>

            <div className="col-12">
              <label className="form-label fw-semibold" htmlFor="file">
                แนบไฟล์เอกสาร (อัปโหลดขึ้น Google Drive)
              </label>
              <input
                id="file"
                ref={fileRef}
                type="file"
                className="form-control"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setRemoveFile(false);
                }}
              />
              <div className="form-text">รองรับสูงสุด 25 MB • เมื่อแทนที่ไฟล์เดิม ระบบจะลบไฟล์เดิมออกจาก Drive ทันที</div>

              {editing?.file.id && !file && (
                <div className="mt-2 d-flex align-items-center justify-content-between gap-2 border rounded p-2 bg-light">
                  <a
                    className="file-chip"
                    href={editing.file.url || "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <i className="bi bi-paperclip" />
                    <span>{editing.file.name}</span>
                  </a>
                  <label className="btn btn-outline-danger btn-sm mb-0">
                    <i className="bi bi-trash3 me-1" /> ลบไฟล์เดิม
                    <input
                      type="checkbox"
                      className="btn-check"
                      checked={removeFile}
                      onChange={(e) => setRemoveFile(e.target.checked)}
                    />
                  </label>
                </div>
              )}
              {file && (
                <div className="mt-2">
                  <span className="file-chip">
                    <i className="bi bi-file-earmark-arrow-up" />
                    <span>
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </span>
                </div>
              )}
            </div>

            <div className="col-12">
              <label className="form-label fw-semibold" htmlFor="note">
                บันทึกเพิ่มเติม
              </label>
              <textarea
                id="note"
                className="form-control"
                rows={2}
                placeholder="หมายเหตุ/รายละเอียดเพิ่มเติม"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default function DocumentsClient({ canEdit }: { canEdit: boolean }) {
  return (
    <Suspense fallback={<div className="text-center py-5 text-muted">กำลังโหลด...</div>}>
      <DocumentsInner canEdit={canEdit} />
    </Suspense>
  );
}
