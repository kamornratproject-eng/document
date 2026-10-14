/**
 * Worker เล็ก ๆ สำหรับเรียก API แจ้งเตือนอัตโนมัติทุกวัน
 * (Cloudflare Cron Trigger → ยิงไปที่ /api/cron ของระบบหลัก)
 *
 * deploy: cd cron-worker && npx wrangler deploy
 * secret: npx wrangler secret put CRON_SECRET
 */
interface Env {
  APP_URL: string;
  CRON_SECRET: string;
}

export default {
  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(triggerReminders(env));
  },
};

async function triggerReminders(env: Env): Promise<void> {
  const base = (env.APP_URL || "").replace(/\/$/, "");
  if (!base) {
    console.error("[cron] ยังไม่ได้ตั้งค่า APP_URL");
    return;
  }
  const url = `${base}/api/cron?secret=${encodeURIComponent(env.CRON_SECRET || "")}`;
  try {
    const res = await fetch(url, { method: "GET" });
    const body = await res.text();
    console.log(`[cron] status=${res.status} body=${body.slice(0, 500)}`);
  } catch (err) {
    console.error("[cron] failed", err);
  }
}
