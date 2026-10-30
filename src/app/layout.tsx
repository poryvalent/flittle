import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";
import { SiteChrome } from "@/components/site-chrome";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "800", "900"],
});

export const metadata: Metadata = {
  title: "Flittle — The tech team you don't have to hire",
  description:
    "Flittle is a software development consultancy for companies without an in-house tech team.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${interTight.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <SiteChrome />
        {children}
      </body>
    </html>
  );
}
