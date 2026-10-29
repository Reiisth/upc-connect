import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "UPC Connect",
  description: "Integrated church management system for UPC Batangas",
};

const prompt = localFont({
  src: [
    { path: "../public/fonts/prompt/Prompt-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/prompt/Prompt-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/prompt/Prompt-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/prompt/Prompt-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-prompt",
  display: "swap",
});

const radioCanada = localFont({
  src: "../public/fonts/radio-canada/RadioCanada-Variable.woff2",
  weight: "300 700",
  style: "normal",
  variable: "--font-radio-canada",
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
