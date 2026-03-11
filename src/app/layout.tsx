import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/app/providers/auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CloudVault - Cloud Storage",
  description: "Modern cloud storage powered by Telegram",
  icons: {
    icon: "/logo.webp",
    shortcut: "/logo.webp",
    apple: "/logo.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var v=localStorage.getItem('viewMode');if(v==='grid')document.documentElement.setAttribute('data-view-mode','grid')}catch(e){}`,
          }}
        />
        {/* Skeleton toggle CSS — inlined so it's available before any stylesheet loads */}
        <style dangerouslySetInnerHTML={{ __html: `.skeleton-grid{display:none}.skeleton-list{display:block}html[data-view-mode="grid"] .skeleton-grid{display:block}html[data-view-mode="grid"] .skeleton-list{display:none}` }} />
        <AuthProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
