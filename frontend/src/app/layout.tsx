import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/Providers";
import Navbar from "@/components/Navbar";
import StarterPackModal from "@/components/StarterPackModal";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeckWars — Onchain Trading Card Game on HeLa L1",
  description: "Battle, collect, and craft NFT cards on HeLa L1. Clash Royale meets Pokémon, fully on-chain.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-gray-950 text-white font-sans antialiased">
        <Providers>
          <Navbar />
          <StarterPackModal />
          <main className="pt-16 pb-20 md:pb-6 min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
