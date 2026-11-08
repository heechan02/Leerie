import type { Metadata } from "next";
import { Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/** A government-commissioned face, openly licensed. Carries the interface. */
const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

/** Carries references, coordinates and times: read aloud and transcribed. */
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Leerie, measured night light on Edinburgh streets",
  description:
    "Street-level night light measured by phones, predicted for unwalked streets, and turned into safer routes and a lighting plan.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${publicSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
