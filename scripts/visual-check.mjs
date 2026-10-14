// ตรวจว่า UI ถูกจัดสไตล์ถูกต้อง (ไม่ใช่หน้าเว็บเปล่า) และไม่มี asset โหลดไม่สำเร็จ
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const results = [];
const check = (n, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${extra ? " — " + extra : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const badResponses = [];
page.on("response", (r) => {
  if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
});
page.on("requestfailed", (r) => {
  // ข้าม RSC prefetch ที่ถูกยกเลิกตอนสลับหน้า (net::ERR_ABORTED) — เป็นพฤติกรรมปกติของ Next.js
  const err = r.failure()?.errorText || "";
  if (r.url().includes("_rsc=") && err.includes("ERR_ABORTED")) return;
  badResponses.push(`FAILED ${r.url()} ${err}`);
});

// 1) หน้า Login
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
const loginStyles = await page.evaluate(() => {
  const auth = document.querySelector(".auth-page");
  const card = document.querySelector(".auth-card");
  const cs = card ? getComputedStyle(card) : null;
  return {
    authBg: auth ? getComputedStyle(auth).backgroundImage : "",
    cardShadow: cs ? cs.boxShadow : "",
    cardRadius: cs ? cs.borderRadius : "",
  };
});
check("หน้า Login มีพื้นหลังไล่สี", loginStyles.authBg.includes("gradient"), loginStyles.authBg.slice(0, 60));
check("การ์ด Login มีมุมโค้ง/เงา", loginStyles.cardRadius !== "0px" && loginStyles.cardShadow !== "none");

// 2) Dashboard
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.type("#email", "admin@test.com");
await page.type("#password", "123456");
await page.click("button[type=submit]");
await page.waitForFunction(() => location.pathname.includes("dashboard"), { timeout: 20000 });
await page.waitForNetworkIdle({ idleTime: 1000, timeout: 20000 });

const shell = await page.evaluate(() => {
  const side = document.querySelector(".admin-sidebar");
  const nav = document.querySelector(".admin-navbar");
  const card = document.querySelector(".metric-card");
  const panel = document.querySelector(".panel");
  const canvas = document.querySelector("canvas");
  const icon = document.querySelector(".bi");
  const s = side ? getComputedStyle(side) : null;
  return {
    theme: document.documentElement.getAttribute("data-theme") || "light",
    sideWidth: side ? side.getBoundingClientRect().width : 0,
    sideBg: s ? s.backgroundColor : "",
    navHeight: nav ? nav.getBoundingClientRect().height : 0,
    cardBg: card ? getComputedStyle(card).backgroundColor : "",
    panelExists: !!panel,
    canvasSize: canvas ? `${canvas.width}x${canvas.height}` : "none",
    sidebarLinks: document.querySelectorAll(".sidebar-nav .nav-link").length,
    iconFont: icon ? getComputedStyle(icon, "::before").fontFamily : "",
    iconGlyph: icon ? getComputedStyle(icon, "::before").content : "",
  };
});
const solid = (c) => !!c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent";
check("Sidebar แสดงผลกว้าง ~280px", shell.sideWidth > 200, `width=${Math.round(shell.sideWidth)} theme=${shell.theme}`);
check("Sidebar มีสีพื้นหลัง (ไม่โปร่งใส)", solid(shell.sideBg), shell.sideBg);
check("Navbar แสดงผล", shell.navHeight > 40, `h=${Math.round(shell.navHeight)}`);
check("การ์ดสรุปถูกจัดสไตล์", solid(shell.cardBg), shell.cardBg);
check("Panel ตารางแสดงผล", shell.panelExists);
check("กราฟถูกเรนเดอร์บน Canvas", shell.canvasSize !== "none" && parseInt(shell.canvasSize) > 100, shell.canvasSize);
check("เมนูฝั่งซ้ายมี 4 รายการ", shell.sidebarLinks === 4, `links=${shell.sidebarLinks}`);
check("ฟอนต์ไอคอน Bootstrap โหลดแล้ว", shell.iconFont.includes("bootstrap-icons"), shell.iconFont);
check("ไอคอนแสดงอักขระจริง (ไม่ใช่สี่เหลี่ยมว่าง)", shell.iconGlyph !== '"\\ed8d"' && shell.iconGlyph.length > 0, shell.iconGlyph);

// 3) ตรวจทุกหน้าว่าไม่มี asset 404
for (const p of ["/dashboard", "/documents", "/reports", "/users", "/login", "/register"]) {
  badResponses.length = 0;
  await page.goto(`${BASE}${p}`, { waitUntil: "networkidle2" });
  const visible = await page.evaluate(() => document.body.innerText.trim().length > 100);
  check(`หน้า ${p} ไม่มี asset โหลดไม่สำเร็จ`, badResponses.length === 0, badResponses.slice(0, 3).join(" | "));
  check(`หน้า ${p} มีเนื้อหา`, visible);
}

// 4) ตรวจว่าไม่มี console error ร้ายแรง
const errPage = await browser.newPage();
const errs = [];
errPage.on("pageerror", (e) => errs.push(e.message));
await errPage.goto(`${BASE}/dashboard`, { waitUntil: "networkidle2" });
await errPage.goto(`${BASE}/documents`, { waitUntil: "networkidle2" });
await errPage.goto(`${BASE}/reports`, { waitUntil: "networkidle2" });
check("ไม่มี JavaScript error ในหน้าหลัก", errs.length === 0, errs.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\nสรุป: ${results.length - failed}/${results.length} ผ่าน`);
process.exit(failed ? 1 : 0);
