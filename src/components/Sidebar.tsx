"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ShellUser {
  id: number;
  fullName: string;
  department: string;
  email: string;
  role: string;
}

const NAV: { href: string; icon: string; label: string; adminOnly?: boolean }[] = [
  { href: "/dashboard", icon: "bi-speedometer2", label: "แดชบอร์ด" },
  { href: "/documents", icon: "bi-journal-text", label: "ทะเบียนเอกสาร" },
  { href: "/reports", icon: "bi-bar-chart-line", label: "รายงาน / กราฟ" },
  { href: "/users", icon: "bi-people", label: "ผู้ใช้งาน", adminOnly: true },
];

export default function Sidebar({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const isAdmin = user.role === "admin";

  return (
    <>
      <div className="sidebar-backdrop" data-sidebar-close />
      <aside className="admin-sidebar" id="adminSidebar" aria-label="เมนูหลัก">
        <div className="sidebar-header">
          <Link className="brand-mark" href="/dashboard">
            <span className="brand-icon">
              <i className="bi bi-file-earmark-lock2" aria-hidden="true" />
            </span>
            <span className="brand-copy">
              <span className="brand-title">DocRenewal</span>
              <span className="brand-subtitle">ระบบจัดเก็บเอกสาร</span>
            </span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          {NAV.filter((n) => !n.adminOnly || isAdmin).map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`nav-link${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-icon">
                  <i className={`bi ${n.icon}`} aria-hidden="true" />
                </span>
                <span className="nav-text">{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          <span className="sidebar-footer-text">
            {isAdmin ? "ผู้ดูแลระบบ (Admin)" : "สมาชิกทั่วไป"}
          </span>
        </div>
      </aside>
    </>
  );
}
