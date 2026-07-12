import type { Metadata } from "next";
import { Geist, Geist_Mono, Hind_Siliguri } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/app/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const hindSiliguri = Hind_Siliguri({
  variable: "--font-bn",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SALI — Super Agent Liquidity & Risk Intelligence",
  description:
    "Decision-support platform for multi-provider mobile financial service super agents (bKash, Nagad, Rocket). Unified liquidity view, explainable anomaly signals, and safe human coordination. Synthetic data only.",
  keywords: [
    "bKash",
    "Nagad",
    "Rocket",
    "super agent",
    "liquidity",
    "risk intelligence",
    "SUST CSE Carnival",
    "Codex Community Hackathon",
  ],
  authors: [{ name: "Codex Community Hackathon Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${hindSiliguri.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
