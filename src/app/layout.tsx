import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Suspense } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const maxDuration = 60;

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: {
    default: "Daniel Isaksen",
    template: "%s · Daniel Isaksen",
  },
  description:
    "Photographs of weather, coast, and quiet rooms. A studio archive from Bergen.",
  applicationName: "Daniel Isaksen",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <Suspense fallback={<div className="h-14 border-b border-border sm:h-16" />}>
            <SiteHeader />
          </Suspense>
          <div className="flex-1">{children}</div>
          <SiteFooter />
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
