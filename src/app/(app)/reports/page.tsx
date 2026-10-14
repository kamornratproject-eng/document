import { getDashboardStats, getReportRows } from "@/lib/reports";
import { requireUser } from "@/lib/auth";
import { thaiDateShort } from "@/lib/dates";
import {
  StatusDoughnut,
  ExpiryMonthBar,
  AddTrendLine,
  HorizontalBar,
} from "@/components/charts";
import ExportCsv from "@/components/ExportCsv";
import ReminderButton from "@/components/ReminderButton";
import PrintButton from "@/components/PrintButton";


function Tile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: string;
  tone: string;
}) {
  return (
    <div className="summary-tile d-flex align-items-center gap-3">
      <span
        className="d-inline-flex align-items-center justify-content-center rounded-3"
        style={{ width: 46, height: 46, background: `${tone}1a`, color: tone }}
      >
        <i className={`bi ${icon} fs-5`} />
      </span>
      <div>
        <div className="tile-label">{label}</div>
        <div className="tile-value">{value}</div>
      </div>
    </div>
  );
}

export default async function ReportsPage() {
  await requireUser();
  const stats = await getDashboardStats();
  const docs = await getReportRows();

  const byYear = stats.byYear;
  const notified = stats.notified;

  return (
    <>
      <div className="page-heading no-print">
        <div className="page-heading-copy">
          <span className="page-icon">
            <i className="bi bi-bar-chart-line" />
          </span>
          <div>
            <p className="eyebrow mb-1">รายงาน</p>
            <h1 className="h3 mb-1">สรุปรายงานเอกสาร</h1>
            <p className="text-muted mb-0">
              รายงานสถิติใบอนุญาตในรูปแบบกราฟ พร้อมสรุปตัวเลขและส่งออกข้อมูล
            </p>
          </div>
        </div>
        <div className="heading-actions">
          <ReminderButton />
          <ExportCsv />
          <PrintButton />
        </div>
      </div>

      <section className="summary-grid mb-3">
        <Tile label="เอกสารทั้งหมด" value={stats.total} icon="bi-journal-text" tone="#2563eb" />
        <Tile label="ใช้งานปกติ" value={stats.active} icon="bi-check2-circle" tone="#0f766e" />
        <Tile label="ใกล้หมดอายุ ≤30 วัน" value={stats.soon} icon="bi-hourglass-split" tone="#d97706" />
        <Tile label="หมดอายุแล้ว" value={stats.expired} icon="bi-exclamation-octagon" tone="#dc2626" />
        <Tile label="มีไฟล์แนบ" value={stats.withFile} icon="bi-paperclip" tone="#7c3aed" />
        <Tile label="แจ้งเตือนที่ส่งแล้ว" value={notified.sent} icon="bi-envelope-check" tone="#0ea5e9" />
      </section>

      <section className="row g-3">
        <div className="col-12 col-xl-4">
          <article className="panel h-100">
            <div className="panel-header">
              <div>
                <h2 className="h5 mb-1 section-title">
                  <i className="bi bi-pie-chart-fill" /> <span>สัดส่วนสถานะ</span>
                </h2>
                <p className="text-muted mb-0 small">ใช้งานปกติ / ใกล้หมดอายุ / หมดอายุแล้ว</p>
              </div>
            </div>
            <div className="chart-box">
              <StatusDoughnut data={stats.byStatus.map((s) => ({ label: s.label, value: s.value }))} />
            </div>
          </article>
        </div>

        <div className="col-12 col-xl-8">
          <article className="panel h-100">
            <div className="panel-header">
              <div>
                <h2 className="h5 mb-1 section-title">
                  <i className="bi bi-calendar3" /> <span>จำนวนเอกสารที่หมดอายุรายเดือน</span>
                </h2>
                <p className="text-muted mb-0 small">ช่วง 12 เดือนนับจากเดือนนี้</p>
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
                  <i className="bi bi-graph-up" /> <span>แนวโน้มการบันทึกรายเดือน</span>
                </h2>
                <p className="text-muted mb-0 small">ย้อนหลัง 12 เดือน</p>
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
                  <i className="bi bi-person-workspace" /> <span>จำนวนเอกสารตามผู้รับผิดชอบ</span>
                </h2>
                <p className="text-muted mb-0 small">เรียงจากมากไปน้อย</p>
              </div>
            </div>
            <div className="chart-box">
              <HorizontalBar
                data={stats.byResponsible.map((r) => ({ label: r.label, value: r.count }))}
                color="#2563eb"
              />
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
                  <i className="bi bi-calendar-x" /> <span>เอกสารที่หมดอายุแยกตามปี</span>
                </h2>
                <p className="text-muted mb-0 small">ปี พ.ศ.</p>
              </div>
            </div>
            <div className="chart-box">
              <HorizontalBar data={byYear.map((y) => ({ label: y.label, value: y.count }))} color="#dc2626" />
            </div>
          </article>
        </div>

        <div className="col-12 col-xl-6">
          <article className="panel h-100">
            <div className="panel-header">
              <div>
                <h2 className="h5 mb-1 section-title">
                  <i className="bi bi-envelope-paper" /> <span>การแจ้งเตือนล่วงหน้า 30 วัน</span>
                </h2>
                <p className="text-muted mb-0 small">ประวัติการแจ้งเตือนล่าสุด</p>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0 doc-table">
                <thead>
                  <tr>
                    <th>รายการ</th>
                    <th>ผู้รับ</th>
                    <th>คงเหลือ</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.filter((d) => d.daysLeft <= 30 && d.daysLeft >= -30).length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        ยังไม่มีเอกสารเข้าเกณฑ์แจ้งเตือน
                      </td>
                    </tr>
                  )}
                  {docs
                    .filter((d) => d.daysLeft <= 30 && d.daysLeft >= -30)
                    .slice(0, 8)
                    .map((d) => (
                      <tr key={d.id}>
                        <td>
                          <p className="cell-main mb-0">{d.item}</p>
                          <p className="cell-sub mb-0">หมดอายุ {thaiDateShort(d.expiryDate)}</p>
                        </td>
                        <td>{d.responsibleEmail || "-"}</td>
                        <td>
                          <span className={`years-pill ${d.status === "expired" ? "is-expired" : "is-soon"}`}>
                            {d.daysLeft >= 0 ? `${d.daysLeft} วัน` : `เลย ${Math.abs(d.daysLeft)} วัน`}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${d.statusBadge}`}>{d.statusLabel}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </section>

      <section className="panel mt-3">
        <div className="panel-header">
          <div>
            <h2 className="h5 mb-1 section-title">
              <i className="bi bi-list-check" /> <span>ตารางสรุปเอกสารทั้งหมด</span>
            </h2>
            <p className="text-muted mb-0 small">แสดง 20 รายการแรก (เรียงตามวันหมดอายุ)</p>
          </div>
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
                <th>สถานที่ไปติดต่อ</th>
                <th>ผู้รับผิดชอบ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {docs.slice(0, 20).map((d) => (
                <tr key={d.id}>
                  <td>{d.seq}</td>
                  <td className="cell-main">{d.item}</td>
                  <td>{thaiDateShort(d.issueDate)}</td>
                  <td>{thaiDateShort(d.expiryDate)}</td>
                  <td>
                    <span className={`years-pill ${d.status === "expired" ? "is-expired" : d.status === "soon" ? "is-soon" : ""}`}>
                      {d.yearsLabel}
                    </span>
                  </td>
                  <td>{d.contactLocation || "-"}</td>
                  <td>{d.responsibleName || "-"}</td>
                  <td>
                    <span className={`badge ${d.statusBadge}`}>{d.statusLabel}</span>
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4">
                    ยังไม่มีข้อมูลเอกสาร
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
