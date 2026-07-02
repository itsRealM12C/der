import type { Metadata, Viewport as NextViewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { ScalingScript } from "@/components/scaling-script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HexForge — Advanced Web Hex Editor & Reverse Engineering Toolkit",
  description:
    "Browser-based hex editor for reverse engineering with audio & video analysis, file structure templates, checksums, hash computation, and string extraction. All client-side. Mobile friendly.",
  keywords: [
    "hex editor",
    "reverse engineering",
    "binary analysis",
    "audio analysis",
    "video analysis",
    "checksum",
    "HxD alternative",
    "mobile hex editor",
  ],
  authors: [{ name: "HexForge" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export const viewport: NextViewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // allow user zoom for accessibility
  userScalable: true,
  viewportFit: "cover", // for iPhone safe areas
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ScalingScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
