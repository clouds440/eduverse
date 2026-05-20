import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { getSiteUrl } from "@/lib/site";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/themeBootstrap";

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'EduVerse',
    template: '%s | EduVerse',
  },
  description: "Manage schools, institutes, students, teachers, courses, attendance, communication, and academic records in one secure education platform.",
  applicationName: 'EduVerse',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [{ url: '/assets/eduverse-icon.png', type: 'image/png', sizes: '512x512' }],
    shortcut: [{ url: '/assets/eduverse-icon.png', type: 'image/png', sizes: '512x512' }],
    apple: [{ url: '/assets/eduverse-icon.png', type: 'image/png', sizes: '512x512' }],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'EduVerse',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'EduVerse',
    title: 'EduVerse',
    description: "Manage schools, institutes, students, teachers, courses, attendance, communication, and academic records in one secure education platform.",
    images: [
      {
        url: '/assets/eduverse-icon.png',
        width: 512,
        height: 512,
        alt: 'EduVerse',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'EduVerse',
    description: "Manage schools, institutes, students, teachers, courses, attendance, communication, and academic records in one secure education platform.",
    images: ['/assets/eduverse-icon.png'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#090d16' },
  ],
};

import Navbar from "@/components/Navbar";
import { Providers } from "@/components/Providers";
import DashboardMainWrapper from "@/components/DashboardMainWrapper";
import { PWAInstallPrompt } from "@/components/ui/PWAInstallPrompt";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="min-h-full" suppressHydrationWarning>
      <head>
        <link rel="preload" as="image" href="/assets/eduverse-icon.png" />
        <link rel="preload" as="image" href="/assets/eduverse.png" />
      </head>
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased h-screen flex flex-col bg-theme-bg transition-colors duration-500 overflow-hidden`}
      >
        <Script id="eduverse-theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP_SCRIPT}
        </Script>
        <Providers>
          <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
            {/* Branded Atmospheric Gradient */}
            <div className="absolute inset-0 bg-theme-bg/50" />
            <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-secondary/10" />

            {/* Animated Branded Blobs */}
            <div className="absolute -top-12 -left-12 w-96 h-96 bg-primary/20 dark:bg-primary/10 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-3xl opacity-30 animate-blob" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/20 dark:bg-secondary/10 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
            <div className="absolute -bottom-12 left-1/2 w-96 h-96 bg-primary/20 dark:bg-primary/10 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
          </div>

          <Navbar />
          <DashboardMainWrapper>
            {children}
          </DashboardMainWrapper>
          <PWAInstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
