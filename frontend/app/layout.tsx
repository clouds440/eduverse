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
    icon: [{ url: '/assets/eduverse-icon-192.png', type: 'image/png', sizes: '192x192' }],
    shortcut: [{ url: '/assets/eduverse-icon-192.png', type: 'image/png', sizes: '192x192' }],
    apple: [{ url: '/assets/eduverse-icon-192.png', type: 'image/png', sizes: '192x192' }],
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
        url: '/assets/eduverse-icon-192.png',
        width: 192,
        height: 192,
        alt: 'EduVerse',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'EduVerse',
    description: "Manage schools, institutes, students, teachers, courses, attendance, communication, and academic records in one secure education platform.",
    images: ['/assets/eduverse-icon-192.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#090d16' },
  ],
};

import Navbar from "@/components/Navbar";
import { Providers } from "@/components/Providers";
import DashboardMainWrapper from "@/components/DashboardMainWrapper";
import { PWAInstallPrompt } from "@/components/ui/PWAInstallPrompt";
import { AppBackground } from "@/components/AppBackground";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="min-h-full" suppressHydrationWarning>
      <head>
        <link rel="preload" as="image" href="/assets/eduverse-icon-192.png" />
        <link rel="preload" as="image" href="/assets/eduverse.png" />
      </head>
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased h-(--app-height) flex flex-col bg-theme-bg transition-colors duration-500 overflow-hidden`}
      >
        <Script id="eduverse-theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP_SCRIPT}
        </Script>
        <Providers>
          <AppBackground />
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
