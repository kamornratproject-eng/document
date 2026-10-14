"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    department: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!form.fullName || !form.department || !form.email || !form.password) {
      Swal.fire({ toast: true, position: "top", icon: "warning", title: "กรุณากรอกข้อมูลให้ครบถ้วน", showConfirmButton: false, timer: 2000 });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        isFirstUser?: boolean;
        user?: { fullName?: string };
      };
      if (!res.ok || !data.ok) {
        await Swal.fire({
          icon: "error",
          title: "ลงทะเบียนไม่สำเร็จ",
          text: data.error || "กรุณาลองใหม่อีกครั้ง",
          confirmButtonText: "ตกลง",
        });
        return;
      }
      await Swal.fire({
        icon: "success",
        title: "ลงทะเบียนสำเร็จ",
        html: data.isFirstUser
          ? "คุณคือผู้ดูแลระบบคนแรกของระบบ"
          : `ยินดีต้อนรับ <strong>${data.user?.fullName || ""}</strong>`,
        confirmButtonText: "เริ่มใช้งาน",
      });
      router.push("/dashboard");
      router.refresh();
    } catch {
      Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", confirmButtonText: "ตกลง" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page" data-bs-theme="light">
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <div className="auth-head">
          <div className="brand-badge">
            <i className="bi bi-person-plus-fill" />
          </div>
          <h1 className="h4 mb-1">ลงทะเบียนใช้งานระบบ</h1>
          <p className="mb-0 opacity-75" style={{ fontSize: 14 }}>
            ระบบจัดเก็บเอกสารใบอนุญาตเพื่อการต่ออายุ
          </p>
        </div>

        <div className="auth-body">
          <form onSubmit={onSubmit} noValidate>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label fw-semibold" htmlFor="fullName">
                  ชื่อ-สกุล
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light">
                    <i className="bi bi-person" />
                  </span>
                  <input
                    id="fullName"
                    className="form-control"
                    placeholder="นางสาวสมหญิง ใจดี"
                    value={form.fullName}
                    onChange={set("fullName")}
                    autoFocus
                  />
                </div>
              </div>

              <div className="col-12">
                <label className="form-label fw-semibold" htmlFor="department">
                  แผนก
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light">
                    <i className="bi bi-building" />
                  </span>
                  <input
                    id="department"
                    className="form-control"
                    placeholder="งาน/แผนก หรือ หน่วยงาน"
                    value={form.department}
                    onChange={set("department")}
                  />
                </div>
              </div>

              <div className="col-12">
                <label className="form-label fw-semibold" htmlFor="regEmail">
                  อีเมล
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light">
                    <i className="bi bi-envelope" />
                  </span>
                  <input
                    id="regEmail"
                    type="email"
                    className="form-control"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={set("email")}
                    autoComplete="email"
                  />
                </div>
                <div className="form-text">ใช้อีเมลนี้สำหรับเข้าสู่ระบบ</div>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="password">
                  รหัสผ่าน
                </label>
                <input
                  id="password"
                  type="password"
                  className="form-control"
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={form.password}
                  onChange={set("password")}
                  autoComplete="new-password"
                />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="confirm">
                  ยืนยันรหัสผ่าน
                </label>
                <input
                  id="confirm"
                  type="password"
                  className="form-control"
                  placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                  value={form.confirm}
                  onChange={set("confirm")}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button className="btn btn-primary w-100 py-2 fw-semibold mt-4" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  กำลังลงทะเบียน...
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle me-2" />
                  ลงทะเบียนใช้งาน
                </>
              )}
            </button>
          </form>

          <hr className="my-4" />
          <p className="text-center mb-0">
            มีบัญชีแล้ว?{" "}
            <Link href="/login" className="fw-semibold text-decoration-none">
              เข้าสู่ระบบ
            </Link>
          </p>
          <p className="text-center text-muted small mt-2 mb-0">
            * ผู้ใช้คนแรกของระบบจะได้สิทธิ์ผู้ดูแลระบบ (Admin)
          </p>
        </div>
      </div>
    </div>
  );
}
