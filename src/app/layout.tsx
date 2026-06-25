import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EDR Compliance Dashboard",
  description: "Monitor EDR/XDR/AV endpoint compliance across your fleet.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      {/* suppressHydrationWarning: some browser extensions inject attributes (e.g. bis_register) on body before React hydrates. */}
      <body suppressHydrationWarning className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
