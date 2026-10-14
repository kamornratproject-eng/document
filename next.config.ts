import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ระบบนี้ต้อง login และอ่าน/เขียนฐานข้อมูลทุกหน้า
  // จึงปิด cacheComponents เพื่อให้เรนเดอร์แบบ dynamic ตามปกติ
  cacheComponents: false,
};

export default nextConfig;
