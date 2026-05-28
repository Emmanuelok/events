import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Celebrate — Plan your wedding the Ghanaian way",
  description:
    "From save-the-dates over WhatsApp to MoMo cash gifts and verified Ghanaian vendors, Celebrate is built for how Ghana actually celebrates.",
  applicationName: "Celebrate",
  keywords: ["Ghana", "wedding", "wedding planner", "MoMo gifts", "RSVP", "WhatsApp"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e3640a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GH" className={`${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
