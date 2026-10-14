"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!email || !password) {
      Swal.fire({ toast: true, position: "top", icon: "warning", title: "กรุณากรอกอีเมลและรหัสผ่าน", showConfirmButton: false, timer: 2000 });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        user?: { fullName?: string };
      };
      if (!res.ok || !data.ok) {
        await Swal.fire({
          toast: true,
          position: "top",
          icon: "error",
          title: "เข้าสู่ระบบไม่สำเร็จ",
          text: data.error || "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
          showConfirmButton: false,
          timer: 2800,
        });
        return;
      }
      await Swal.fire({
        toast: true,
        position: "top",
        icon: "success",
        title: `ยินดีต้อนรับ ${data.user?.fullName || ""}`,
        showConfirmButton: false,
        timer: 1600,
      });
      router.push("/dashboard");
      router.refresh();
    } catch {
      Swal.fire({ toast: true, position: "top", icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", showConfirmButton: false, timer: 2500 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page" data-bs-theme="light">
      <div className="auth-card">
        <div className="auth-head">
          <div className="brand-badge">
            <i className="bi bi-file-earmark-lock2" />
          </div>
          <h1 className="h4 mb-1">ระบบจัดเก็บเอกสารเพื่อการต่ออายุ</h1>
          <p className="mb-0 opacity-75" style={{ fontSize: 14 }}>
            เข้าสู่ระบบด้วยอีเมล เพื่อใช้งานทะเบียนใบอนุญาต
          </p>
        </div>

        <div className="auth-body">
          <form onSubmit={onSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="email">
                อีเมล
              </label>
              <div className="input-group">
                <span className="input-group-text bg-light">
                  <i className="bi bi-envelope" />
                </span>
                <input
                  id="email"
                  type="email"
                  className="form-control"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold" htmlFor="password">
                รหัสผ่าน
              </label>
              <div className="input-group">
                <span className="input-group-text bg-light">
                  <i className="bi bi-lock" />
                </span>
                <input
                  id="password"
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button className="btn btn-primary w-100 py-2 fw-semibold" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right me-2" />
                  เข้าสู่ระบบ
                </>
              )}
            </button>
          </form>

          <hr className="my-4" />
          <p className="text-center mb-0">
            ยังไม่มีบัญชี?{" "}
            <Link href="/register" className="fw-semibold text-decoration-none">
              ลงทะเบียนใช้งาน
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
