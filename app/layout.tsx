import type { Metadata } from "next";
import { Prompt, Radio_Canada } from "next/font/google";

import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "UPC Connect",
  description: "Integrated church management system for UPC Batangas",
};

const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const radioCanada = Radio_Canada({
  variable: "--font-radio-canada",
  subsets: ["latin"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${prompt.variable} ${radioCanada.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
