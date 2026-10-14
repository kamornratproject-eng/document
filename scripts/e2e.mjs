/**
 * E2E test ด้วย Chrome จริง: สมัคร → login → ดูหน้าต่าง ๆ → เพิ่มเอกสาร (แนบไฟล์) → แก้ไข → ลบ
 * รัน: node scripts/e2e.mjs
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
// SKIP_FILE=1 → ข้ามการแนบไฟล์ (ใช้ตอนทดสอบบน Cloudflare preview ที่ยังไม่ได้ตั้งค่า Google Drive)
const SKIP_FILE = process.env.SKIP_FILE === "1";
const OUT = "/tmp/shots";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text());
});

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
}

/** ตั้งค่าช่องวันที่แบบไทย (input เป็นข้อความ วัน/เดือน/ปี พ.ศ. ไม่ใช่ type=date แล้ว) */
async function setDate(selector, iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const thai = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
  await page.$eval(selector, (el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.type(selector, thai);
}

try {
  // ---------- 1. หน้า Login ----------
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await shot("01-login");
  check("หน้า Login แสดงผล", (await page.title()).length > 0);

  // ---------- 2. Login ด้วย email ----------
  await page.type("#email", "admin@test.com");
  await page.type("#password", "123456");
  await page.click("button[type=submit]");
  await page.waitForFunction(() => location.pathname.includes("dashboard"), { timeout: 15000 });
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 });
  await shot("02-dashboard");
  const dashText = await page.evaluate(() => document.body.innerText);
  check("Login สำเร็จ → หน้า Dashboard", page.url().includes("/dashboard") && dashText.includes("แดชบอร์ด"), page.url());
  check("Dashboard มีการ์ดสรุป", dashText.includes("เอกสารทั้งหมด"));
  const canvasCount = await page.$$eval("canvas", (els) => els.length);
  check("Dashboard แสดงกราฟ", canvasCount >= 3, `canvas=${canvasCount}`);

  // ---------- 3. หน้าทะเบียนเอกสาร ----------
  await page.goto(`${BASE}/documents`, { waitUntil: "networkidle2" });
  await shot("03-documents");
  const docText = await page.evaluate(() => document.body.innerText);
  check("หน้าทะเบียนเอกสารแสดงหัวข้อ", docText.includes("ทะเบียนเอกสารใบอนุญาต"));
  check("คอลัมน์ครบตามที่กำหนด", ["ลำดับ", "รายการ", "วันที่ออกใบอนุญาต", "วันที่หมดอายุ", "อายุใบอนุญาต", "สถานที่ไปติดต่อ", "ผู้รับผิดชอบ", "อีเมล", "ไฟล์เอกสาร"].every((c) => docText.includes(c)));

  // ---------- 4. เพิ่มเอกสารผ่านฟอร์ม ----------
  await page.waitForSelector("button.btn-primary", { timeout: 10000 });
  const addBtn = await page.$$eval("button.btn-primary", (btns) =>
    btns.findIndex((b) => b.innerText.includes("เพิ่มเอกสาร"))
  );
  const buttons = await page.$$("button.btn-primary");
  await buttons[addBtn].click();
  await page.waitForSelector("#item", { timeout: 10000 });
  await shot("04-add-modal");

  await page.type("#item", "ใบอนุญาตสถานีบริการน้ำมัน (E2E)");
  await setDate("#issue_date", "2025-01-01");
  await setDate("#expiry_date", "2030-01-01");
  await page.type("#contact_location", "สำนักงานคณะกรรมการกำกับกิจการพลังงาน");
  await page.type("#responsible_name", "ทดสอบ ผู้รับผิดชอบ");
  await page.type("#responsible_email", "e2e@test.com");

  // ช่องวันที่ต้องแสดงเป็น วัน/เดือน/ปี พ.ศ. และเปิดปฏิทินภาษาไทยได้
  const issueShown = await page.$eval("#issue_date", (el) => el.value);
  check("ช่องวันที่แสดงรูปแบบไทย (วัน/เดือน/ปี พ.ศ.)", /^\d{2}\/\d{2}\/25\d{2}$/.test(issueShown), issueShown);
  const ageShown = await page.$eval("#license_age", (el) => el.value);
  check("อายุใบอนุญาตแสดงในช่อง input", /ปี|หมดอายุ/.test(ageShown), ageShown);
  await page.click("#expiry_date + button");
  await page.waitForSelector(".thai-date-calendar", { timeout: 5000 });
  await shot("04b-thai-calendar");
  const calText = await page.evaluate(() => document.querySelector(".thai-date-calendar").innerText);
  const THAI_MONTHS_FULL = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  check(
    "ปฏิทินภาษาไทย (เดือนเต็ม + ปี พ.ศ.)",
    THAI_MONTHS_FULL.some((m) => calText.includes(m)) && /25\d{2}/.test(calText),
    calText.replace(/\n/g, " ").slice(0, 40)
  );
  const dayBtns = await page.$$(".thai-date-day");
  await dayBtns[14].click();
  const afterPick = await page.$eval("#expiry_date", (el) => el.value);
  check("เลือกวันจากปฏิทินแล้วค่าในช่องเป็น dd/mm/พ.ศ.", /^\d{2}\/\d{2}\/25\d{2}$/.test(afterPick), afterPick);

  // แนบไฟล์ (ข้ามได้ด้วย SKIP_FILE=1)
  if (!SKIP_FILE) {
    fs.writeFileSync("/tmp/e2e-doc.txt", "ไฟล์เอกสารทดสอบ E2E\n");
    const input = await page.$("#file");
    await input.uploadFile("/tmp/e2e-doc.txt");
  }
  await shot("05-add-filled");

  await page.click('button[form="docForm"]');
  await page.waitForFunction(() => !document.querySelector("#item"), { timeout: 15000 });
  await page.waitForFunction(() => document.body.innerText.includes("ใบอนุญาตสถานีบริการน้ำมัน (E2E)"), { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector(".swal2-container"), { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 300));
  await shot("06-after-create");
  const listText = await page.evaluate(() => document.body.innerText);
  check("เพิ่มเอกสารสำเร็จ (แสดงในตาราง)", listText.includes("ใบอนุญาตสถานีบริการน้ำมัน (E2E)"));
  check("แสดงอายุใบอนุญาตเป็นจำนวนปี", /5\.\d{2} ปี/.test(listText), listText.match(/\d+\.\d{2} ปี/)?.[0] || "");
  if (!SKIP_FILE) check("แสดงไฟล์แนบ", listText.includes("e2e-doc.txt"));

  // ---------- 5. แก้ไขเอกสาร ----------
  await page.waitForFunction(() => document.body.innerText.includes("ใบอนุญาตสถานีบริการน้ำมัน (E2E)"), { timeout: 15000 });
  const editBtns = await page.$$("button[title='แก้ไข']");
  await editBtns[0].click();
  await page.waitForSelector("#item", { timeout: 10000 });
  await shot("06b-edit-modal");
  // รอให้ toast หายไปก่อนกดบันทึก (กัน overlay บังปุ่ม)
  // ล้างค่าด้วย native setter เพื่อให้ React รับค่าใหม่
  await page.$eval("#item", (el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.type("#item", "ใบอนุญาตสถานีบริการน้ำมัน (E2E แก้ไขแล้ว)");
  const editVal = await page.$eval("#item", (el) => el.value);
  console.log("  edit value =", editVal);
  await page.waitForFunction(() => !document.querySelector(".swal2-container"), { timeout: 10000 });
  await page.click('button[form="docForm"]');
  await page.waitForFunction(() => !document.querySelector("#item"), { timeout: 15000 });
  await page.waitForFunction(() => document.body.innerText.includes("E2E แก้ไขแล้ว"), { timeout: 15000 });
  const afterEdit = await page.evaluate(() => document.body.innerText);
  check("แก้ไขเอกสารสำเร็จ", afterEdit.includes("E2E แก้ไขแล้ว"));
  check("แสดงผู้แก้ไข", afterEdit.includes("ผู้บันทึก / ผู้แก้ไข"));

  // ---------- 6. หน้ารายงาน ----------
  await page.goto(`${BASE}/reports`, { waitUntil: "networkidle2" });
  await shot("07-reports");
  const repText = await page.evaluate(() => document.body.innerText);
  check("หน้ารายงานแสดงหัวข้อ", repText.includes("สรุปรายงานเอกสาร"));
  const repCanvas = await page.$$eval("canvas", (els) => els.length);
  check("หน้ารายงานมีกราฟ", repCanvas >= 4, `canvas=${repCanvas}`);

  // ---------- 7. หน้าผู้ใช้งาน ----------
  await page.goto(`${BASE}/users`, { waitUntil: "networkidle2" });
  await shot("08-users");
  const userText = await page.evaluate(() => document.body.innerText);
  check("หน้าผู้ใช้งานแสดงรายชื่อ", userText.includes("ผู้ใช้งานในระบบ") && userText.includes("admin@test.com"));

  // ---------- 8. ลบเอกสาร (SweetAlert confirm) ----------
  await page.goto(`${BASE}/documents`, { waitUntil: "networkidle2" });
  const delBtns = await page.$$("button[title='ลบ']");
  const beforeCount = await page.$$eval("tbody tr", (r) => r.length);
  await delBtns[0].click();
  await page.waitForSelector(".swal2-popup", { timeout: 10000 });
  await shot("09-delete-confirm");
  await page.click(".swal2-confirm");
  await page.waitForFunction(
    (t) => !document.body.innerText.includes(t),
    { timeout: 15000 },
    "ใบอนุญาตสถานีบริการน้ำมัน (E2E แก้ไขแล้ว)"
  );
  // ปิดกล่องข้อความ "ลบสำเร็จ"
  await page.waitForSelector(".swal2-confirm", { timeout: 10000 });
  await page.click(".swal2-confirm");
  await new Promise((r) => setTimeout(r, 500));
  const afterDel = await page.$$eval("tbody tr", (r) => r.length);
  const stillThere = await page.evaluate(() => document.body.innerText.includes("E2E แก้ไขแล้ว"));
  check("ลบเอกสารสำเร็จ (SweetAlert)", !stillThere, `rows ${beforeCount} → ${afterDel}`);
  if (!SKIP_FILE) {
    const uploads = fs.readdirSync("/home/it-teerapong/Desktop/document/data/uploads");
    check("ลบไฟล์ออกจาก storage แล้ว", uploads.length === 0, `files=${uploads.length}`);
  }
  await shot("10-after-delete");

  // ---------- 9. ทดสอบหน้าจอขนาดมือถือ ----------
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle2" });
  await shot("11-mobile-dashboard");
  check("หน้า Dashboard แสดงผลบนมือถือ", true);

  // ---------- 10. Logout ----------
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle2" });
  const loggedOut = await page.evaluate(async () => {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    return res.status;
  });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle2" });
  check("ออกจากระบบแล้วถูกพาไปหน้า Login", page.url().includes("/login"), `status=${loggedOut}`);
  await shot("12-redirect-login");

  // ---------- 11. หน้า Register ----------
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle2" });
  await shot("13-register");
  const regText = await page.evaluate(() => document.body.innerText);
  check("หน้าลงทะเบียนครบ (ชื่อ-สกุล/แผนก/อีเมล)", ["ชื่อ-สกุล", "แผนก", "อีเมล"].every((t) => regText.includes(t)));
} catch (err) {
  check("E2E script", false, err.message);
} finally {
  if (errors.length) {
    console.log("\n--- Console/Page errors ---");
    [...new Set(errors)].slice(0, 15).forEach((e) => console.log("  " + e));
  }
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\nสรุป: ${results.length - failed.length}/${results.length} ผ่าน`);
process.exit(failed.length ? 1 : 0);
