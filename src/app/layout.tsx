import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/app/providers/auth-provider";
import { DownloadManagerOverlay } from "@/components/download/download-manager-overlay";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CloudVault Admin Dashboard",
  description: "Administrative dashboard for CloudVault",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <SidebarProvider>
          <AppSidebar />
          <div className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-muted/20">
            <AppHeader />
            <main className="min-h-0 flex-1 overflow-auto px-3 py-4 md:px-4 md:py-5 lg:px-5">{children}</main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
