import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/app/providers/auth-provider";
import { DownloadManagerOverlay } from "@/components/download/download-manager-overlay";
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
      <head>
        {/* Resource hints for external origins used during startup */}
        <link rel="preconnect" href="https://ui-avatars.com" />
        <link rel="dns-prefetch" href="https://ui-avatars.com" />
        {/* R2 CDN for thumbnails - preconnect for faster image loads */}
        <link rel="preconnect" href="https://pub-99b846451dcc4c879db177b7e8b60c2f.r2.dev" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://pub-99b846451dcc4c879db177b7e8b60c2f.r2.dev" />
        {/* Supabase for data fetching */}
        <link rel="preconnect" href="https://zcigqsiovqqldlsnwiqd.supabase.co" />
        <link rel="dns-prefetch" href="https://zcigqsiovqqldlsnwiqd.supabase.co" />
        {/* Google user avatars */}
        <link rel="preconnect" href="https://lh3.googleusercontent.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var v=localStorage.getItem('viewMode');if(v==='list'){document.documentElement.setAttribute('data-view-mode','list')}else{document.documentElement.setAttribute('data-view-mode','grid')}}catch(e){document.documentElement.setAttribute('data-view-mode','grid')}`,
          }}
        />
        {/* Skeleton toggle CSS — inlined so it's available before any stylesheet loads. Default is grid. */}
        <style dangerouslySetInnerHTML={{ __html: `.skeleton-list{display:none}.skeleton-grid{display:block}html[data-view-mode="list"] .skeleton-list{display:block}html[data-view-mode="list"] .skeleton-grid{display:none}` }} />
        <AuthProvider>
          <TooltipProvider>
            {children}
            <DownloadManagerOverlay />
          </TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
