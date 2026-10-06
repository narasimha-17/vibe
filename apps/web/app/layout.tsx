import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./site-theme.css";
import "./site-variants.css";
import "./site-variants-2.css";
import "./site-variants-3.css";
import "./site-variants-4.css";
import "./site-variants-5.css";
import "./site-auth.css";
import { ToastHost } from "@/components/ui/ToastHost";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "VIBE — Visual Interface Building Engine",
  description: "Design visually. Build intelligently. Own the code.",
};

const THEME_INIT = `
try {
  document.documentElement.setAttribute('data-theme', 'light');
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="font-sans">
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
