import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { getSiteUrl } from "@/lib/site";
import { getWebsiteJsonLd, SEO_KEYWORDS, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
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
    default: `${SITE_NAME} | School Management System`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'Education',
  classification: 'Education software',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
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
    siteName: SITE_NAME,
    title: `${SITE_NAME} | School Management System`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/assets/eduverse-logo.png',
        width: 1324,
        height: 480,
        alt: `${SITE_NAME} school management platform`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | School Management System`,
    description: SITE_DESCRIPTION,
    images: ['/assets/eduverse-logo.png'],
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
  const websiteJsonLd = getWebsiteJsonLd();

  return (
    <html lang="en" className="min-h-full" suppressHydrationWarning>
      <head>
        <link rel="preload" as="image" href="/assets/eduverse-icon-192.png" />
        <link rel="preload" as="image" href="/assets/eduverse.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
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
