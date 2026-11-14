import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700"] });
const body = Barlow({ variable: "--font-body", subsets: ["latin"], weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "Mission: Discovery",
  description: "Design a space mission with your crew. Every choice costs something.",
};

export const viewport: Viewport = { themeColor: "#0A0C10", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
