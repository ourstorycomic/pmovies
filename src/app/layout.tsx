import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Nav } from "@/components/nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PMovies - Premium Streaming",
  description: "A glassmorphic movie streaming platform powered by a secure BFF proxy.",
  openGraph: {
    title: "PMovies - Premium Streaming",
    description: "A glassmorphic movie streaming platform powered by a secure BFF proxy.",
    type: "website",
    siteName: "PMovies",
  },
  twitter: {
    card: "summary_large_image",
    title: "PMovies - Premium Streaming",
    description: "A glassmorphic movie streaming platform powered by a secure BFF proxy.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#0a0a0a] text-white">
        <AuthProvider>
          <Nav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
