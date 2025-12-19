import { Geist, Geist_Mono } from "next/font/google";
import { Hedvig_Letters_Serif } from "next/font/google";
import { Montserrat } from "next/font/google";
import { Marcellus } from "next/font/google";
import "./globals.css";
import ClientBody from "./ClientBody";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const hedvigLettersSerif = Hedvig_Letters_Serif({
  variable: "--font-hedvig-letters-serif",
  subsets: ["latin"],
  weight: "400",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const marcellus = Marcellus({
  variable: "--font-marcellus",
  subsets: ["latin"],
  weight: "400",
});

export const metadata = {
  title: "Kolos - B2B Signals & Networking Platform",
  description: "Kolos Signals engine for B2B clients. Get high-value signals, travel plans, and industry events tailored to your business.",
  icons: {
    icon: "/Favicon new.jpg",
  },
  openGraph: {
    title: "Kolos - B2B Signals & Networking Platform",
    description: "Kolos Signals engine for B2B clients. Get high-value signals, travel plans, and industry events tailored to your business.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://kolos.network",
    siteName: "Kolos",
    images: [
      {
        url: "https://storage.mlcdn.com/account_image/1108377/l1IcJ0rEULJH2abWtkQaEOpl3jJqZRVMyJloBUMd.jpg",
        width: 1200,
        height: 630,
        alt: "Kolos Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kolos - B2B Signals & Networking Platform",
    description: "Kolos Signals engine for B2B clients. Get high-value signals, travel plans, and industry events tailored to your business.",
    images: ["https://storage.mlcdn.com/account_image/1108377/l1IcJ0rEULJH2abWtkQaEOpl3jJqZRVMyJloBUMd.jpg"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${hedvigLettersSerif.variable} ${montserrat.variable} ${marcellus.variable}`}>
      <head>
        <link rel="icon" href="/Favicon new.jpg" />
        <link rel="apple-touch-icon" href="/Favicon new.jpg" />
        <meta name="theme-color" content="#0D2D25" />
        <Script
          crossOrigin="anonymous"
          src="//unpkg.com/same-runtime/dist/index.global.js"
        />
      </head>
      <body suppressHydrationWarning className="antialiased">
        <ClientBody>{children}</ClientBody>
      </body>
    </html>
  );
}

