import Link from "next/link";
import { getDashboardStats, getAuditLogs } from "@/lib/reports";
import { requireUser } from "@/lib/auth";
import { formatDateTime, thaiDateShort } from "@/lib/dates";
import {
  StatusDoughnut,
  ExpiryMonthBar,
  AddTrendLine,
  HorizontalBar,
} from "@/components/charts";
import ReminderButton from "@/components/ReminderButton";


function MetricCard({
  label,
  value,
  icon,
  tone,
  meta,
  metaTone,
}: {
  label: string;
  value: string | number;
  icon: string;
  tone: string;
  meta?: React.ReactNode;
  metaTone?: string;
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className="metric-icon">
          <i className={`bi ${icon}`} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-meta">
        <span className={metaTone || ""}>{meta}</span>
      </div>
    </article>
  );
}

export default async function DashboardPage() {
  await requireUser();
  const stats = await getDashboardStats();
  const logs = await getAuditLogs(8);

  return (
    <>
      <div className="page-heading">
        <div className="page-heading-copy">
          <span className="page-icon">
            <i className="bi bi-speedometer2" />
          </span>
          <div>
            <p className="eyebrow mb-1">ภาพรวมระบบ</p>
            <h1 className="h3 mb-1">แดชบอร์ด</h1>
            <p className="text-muted mb-0">
              สรุปสถานะใบอนุญาต เอกสารใกล้หมดอายุ (แจ้งเตือนล่วงหน้า 30 วัน) และการใช้งานล่าสุด
            </p>
          </div>
        </div>
        <div className="heading-actions">
          <ReminderButton />
          <Link href="/reports" className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-bar-chart-line" /> รายงาน
          </Link>
          <Link href="/documents?new=1" className="btn btn-primary btn-sm">
            <i className="bi bi-plus-lg" /> เพิ่มเอกสาร
          </Link>
        </div>
      </div>

      <section className="row g-3 mt-1" aria-label="สรุปตัวเลข">
        <div className="col-12 col-sm-6 col-xl-3">
          <MetricCard
            label="เอกสารทั้งหมด"
            value={stats.total}
            icon="bi-journal-text"
            tone="primary"
            meta={<>เพิ่มเดือนนี้ {stats.monthAdded} รายการ</>}
            metaTone="text-primary"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <MetricCard
            label="ใกล้หมดอายุ (≤30 วัน)"
            value={stats.soon}
            icon="bi-hourglass-split"
            tone="warning"
            meta={<>ต้องดำเนินการต่ออายุ</>}
            metaTone="text-warning"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <MetricCard
            label="หมดอายุแล้ว"
            value={stats.expired}
            icon="bi-exclamation-octagon"
            tone="danger"
            meta={<>เลยกำหนด {stats.expired} รายการ</>}
            metaTone="text-danger"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <MetricCard
            label="ใช้งานปกติ"
            value={stats.active}
            icon="bi-check2-circle"
            tone="success"
            meta={<>มีไฟล์แนบ {stats.withFile} รายการ</>}
            metaTone="text-success"
          />
        </div>
      </section>

      <section className="row g-3 mt-1">
        <div className="col-12 col-xl-4">
          <article className="panel h-100">
            <div className="panel-header">
              <div>
                <h2 className="h5 mb-1 section-title">
                  <i className="bi bi-pie-chart" /> <span>สถานะใบอนุญาต</span>
                </h2>
                <p className="text-muted mb-0 small">สัดส่วนสถานะเอกสารทั้งหมด</p>
              </div>
            </div>
            <div className="chart-box chart-box-sm">
              <StatusDoughnut
                data={stats.byStatus.map((s) => ({ label: s.label, value: s.value }))}
              />
            </div>
          </article>
        </div>

        <div className="col-12 col-xl-8">
          <article className="panel h-100">
            <div className="panel-header">
              <div>
                <h2 className="h5 mb-1 section-title">
                  <i className="bi bi-calendar3" /> <span>เอกสารหมดอายุรายเดือน (12 เดือน)</span>
                </h2>
                <p className="text-muted mb-0 small">วางแผนต่ออายุล่วงหน้าได้ทันเวลา</p>
              </div>
            </div>
            <div className="chart-box">
              <ExpiryMonthBar data={stats.byMonth.map((m) => ({ label: m.label, value: m.count }))} />
            </div>
          </article>
        </div>
      </section>

      <section className="row g-3 mt-1">
        <div className="col-12 col-xl-6">
          <article className="panel h-100">
            <div className="panel-header">
              <div>
                <h2 className="h5 mb-1 section-title">
                  <i className="bi bi-graph-up" /> <span>แนวโน้มการบันทึกเอกสาร</span>
                </h2>
                <p className="text-muted mb-0 small">จำนวนเอกสารที่บันทึกย้อนหลัง 12 เดือน</p>
              </div>
            </div>
            <div className="chart-box">
              <AddTrendLine data={stats.createdTrend.map((m) => ({ label: m.label, value: m.count }))} />
            </div>
          </article>
        </div>

        <div className="col-12 col-xl-6">
          <article className="panel h-100">
            <div className="panel-header">
              <div>
                <h2 className="h5 mb-1 section-title">
                  <i className="bi bi-person-workspace" /> <span>เอกสารตามผู้รับผิดชอบ</span>
                </h2>
                <p className="text-muted mb-0 small">Top {stats.byResponsible.length} ผู้รับผิดชอบ</p>
              </div>
            </div>
            <div className="chart-box">
              <HorizontalBar
                data={stats.byResponsible.map((r) => ({ label: r.label, value: r.count }))}
                color="#0f766e"
              />
            </div>
          </article>
        </div>
      </section>

      <section className="row g-3 mt-1">
        <div className="col-12 col-xl-7">
          <article className="panel h-100">
            <div className="panel-header">
              <div>
                <h2 className="h5 mb-1 section-title">
                  <i className="bi bi-hourglass-split" /> <span>รายการใกล้หมดอายุ</span>
                </h2>
                <p className="text-muted mb-0 small">เรียงจากวันหมดอายุเร็วที่สุด</p>
              </div>
              <Link href="/documents?status=soon" className="btn btn-light btn-sm">
                ดูทั้งหมด
              </Link>
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0 doc-table">
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th>รายการ</th>
                    <th>วันหมดอายุ</th>
                    <th>อายุคงเหลือ</th>
                    <th>ผู้รับผิดชอบ</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.expiringSoon.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        ไม่มีเอกสารที่ใกล้หมดอายุในขณะนี้
                      </td>
                    </tr>
                  )}
                  {stats.expiringSoon.map((d) => (
                    <tr key={d.id}>
                      <td>{d.seq}</td>
                      <td>
                        <p className="cell-main mb-0">{d.item}</p>
                        <p className="cell-sub mb-0">{d.contactLocation || "-"}</p>
                      </td>
                      <td>{thaiDateShort(d.expiryDate)}</td>
                      <td>
                        <span className={`years-pill ${d.status === "soon" ? "is-soon" : ""}`}>
                          {d.daysLeft} วัน
                        </span>
                      </td>
                      <td>
                        <p className="mb-0">{d.responsibleName || "-"}</p>
                        <p className="cell-sub mb-0">{d.responsibleEmail || "-"}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <div className="col-12 col-xl-5">
          <article className="panel h-100">
            <div className="panel-header">
              <div>
                <h2 className="h5 mb-1 section-title">
                  <i className="bi bi-activity" /> <span>กิจกรรมล่าสุด</span>
                </h2>
                <p className="text-muted mb-0 small">ผู้บันทึก / ผู้แก้ไข / การแจ้งเตือน</p>
              </div>
            </div>
            <ul className="list-unstyled mb-0">
              {logs.length === 0 && (
                <li className="text-muted text-center py-4">ยังไม่มีกิจกรรม</li>
              )}
              {logs.map((l) => (
                <li key={l.id} className="d-flex gap-2 align-items-start py-2 border-bottom">
                  <span
                    className={`badge ${
                      l.action === "delete"
                        ? "text-bg-danger"
                        : l.action === "create"
                          ? "text-bg-success"
                          : l.action === "remind"
                            ? "text-bg-info"
                            : "text-bg-primary"
                    }`}
                  >
                    {l.action}
                  </span>
                  <div className="flex-grow-1">
                    <p className="mb-0" style={{ fontSize: 13.5 }}>
                      {l.detail}
                    </p>
                    <p className="cell-sub mb-0">
                      {l.user_name || "ระบบ"} • {formatDateTime(l.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="panel mt-3">
        <div className="panel-header">
          <div>
            <h2 className="h5 mb-1 section-title">
              <i className="bi bi-journal-check" /> <span>เอกสารล่าสุด</span>
            </h2>
            <p className="text-muted mb-0 small">รายการที่บันทึกล่าสุดในระบบ</p>
          </div>
          <Link href="/documents" className="btn btn-primary btn-sm">
            <i className="bi bi-journal-text" /> เปิดทะเบียนเอกสาร
          </Link>
        </div>
        <div className="table-responsive">
          <table className="table align-middle mb-0 doc-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>รายการ</th>
                <th>วันที่ออก</th>
                <th>วันหมดอายุ</th>
                <th>อายุใบอนุญาต</th>
                <th>สถานะ</th>
                <th>ผู้บันทึก</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">
                    ยังไม่มีข้อมูลเอกสาร — เริ่มต้นด้วยการเพิ่มเอกสารใหม่
                  </td>
                </tr>
              )}
              {stats.recent.map((d) => (
                <tr key={d.id}>
                  <td>{d.seq}</td>
                  <td className="cell-main">{d.item}</td>
                  <td>{thaiDateShort(d.issueDate)}</td>
                  <td>{thaiDateShort(d.expiryDate)}</td>
                  <td>
                    <span
                      className={`years-pill ${d.status === "expired" ? "is-expired" : d.status === "soon" ? "is-soon" : ""}`}
                    >
                      {d.yearsLabel}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${d.statusBadge}`}>{d.statusLabel}</span>
                  </td>
                  <td className="cell-sub">{d.createdByName || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
