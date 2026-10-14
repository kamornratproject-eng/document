import type { Metadata } from "next";
import Script from "next/script";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./adminhmd.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ระบบจัดเก็บเอกสารเพื่อการต่ออายุ",
    template: "%s | ระบบจัดเก็บเอกสาร",
  },
  description:
    "ระบบจัดเก็บเอกสารใบอนุญาตเพื่อการต่ออายุ แจ้งเตือนล่วงหน้า 30 วันก่อนวันหมดอายุ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        {children}
        <Script src="/vendor/bootstrap.bundle.min.js" strategy="afterInteractive" />
        <Script src="/vendor/adminhmd.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
