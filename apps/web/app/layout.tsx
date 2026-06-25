import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdFlow Console",
  description: "Meta 广告管理演示工作台"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
