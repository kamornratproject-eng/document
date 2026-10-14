"use client";

import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import type { ShellUser } from "@/components/Sidebar";

export default function Navbar({
  user,
  expiringCount = 0,
}: {
  user: ShellUser;
  expiringCount?: number;
}) {
  const router = useRouter();
  const isAdmin = user.role === "admin";
  const initial = (user.fullName || "U").charAt(0);

  async function logout() {
    const confirm = await Swal.fire({
      title: "ออกจากระบบ?",
      text: "คุณต้องการออกจากระบบใช่หรือไม่",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ออกจากระบบ",
      cancelButtonText: "ยกเลิก",
    });
    if (!confirm.isConfirmed) return;
    await fetch("/api/auth/logout", { method: "POST" });
    Swal.fire({ toast: true, position: "top", icon: "success", title: "ออกจากระบบแล้ว", showConfirmButton: false, timer: 1500 });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="navbar admin-navbar navbar-expand bg-white">
      <div className="container-fluid px-3 px-lg-4">
        <button
          className="sidebar-toggle"
          type="button"
          data-sidebar-toggle
          aria-controls="adminSidebar"
          aria-expanded="true"
          aria-label="Toggle sidebar"
        >
          <span />
          <span />
          <span />
        </button>

        <div className="d-none d-md-flex ms-3 flex-grow-1">
          <div className="search-input d-flex align-items-center gap-2 text-muted">
            <i className="bi bi-search" />
            <span>ระบบจัดเก็บเอกสารเพื่อการต่ออายุ • แจ้งเตือนล่วงหน้า 30 วัน</span>
          </div>
        </div>

        <div className="navbar-actions ms-auto">
          <button
            className="icon-button theme-toggle"
            type="button"
            data-theme-toggle
            aria-label="Switch color theme"
            title="Switch color theme"
          >
            <i className="bi bi-moon-stars" data-theme-icon aria-hidden="true" />
          </button>

          <div className="dropdown">
            <button
              className="icon-button"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              aria-label="การแจ้งเตือน"
            >
              {expiringCount > 0 && <span className="notification-dot" />}
              <i className="bi bi-bell" aria-hidden="true" />
            </button>
            <div className="dropdown-menu dropdown-menu-end notification-menu">
              <div className="dropdown-header fw-bold text-body">การแจ้งเตือน</div>
              {expiringCount > 0 ? (
                <a className="dropdown-item" href="/documents?status=soon">
                  <span className="notification-title">
                    มี {expiringCount} รายการใกล้หมดอายุ (≤30 วัน)
                  </span>
                  <span className="notification-time">ตรวจสอบและต่ออายุ</span>
                </a>
              ) : (
                <span className="dropdown-item text-muted">ไม่มีเอกสารใกล้หมดอายุ</span>
              )}
              <a className="dropdown-item" href="/documents?status=expired">
                <span className="notification-title">เอกสารที่หมดอายุแล้ว</span>
                <span className="notification-time">ดำเนินการทันที</span>
              </a>
            </div>
          </div>

          <div className="dropdown">
            <button
              className="profile-button dropdown-toggle"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <span className="avatar-img avatar-sm d-inline-flex align-items-center justify-content-center bg-primary text-white fw-bold">
                {initial}
              </span>
              <span className="profile-name d-none d-sm-inline">{user.fullName}</span>
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li>
                <span className="dropdown-item-text small text-muted">
                  {user.email}
                  <br />
                  {user.department} • {isAdmin ? "Admin" : "User"}
                </span>
              </li>
              <li>
                <hr className="dropdown-divider" />
              </li>
              <li>
                <a className="dropdown-item" href="/users">
                  ข้อมูลผู้ใช้
                </a>
              </li>
              <li>
                <a className="dropdown-item" href="/reports">
                  รายงานสรุป
                </a>
              </li>
              <li>
                <hr className="dropdown-divider" />
              </li>
              <li>
                <button className="dropdown-item text-danger" onClick={logout}>
                  ออกจากระบบ
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
}
