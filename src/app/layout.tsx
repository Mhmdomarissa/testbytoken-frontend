import type { Metadata } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

// Heading typeface. Weight 300 only - see docs/DESIGN_SYSTEM_APP.md.
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: "300",
  subsets: ["latin"],
});

// UI/body typeface, full 300-700 range for uppercase labels at 600-700.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Test by Token",
  description: "Testing-as-a-service with an auditable proof for every run.",
};

/**
 * Deliberately bare: html, fonts, body. Every provider lives in
 * (console)/layout.tsx so routes outside it (the public proof page) don't
 * inherit the console's client runtime.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        cormorantGaramond.variable,
        montserrat.variable,
      )}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
