import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PopupAnnouncement from "@/components/PopupAnnouncement";

export const metadata: Metadata = {
  title: "GetStore",
  description: "Verified numbers and premium accounts, delivered instantly from your wallet.",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    if (stored === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Runs before paint so switching themes doesn't flash the wrong one. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Navbar />
        <PopupAnnouncement />
        <main>{children}</main>
      </body>
    </html>
  );
}
