import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var v=localStorage.getItem('viewMode');if(v==='list'){document.documentElement.setAttribute('data-view-mode','list')}else{document.documentElement.setAttribute('data-view-mode','grid')}}catch(e){document.documentElement.setAttribute('data-view-mode','grid')}`,
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: `.skeleton-list{display:none}.skeleton-grid{display:block}html[data-view-mode="list"] .skeleton-list{display:block}html[data-view-mode="list"] .skeleton-grid{display:none}` }} />
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
