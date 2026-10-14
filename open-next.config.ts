import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// ตั้งค่า OpenNext สำหรับ deploy ขึ้น Cloudflare Workers
// ใช้ cache แบบ in-memory (ถ้าต้องการ R2 cache ให้ดู https://opennext.js.org/cloudflare)
export default defineCloudflareConfig({});
